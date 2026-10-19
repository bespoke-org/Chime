/*
  Warnings:

  - You are about to drop the column `position` on the `FormWebhook` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `FormWebhook` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "WebhookMode" AS ENUM ('IMMEDIATE', 'DIGEST');

-- CreateEnum
CREATE TYPE "DigestInterval" AS ENUM ('HOURLY', 'DAILY', 'WEEKLY');

-- DropIndex
DROP INDEX "FormWebhook_formId_position_idx";

-- AlterTable
ALTER TABLE "FormWebhook" DROP COLUMN "position",
ADD COLUMN     "digestInterval" "DigestInterval",
ADD COLUMN     "digestTime" TEXT,
ADD COLUMN     "digestWeekday" INTEGER,
ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastDigestAt" TIMESTAMP(3),
ADD COLUMN     "mode" "WebhookMode" NOT NULL DEFAULT 'IMMEDIATE',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "FormWebhook_formId_idx" ON "FormWebhook"("formId");

-- CreateIndex
CREATE INDEX "FormWebhook_mode_enabled_idx" ON "FormWebhook"("mode", "enabled");
