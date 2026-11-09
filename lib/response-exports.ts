import { utils, write } from "xlsx";

import {
  AGREEMENT_ANSWER_VALUES,
  isQuestionBlock,
  serializeBlock,
  type SerializedBlock,
} from "@/lib/blocks";
import { getAppBaseUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { DEFAULT_LOCALE, type AppLocale } from "@/lib/i18n";
import {
  groupResponseDetailBlocks,
  parseStoredAnswers,
  resolveStoredAnswerView,
  restoreVisitedBlocksFromSnapshot,
} from "@/lib/response-review";
import { parsePageRegistry } from "@/lib/pages";
import type { StoredAnswerValue } from "@/lib/form-types";
import { buildUploadDownloadUrl } from "@/lib/uploads";
import { slugify } from "@/lib/utils";
import { workspaceAccessWhere } from "@/lib/workspaces";

export type ResponseExportFormat = "csv" | "xlsx";

type OwnedFormExportRecord = Awaited<
  ReturnType<typeof loadOwnedFormResponsesForExport>
>;

export type ResponseExportColumn = {
  key: string;
  label: string;
  blockId?: string;
};

export type ResponseExportRow = {
  values: Record<string, string>;
};

export type ResponseExportDataset = {
  columns: ResponseExportColumn[];
  rows: ResponseExportRow[];
};

const exportCopyByLocale: Record<
  AppLocale,
  {
    metadataColumns: ResponseExportColumn[];
    questionFallback: string;
    sheetName: string;
    agreed: string;
    notAgreed: string;
    repeatingPage: string;
    instance: string;
    pageFallback: string;
  }
> = {
  en: {
    metadataColumns: [
      { key: "submissionNumber", label: "Submission #" },
      { key: "submittedAt", label: "Submitted at" },
      { key: "responseId", label: "Response ID" },
    ],
    questionFallback: "Question {number}",
    sheetName: "Responses",
    agreed: "Agree",
    notAgreed: "Do not agree",
    repeatingPage: "Repeating page",
    instance: "Instance #",
    pageFallback: "Page {number}",
  },
  ru: {
    metadataColumns: [
      { key: "submissionNumber", label: "Ответ №" },
      { key: "submittedAt", label: "Дата ответа" },
      { key: "responseId", label: "ID ответа" },
    ],
    questionFallback: "Вопрос {number}",
    sheetName: "Ответы",
    agreed: "Согласен",
    notAgreed: "Не согласен",
    repeatingPage: "Повторяющаяся страница",
    instance: "Экземпляр №",
    pageFallback: "Страница {number}",
  },
};

function getExportCopy(locale: AppLocale = DEFAULT_LOCALE) {
  return exportCopyByLocale[locale] ?? exportCopyByLocale[DEFAULT_LOCALE];
}

export async function loadOwnedFormResponsesForExport(
  userId: string,
  formId: string,
) {
  const form = await db.form.findFirst({
    where: {
      id: formId,
      ...workspaceAccessWhere(userId),
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
      blocks: {
        orderBy: {
          position: "asc",
        },
      },
      responses: {
        orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
      },
    },
  });

  if (!form) {
    throw new AppError("Form not found.", 404);
  }

  return form;
}

function createQuestionColumnLabel(
  block: SerializedBlock,
  questionIndex: number,
  seenLabels: Map<string, number>,
  locale: AppLocale,
) {
  const copy = getExportCopy(locale);
  const baseLabel =
    block.title.trim() ||
    copy.questionFallback.replace("{number}", String(questionIndex));
  const occurrence = (seenLabels.get(baseLabel) ?? 0) + 1;
  seenLabels.set(baseLabel, occurrence);

  return occurrence === 1 ? baseLabel : `${baseLabel} (${occurrence})`;
}

export type ExportFileLink = {
  baseUrl: string;
  formId: string;
};

// A file answer is stored as the upload id; outside the app it is written as
// the authenticated download URL so a creator can open it from the sheet.
// Notifications can summarize a repeating block with "; ". Spreadsheet
// exports instead serialize each instance into its own row below.
export function serializeExportAnswer(
  value: StoredAnswerValue | undefined,
  block?: Pick<SerializedBlock, "type">,
  locale: AppLocale = DEFAULT_LOCALE,
  fileLink?: ExportFileLink,
) {
  if (block) {
    const view = resolveStoredAnswerView(block, value);

    if (view.kind === "instances") {
      return view.entries
        .map((entry) =>
          serializeFlatExportAnswer(entry.value, block, locale, fileLink),
        )
        .join("; ");
    }

    return serializeFlatExportAnswer(view.value, block, locale, fileLink);
  }

  return serializeFlatExportAnswer(value, block, locale, fileLink);
}

function serializeFlatExportAnswer(
  value: StoredAnswerValue | undefined,
  block?: Pick<SerializedBlock, "type">,
  locale: AppLocale = DEFAULT_LOCALE,
  fileLink?: ExportFileLink,
) {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .join(" | ");
  }

  if (typeof value !== "string") {
    return "";
  }

  if (block?.type === "AGREEMENT") {
    const copy = getExportCopy(locale);
    return value === AGREEMENT_ANSWER_VALUES.AGREED
      ? copy.agreed
      : copy.notAgreed;
  }

  if (block?.type === "FILE_UPLOAD" && fileLink) {
    return buildUploadDownloadUrl(fileLink.baseUrl, fileLink.formId, value);
  }

  return value;
}

