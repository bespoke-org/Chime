-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'ATTACHED');

-- AlterEnum
ALTER TYPE "FormBlockType" ADD VALUE 'FILE_UPLOAD';

-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "responseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attachedAt" TIMESTAMP(3),

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Upload_key_key" ON "Upload"("key");

-- CreateIndex
CREATE INDEX "Upload_formId_status_createdAt_idx" ON "Upload"("formId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Upload_responseId_idx" ON "Upload"("responseId");

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response"("id") ON DELETE SET NULL ON UPDATE CASCADE;
