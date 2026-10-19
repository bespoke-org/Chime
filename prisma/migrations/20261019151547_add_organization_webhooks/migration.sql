-- AlterTable
ALTER TABLE "FormWebhook" ADD COLUMN     "organizationId" TEXT,
ALTER COLUMN "formId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "FormWebhook_organizationId_idx" ON "FormWebhook"("organizationId");

-- AddForeignKey
ALTER TABLE "FormWebhook" ADD CONSTRAINT "FormWebhook_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A webhook belongs to exactly one form or one organization.
ALTER TABLE "FormWebhook" ADD CONSTRAINT "FormWebhook_one_owner" CHECK (("formId" IS NULL) <> ("organizationId" IS NULL));