export function buildResponseExportDataset(
  form: OwnedFormExportRecord,
  locale: AppLocale = DEFAULT_LOCALE,
  baseUrl: string = getAppBaseUrl(),
): ResponseExportDataset {
  const fileLink: ExportFileLink = { baseUrl, formId: form.id };
  const questionBlocks = form.blocks
    .map(serializeBlock)
    .filter((block) => isQuestionBlock(block.type));
  const seenLabels = new Map<string, number>();
  const copy = getExportCopy(locale);
  const responses = form.responses.map((response) => {
    const answers = parseStoredAnswers(response.answersJson);
    const savedBlocks = new Map(
      restoreVisitedBlocksFromSnapshot(
        response.formSnapshotJson,
        questionBlocks,
        form.id,
        response.submittedAt,
      ).map((block) => [block.id, block]),
    );
    // Keep the existing export columns, but prefer the submitted grouping
    // and types when a question or its page has since been edited.
    const sections = groupResponseDetailBlocks(
      questionBlocks.map((block) => savedBlocks.get(block.id) ?? block),
      answers,
    );
    return { response, answers, sections };
  });
  const pageNames = new Map(
    parsePageRegistry(form.pagesJson).map((page) => [page.id, page.name]),
  );
  const pageLabels = new Map<string, string>();
  const usedPageLabels = new Set<string>();
  for (const { sections } of responses) {
    for (const section of sections) {
      if (section.kind !== "repeatedPage" || pageLabels.has(section.id))
        continue;
      const baseLabel =
        section.name ||
        pageNames.get(section.id) ||
        copy.pageFallback.replace("{number}", String(pageLabels.size + 1));
      let label = baseLabel;
      let suffix = 2;
      while (usedPageLabels.has(label)) label = `${baseLabel} (${suffix++})`;
      pageLabels.set(section.id, label);
      usedPageLabels.add(label);
    }
  }

  const columns = [
    ...copy.metadataColumns,
    ...(pageLabels.size
      ? [
          { key: "repeatingPage", label: copy.repeatingPage },
          { key: "instanceNumber", label: copy.instance },
        ]
      : []),
    ...questionBlocks.map((block, index) => ({
      key: block.id,
      label: createQuestionColumnLabel(block, index + 1, seenLabels, locale),
      blockId: block.id,
    })),
  ];
  const rows = responses.flatMap(({ response, answers, sections }, index) => {
    const common = Object.fromEntries(
      columns.map((column) => [column.key, ""]),
    );
    common.submissionNumber = String(index + 1);
    common.submittedAt = response.submittedAt.toISOString();
    common.responseId = response.id;
    for (const section of sections) {
      if (section.kind !== "block") continue;
      common[section.block.id] = serializeExportAnswer(
        answers[section.block.id],
        section.block,
        locale,
        fileLink,
      );
    }

    const instanceRows: ResponseExportRow[] = [];
    for (const section of sections) {
      if (section.kind !== "repeatedPage") continue;
      const views = section.blocks.map((block) => ({
        block,
        view: resolveStoredAnswerView(block, answers[block.id]),
      }));
      for (
        let instanceIndex = 0;
        instanceIndex < section.instanceCount;
        instanceIndex++
      ) {
        const values = {
          ...common,
          repeatingPage: pageLabels.get(section.id)!,
          instanceNumber: String(instanceIndex + 1),
        } as Record<string, string>;
        for (const { block, view } of views) {
          const value =
            view.kind === "instances"
              ? view.entries.find(
                  (entry) => entry.instanceIndex === instanceIndex,
                )?.value
              : instanceIndex === 0
                ? view.value
                : undefined;
          values[block.id] = serializeFlatExportAnswer(
            value,
            block,
            locale,
            fileLink,
          );
        }
        instanceRows.push({ values });
      }
    }
    return instanceRows.length ? instanceRows : [{ values: common }];
  });

  return {
    columns,
    rows,
  };
}

