import { NextRequest, NextResponse } from 'next/server';
import { BreastSide } from '@prisma/client';
import prisma from '../db';
import { withAuthContext, AuthResult } from '../utils/auth';
import { ApiResponse } from '../types';
import { checkWritePermission } from '../utils/writeProtection';
import { formatForResponse, toUTC } from '../utils/timezone';

type SessionStatus = 'ACTIVE' | 'PAUSED';
type FeedingSegment = { side: 'LEFT' | 'RIGHT'; start: string; end: string | null };
type FeedingSessionResponse = {
  id: string; babyId: string; familyId: string | null; caretakerId: string | null; startedAt: string;
  activeSide: 'LEFT' | 'RIGHT' | null; status: SessionStatus; note: string | null; segments: FeedingSegment[];
  totalDuration: number; leftDuration: number; rightDuration: number; createdAt: string; updatedAt: string;
};

function computeDurations(segments: FeedingSegment[]) {
  const now = Date.now();
  let leftDuration = 0;
  let rightDuration = 0;
  for (const segment of segments) {
    const startMs = new Date(segment.start).getTime();
    const endMs = segment.end ? new Date(segment.end).getTime() : now;
    const duration = Math.max(0, Math.floor((endMs - startMs) / 1000));
    if (segment.side === 'LEFT') leftDuration += duration;
    if (segment.side === 'RIGHT') rightDuration += duration;
  }
  return { leftDuration, rightDuration, totalDuration: leftDuration + rightDuration };
}

function mapSession(session: any): FeedingSessionResponse {
  const segments = (session.segments || []) as FeedingSegment[];
  return {
    id: session.id,
    babyId: session.babyId,
    familyId: session.familyId,
    caretakerId: session.caretakerId,
    startedAt: formatForResponse(session.startedAt) || '',
    activeSide: session.activeSide,
    status: session.status,
    note: session.note,
    segments,
    ...computeDurations(segments),
    createdAt: formatForResponse(session.createdAt) || '',
    updatedAt: formatForResponse(session.updatedAt) || '',
  };
}

