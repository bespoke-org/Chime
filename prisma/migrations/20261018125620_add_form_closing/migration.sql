-- AlterTable
ALTER TABLE "Form" ADD COLUMN     "closedManually" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "closedMessage" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "closesAt" TIMESTAMP(3),
ADD COLUMN     "maxResponses" INTEGER;
