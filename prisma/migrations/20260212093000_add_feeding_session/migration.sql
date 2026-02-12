-- CreateTable
CREATE TABLE "FeedingSession" (
    "id" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "activeSide" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "segments" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "familyId" TEXT,
    "babyId" TEXT NOT NULL,
    "caretakerId" TEXT,

    CONSTRAINT "FeedingSession_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FeedingSession_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FeedingSession_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "Baby" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FeedingSession_caretakerId_fkey" FOREIGN KEY ("caretakerId") REFERENCES "Caretaker" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FeedingSession_babyId_idx" ON "FeedingSession"("babyId");
CREATE INDEX "FeedingSession_familyId_idx" ON "FeedingSession"("familyId");
CREATE INDEX "FeedingSession_status_idx" ON "FeedingSession"("status");
