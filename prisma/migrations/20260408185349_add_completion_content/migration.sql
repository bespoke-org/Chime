-- AlterTable
ALTER TABLE "Form" ADD COLUMN     "completionLinkLabel" TEXT,
ADD COLUMN     "completionLinkUrl" TEXT,
ADD COLUMN     "completionMessage" TEXT NOT NULL DEFAULT 'Your response was submitted anonymously. The creator can review your answers, but they are not linked to a login or account.',
ADD COLUMN     "completionTitle" TEXT NOT NULL DEFAULT 'Thanks for taking the time.';
