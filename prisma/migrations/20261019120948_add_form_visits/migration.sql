-- CreateTable
CREATE TABLE "FormVisit" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),

    CONSTRAINT "FormVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FormVisit_formId_visitorId_key" ON "FormVisit"("formId", "visitorId");

-- AddForeignKey
ALTER TABLE "FormVisit" ADD CONSTRAINT "FormVisit_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
