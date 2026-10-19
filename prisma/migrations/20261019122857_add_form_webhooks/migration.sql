-- CreateTable
CREATE TABLE "FormWebhook" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FormWebhook_formId_position_idx" ON "FormWebhook"("formId", "position" ASC);

-- AddForeignKey
ALTER TABLE "FormWebhook" ADD CONSTRAINT "FormWebhook_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Move the single webhook of each form into the new table.
INSERT INTO "FormWebhook" ("id", "formId", "url", "secret", "position")
SELECT 'wh' || md5("id"), "id", "webhookUrl", "webhookSecret", 0
FROM "Form"
WHERE "webhookUrl" IS NOT NULL;

-- AlterTable
ALTER TABLE "Form" DROP COLUMN "webhookSecret",
DROP COLUMN "webhookUrl";