const FORMULA_TRIGGER_PATTERN = /^[=+\-@\t\r]/;
const PLAIN_NUMBER_PATTERN = /^-?\d+(\.\d+)?$/;
const XLSX_CELL_TEXT_LIMIT = 32_767;

// Spreadsheet apps evaluate CSV cells that start with a formula trigger.
// Negative numbers share the "-" trigger but are left alone so they stay numeric.
function neutralizeFormulaCell(value: string) {
  if (
    !FORMULA_TRIGGER_PATTERN.test(value) ||
    PLAIN_NUMBER_PATTERN.test(value)
  ) {
    return value;
  }

  return `'${value}`;
}

function escapeCsvCell(rawValue: string) {
  const value = neutralizeFormulaCell(rawValue);

  if (!/[",\n\r]/.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '""')}"`;
}

function truncateXlsxCell(value: string) {
  return value.length > XLSX_CELL_TEXT_LIMIT
    ? value.slice(0, XLSX_CELL_TEXT_LIMIT)
    : value;
}

export function createCsvExportBuffer(dataset: ResponseExportDataset) {
  const headerRow = dataset.columns
    .map((column) => escapeCsvCell(column.label))
    .join(",");
  const dataRows = dataset.rows.map((row) =>
    dataset.columns
      .map((column) => escapeCsvCell(row.values[column.key] ?? ""))
      .join(","),
  );
  const content = [headerRow, ...dataRows].join("\r\n");

  return Buffer.from(`\uFEFF${content}`, "utf8");
}

export function createXlsxExportBuffer(
  dataset: ResponseExportDataset,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  const worksheet = utils.aoa_to_sheet([
    dataset.columns.map((column) => truncateXlsxCell(column.label)),
    ...dataset.rows.map((row) =>
      dataset.columns.map((column) =>
        truncateXlsxCell(row.values[column.key] ?? ""),
      ),
    ),
  ]);
  const workbook = utils.book_new();

  utils.book_append_sheet(workbook, worksheet, getExportCopy(locale).sheetName);

  return write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  });
}

export function getResponseExportFilename(
  slug: string,
  format: ResponseExportFormat,
) {
  const safeSlug = slugify(slug) || "form";
  return `${safeSlug}-responses.${format}`;
}

export function getResponseExportContentType(format: ResponseExportFormat) {
  return format === "csv"
    ? "text/csv; charset=utf-8"
    : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}

export function parseResponseExportFormat(
  value: string | null,
): ResponseExportFormat {
  if (value === "csv" || value === "xlsx") {
    return value;
  }

  throw new AppError("Unsupported export format.", 422);
}

export async function createOwnedFormResponseExport(
  userId: string,
  formId: string,
  format: ResponseExportFormat,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  const form = await loadOwnedFormResponsesForExport(userId, formId);
  const dataset = buildResponseExportDataset(form, locale);
  const filename = getResponseExportFilename(form.slug, format);
  const contentType = getResponseExportContentType(format);
  const body =
    format === "csv"
      ? createCsvExportBuffer(dataset)
      : createXlsxExportBuffer(dataset, locale);

  return {
    filename,
    contentType,
    body,
    dataset,
    form,
  };
}
