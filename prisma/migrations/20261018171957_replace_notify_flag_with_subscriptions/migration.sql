/*
  Warnings:

  - You are about to drop the column `notifyOnResponse` on the `Form` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Form" DROP COLUMN "notifyOnResponse";

-- CreateTable
CREATE TABLE "FormNotificationSubscription" (
    "formId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormNotificationSubscription_pkey" PRIMARY KEY ("formId","userId")
);

-- CreateIndex
CREATE INDEX "FormNotificationSubscription_userId_idx" ON "FormNotificationSubscription"("userId");

-- AddForeignKey
ALTER TABLE "FormNotificationSubscription" ADD CONSTRAINT "FormNotificationSubscription_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormNotificationSubscription" ADD CONSTRAINT "FormNotificationSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
