-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "timeFormat" TEXT NOT NULL DEFAULT '24h';

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "dateFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY';
