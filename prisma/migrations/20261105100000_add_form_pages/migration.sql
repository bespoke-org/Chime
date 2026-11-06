-- AlterTable
ALTER TABLE "Form" ADD COLUMN     "pagesJson" JSONB;
ALTER TABLE "FormBlock" ADD COLUMN     "pageId" TEXT;

-- Backfill: one page per existing block. Each block gets a fresh page id;
-- the ids land in the form's registry in block position order.
CREATE TEMP TABLE "_form_block_page" AS
SELECT
  "formId",
  "id" AS "blockId",
  gen_random_uuid()::text AS "pageId",
  row_number() OVER (PARTITION BY "formId" ORDER BY "position" ASC, "id" ASC) AS "blockOrder"
FROM "FormBlock";

UPDATE "FormBlock" AS b
SET "pageId" = p."pageId"
FROM "_form_block_page" AS p
WHERE p."blockId" = b."id";

UPDATE "Form" AS f
SET "pagesJson" = r."pages"
FROM (
  SELECT
    "formId",
    jsonb_agg(jsonb_build_object('id', "pageId") ORDER BY "blockOrder" ASC) AS "pages"
  FROM "_form_block_page"
  GROUP BY "formId"
) AS r
WHERE r."formId" = f."id";

-- A form without blocks gets an empty registry.
UPDATE "Form" SET "pagesJson" = '[]'::jsonb WHERE "pagesJson" IS NULL;

DROP TABLE "_form_block_page";
