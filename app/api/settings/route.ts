import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse } from '../types';
import { Settings, Prisma } from '@prisma/client';
import { withAuthContext, AuthResult } from '../utils/auth';
import { checkWritePermission } from '../utils/writeProtection';

async function resolveTargetFamilyId(req: NextRequest, authContext: AuthResult): Promise<string | null> {
  const { familyId: userFamilyId, isSetupAuth, isSysAdmin, isAccountAuth } = authContext;

  let targetFamilyId = userFamilyId;
  if (!userFamilyId && (isSetupAuth || isSysAdmin || isAccountAuth)) {
    const { searchParams } = new URL(req.url);
    const queryFamilyId = searchParams.get('familyId');
    if (queryFamilyId) {
      targetFamilyId = queryFamilyId;
    }
  }

  if (!targetFamilyId) return null;

  const family = await prisma.family.findUnique({
    where: { id: targetFamilyId },
    select: { id: true },
  });

  return family?.id ?? null;
}

function getDefaultDateFormat(req: NextRequest): string {
  const acceptLanguage = req.headers.get('accept-language') || '';
  const isFrenchLocale = acceptLanguage.toLowerCase().startsWith('fr');
  return isFrenchLocale ? 'DD/MM/YYYY' : 'MM/DD/YYYY';
}

async function handleGet(req: NextRequest, authContext: AuthResult) {
  try {
    const targetFamilyId = await resolveTargetFamilyId(req, authContext);

    if (!targetFamilyId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Family not found or user is not associated with a valid family.' },
        { status: 404 }
      );
    }

    let settings = await prisma.settings.findFirst({
      where: { familyId: targetFamilyId },
    });

    if (!settings) {
      const defaultDateFormat = getDefaultDateFormat(req);

      settings = await prisma.settings.create({
        data: {
          familyName: 'My Family',
          defaultBottleUnit: 'OZ',
          defaultSolidsUnit: 'TBSP',
          defaultHeightUnit: 'IN',
          defaultWeightUnit: 'LB',
          defaultTempUnit: 'F',
          timeFormat: '24h',
          dateFormat: defaultDateFormat,
          familyId: targetFamilyId,
        },
      });
    } else if (!settings.timeFormat || !settings.dateFormat) {
      const defaultDateFormat = getDefaultDateFormat(req);

      settings = await prisma.settings.update({
        where: { id: settings.id },
        data: {
          timeFormat: settings.timeFormat || '24h',
          dateFormat: settings.dateFormat || defaultDateFormat,
        },
      });
    }

    return NextResponse.json<ApiResponse<Settings>>({
      success: true,
      data: settings,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return NextResponse.json<ApiResponse<Settings>>(
        { success: false, error: 'Family not found or unavailable for settings creation.' },
        { status: 404 }
      );
    }

    console.error('Error fetching settings:', error);
    return NextResponse.json<ApiResponse<Settings>>(
      {
        success: false,
        error: 'Failed to fetch settings',
      },
      { status: 500 }
    );
  }
}

async function handlePut(req: NextRequest, authContext: AuthResult) {
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) {
    return writeCheck.response!;
  }

  try {
    const targetFamilyId = await resolveTargetFamilyId(req, authContext);

    if (!targetFamilyId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Family not found or user is not associated with a valid family.' },
        { status: 404 }
      );
    }

    const body = await req.json();

    const existingSettings = await prisma.settings.findFirst({
      where: { familyId: targetFamilyId },
    });

    if (!existingSettings) {
      return NextResponse.json<ApiResponse<Settings>>(
        {
          success: false,
          error: 'Settings not found for this family.',
        },
        { status: 404 }
      );
    }

    const data: Partial<Settings> = {};
    const allowedFields: (keyof Settings)[] = [
      'familyName', 'securityPin', 'authType', 'defaultBottleUnit', 'defaultSolidsUnit',
      'defaultHeightUnit', 'defaultWeightUnit', 'defaultTempUnit',
      'enableDebugTimer', 'enableDebugTimezone', 'timeFormat', 'dateFormat'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'timeFormat' && !['24h', '12h'].includes(body[field])) {
          return NextResponse.json<ApiResponse<Settings>>(
            { success: false, error: 'Invalid time format' },
            { status: 400 }
          );
        }
        if (field === 'dateFormat' && !['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].includes(body[field])) {
          return NextResponse.json<ApiResponse<Settings>>(
            { success: false, error: 'Invalid date format' },
            { status: 400 }
          );
        }
        (data as any)[field] = body[field];
      }
    }

    const settings = await prisma.settings.update({
      where: { id: existingSettings.id },
      data,
    });

    if (body.securityPin !== undefined) {
      try {
        const systemCaretaker = await prisma.caretaker.findFirst({
          where: {
            loginId: '00',
            familyId: targetFamilyId
          }
        });

        if (systemCaretaker) {
          await prisma.caretaker.update({
            where: { id: systemCaretaker.id },
            data: { securityPin: body.securityPin }
          });
          console.log('Updated system caretaker security pin to match settings.');
        } else {
          console.log('System caretaker not found, skipping pin sync.');
        }
      } catch (error) {
        console.error('Error updating system caretaker pin (non-fatal):', error);
      }
    }

    return NextResponse.json<ApiResponse<Settings>>({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json<ApiResponse<Settings>>(
      {
        success: false,
        error: 'Failed to update settings',
      },
      { status: 500 }
    );
  }
}

export const GET = withAuthContext(handleGet);
export const PUT = withAuthContext(handlePut);
