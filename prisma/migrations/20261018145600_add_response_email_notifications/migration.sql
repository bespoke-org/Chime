-- AlterTable
ALTER TABLE "Form" ADD COLUMN     "notifyOnResponse" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notificationEmail" TEXT;
