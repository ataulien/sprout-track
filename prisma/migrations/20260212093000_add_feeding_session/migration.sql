-- CreateTable
CREATE TABLE "FeedingSession" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "activeSide" "BreastSide",
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "segments" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "familyId" TEXT,
    "babyId" TEXT NOT NULL,
    "caretakerId" TEXT,

    CONSTRAINT "FeedingSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedingSession_babyId_idx" ON "FeedingSession"("babyId");
CREATE INDEX "FeedingSession_familyId_idx" ON "FeedingSession"("familyId");
CREATE INDEX "FeedingSession_status_idx" ON "FeedingSession"("status");

-- AddForeignKey
ALTER TABLE "FeedingSession" ADD CONSTRAINT "FeedingSession_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeedingSession" ADD CONSTRAINT "FeedingSession_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "Baby"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedingSession" ADD CONSTRAINT "FeedingSession_caretakerId_fkey" FOREIGN KEY ("caretakerId") REFERENCES "Caretaker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