async function handleGet(req: NextRequest, authContext: AuthResult) {
  try {
    const { searchParams } = new URL(req.url);
    const babyId = searchParams.get('babyId');
    if (!babyId) return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Baby ID is required' }, { status: 400 });

    const session = await prisma.feedingSession.findFirst({
      where: { babyId, familyId: authContext.familyId, status: { in: ['ACTIVE', 'PAUSED'] } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json<ApiResponse<FeedingSessionResponse | null>>({ success: true, data: session ? mapSession(session) : null });
  } catch (error) {
    console.error('Error fetching feeding session:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to fetch feeding session' }, { status: 500 });
  }
}

async function handlePost(req: NextRequest, authContext: AuthResult) {
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) return writeCheck.response!;

  try {
    const body = await req.json();
    const { babyId, action, side, note } = body as { babyId: string; action: 'start'|'pause'|'resume'|'switch'|'stop'|'update-note'; side?: 'LEFT'|'RIGHT'; note?: string; };
    if (!babyId || !action) return NextResponse.json<ApiResponse<null>>({ success: false, error: 'babyId and action are required' }, { status: 400 });

    const existing = await prisma.feedingSession.findFirst({
      where: { babyId, familyId: authContext.familyId, status: { in: ['ACTIVE', 'PAUSED'] } },
      orderBy: { createdAt: 'desc' },
    });
    const nowISO = toUTC(new Date().toISOString()).toISOString();

    if (action === 'start') {
      if (!side) return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Side is required' }, { status: 400 });
      if (existing) return NextResponse.json<ApiResponse<null>>({ success: false, error: 'An active feeding session already exists' }, { status: 409 });
      const created = await prisma.feedingSession.create({
        data: { babyId, familyId: authContext.familyId, caretakerId: authContext.caretakerId, startedAt: toUTC(new Date().toISOString()), activeSide: side as BreastSide, status: 'ACTIVE', note: note?.trim() || null, segments: [{ side, start: nowISO, end: null }] },
      });
      return NextResponse.json<ApiResponse<FeedingSessionResponse>>({ success: true, data: mapSession(created) });
    }

    if (!existing) return NextResponse.json<ApiResponse<null>>({ success: false, error: 'No active feeding session found' }, { status: 404 });

    const segments = (existing.segments as FeedingSegment[]) || [];
    const closeOpenSegment = (items: FeedingSegment[]) => {
      const next = [...items];
      for (let i = next.length - 1; i >= 0; i--) {
        if (!next[i].end) { next[i] = { ...next[i], end: nowISO }; break; }
      }
      return next;
    };

    if (action === 'update-note') {
      const updated = await prisma.feedingSession.update({ where: { id: existing.id }, data: { note: note?.trim() || null } });
      return NextResponse.json<ApiResponse<FeedingSessionResponse>>({ success: true, data: mapSession(updated) });
    }
    if (action === 'pause') {
      const updated = await prisma.feedingSession.update({ where: { id: existing.id }, data: { status: 'PAUSED', segments: closeOpenSegment(segments) } });
      return NextResponse.json<ApiResponse<FeedingSessionResponse>>({ success: true, data: mapSession(updated) });
    }
    if (action === 'resume') {
      const resumeSide = (side || existing.activeSide) as 'LEFT' | 'RIGHT' | null;
      if (!resumeSide) return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Side is required to resume' }, { status: 400 });
      const updated = await prisma.feedingSession.update({ where: { id: existing.id }, data: { status: 'ACTIVE', activeSide: resumeSide as BreastSide, segments: [...closeOpenSegment(segments), { side: resumeSide, start: nowISO, end: null }] } });
      return NextResponse.json<ApiResponse<FeedingSessionResponse>>({ success: true, data: mapSession(updated) });
    }
    if (action === 'switch') {
      if (!side) return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Side is required to switch' }, { status: 400 });
      const updated = await prisma.feedingSession.update({ where: { id: existing.id }, data: { status: 'ACTIVE', activeSide: side as BreastSide, segments: [...closeOpenSegment(segments), { side, start: nowISO, end: null }] } });
      return NextResponse.json<ApiResponse<FeedingSessionResponse>>({ success: true, data: mapSession(updated) });
    }
    if (action === 'stop') {
      const closedSegments = closeOpenSegment(segments);
      const { leftDuration, rightDuration } = computeDurations(closedSegments);
      const stopAt = toUTC(new Date().toISOString());
      await prisma.$transaction(async (tx) => {
        if (leftDuration > 0) await tx.feedLog.create({ data: { babyId, familyId: authContext.familyId, caretakerId: authContext.caretakerId, time: stopAt, type: 'BREAST', side: 'LEFT', feedDuration: leftDuration, startTime: new Date(stopAt.getTime() - leftDuration * 1000), endTime: stopAt, notes: existing.note } });
        if (rightDuration > 0) await tx.feedLog.create({ data: { babyId, familyId: authContext.familyId, caretakerId: authContext.caretakerId, time: stopAt, type: 'BREAST', side: 'RIGHT', feedDuration: rightDuration, startTime: new Date(stopAt.getTime() - rightDuration * 1000), endTime: stopAt, notes: existing.note } });
        await tx.feedingSession.delete({ where: { id: existing.id } });
      });
      return NextResponse.json<ApiResponse<{ leftDuration: number; rightDuration: number; totalDuration: number }>>({ success: true, data: { leftDuration, rightDuration, totalDuration: leftDuration + rightDuration } });
    }

    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    console.error('Error mutating feeding session:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to update feeding session' }, { status: 500 });
  }
}

export const GET = withAuthContext(handleGet as any);
export const POST = withAuthContext(handlePost as any);
