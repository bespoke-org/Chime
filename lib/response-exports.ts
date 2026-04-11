import { utils, write } from "xlsx";

import { AGREEMENT_ANSWER_VALUES, isQuestionBlock, serializeBlock, type SerializedBlock } from "@/lib/blocks";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { DEFAULT_LOCALE, type AppLocale } from "@/lib/i18n";
import { slugify } from "@/lib/utils";
import { workspaceAccessWhere } from "@/lib/workspaces";

export type ResponseExportFormat = "csv" | "xlsx";

type OwnedFormExportRecord = Awaited<ReturnType<typeof loadOwnedFormResponsesForExport>>;

type ExportAnswerValue = string | string[] | undefined;

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

const exportCopyByLocale: Record<AppLocale, {
  metadataColumns: ResponseExportColumn[];
  questionFallback: string;
  sheetName: string;
  agreed: string;
  notAgreed: string;
}> = {
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
  },
};

function getExportCopy(locale: AppLocale = DEFAULT_LOCALE) {
  return exportCopyByLocale[locale] ?? exportCopyByLocale[DEFAULT_LOCALE];
}

export async function loadOwnedFormResponsesForExport(userId: string, formId: string) {
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

function createQuestionColumnLabel(block: SerializedBlock, questionIndex: number, seenLabels: Map<string, number>, locale: AppLocale) {
  const copy = getExportCopy(locale);
  const baseLabel = block.title.trim() || copy.questionFallback.replace("{number}", String(questionIndex));
  const occurrence = (seenLabels.get(baseLabel) ?? 0) + 1;
  seenLabels.set(baseLabel, occurrence);

  return occurrence === 1 ? baseLabel : `${baseLabel} (${occurrence})`;
}

export function serializeExportAnswer(value: ExportAnswerValue, block?: SerializedBlock, locale: AppLocale = DEFAULT_LOCALE) {
  if (Array.isArray(value)) {
    return value.join(" | ");
  }

  if (typeof value !== "string") {
    return "";
  }

  if (block?.type === "AGREEMENT") {
    const copy = getExportCopy(locale);
    return value === AGREEMENT_ANSWER_VALUES.AGREED ? copy.agreed : copy.notAgreed;
  }

  return value;
}

export function buildResponseExportDataset(form: OwnedFormExportRecord, locale: AppLocale = DEFAULT_LOCALE): ResponseExportDataset {
  const questionBlocks = form.blocks.map(serializeBlock).filter((block) => isQuestionBlock(block.type));
  const seenLabels = new Map<string, number>();
  const copy = getExportCopy(locale);

  const columns = [
    ...copy.metadataColumns,
    ...questionBlocks.map((block, index) => ({
      key: block.id,
      label: createQuestionColumnLabel(block, index + 1, seenLabels, locale),
      blockId: block.id,
    })),
  ];
  const questionBlocksById = new Map(questionBlocks.map((block) => [block.id, block]));

  const rows = form.responses.map((response, index) => {
    const answers =
      typeof response.answersJson === "object" && response.answersJson && !Array.isArray(response.answersJson)
        ? (response.answersJson as Record<string, ExportAnswerValue>)
        : {};

    const values = columns.reduce<Record<string, string>>((accumulator, column) => {
      if (column.key === "submissionNumber") {
        accumulator[column.key] = String(index + 1);
        return accumulator;
      }

      if (column.key === "submittedAt") {
        accumulator[column.key] = response.submittedAt.toISOString();
        return accumulator;
      }

      if (column.key === "responseId") {
        accumulator[column.key] = response.id;
        return accumulator;
      }

      accumulator[column.key] = serializeExportAnswer(answers[column.key], questionBlocksById.get(column.key), locale);
      return accumulator;
    }, {});

    return { values };
  });

  return {
    columns,
    rows,
  };
}

function escapeCsvCell(value: string) {
  if (!/[",\n\r]/.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '""')}"`;
}

export function createCsvExportBuffer(dataset: ResponseExportDataset) {
  const headerRow = dataset.columns.map((column) => escapeCsvCell(column.label)).join(",");
  const dataRows = dataset.rows.map((row) => dataset.columns.map((column) => escapeCsvCell(row.values[column.key] ?? "")).join(","));
  const content = [headerRow, ...dataRows].join("\r\n");

  return Buffer.from(`\uFEFF${content}`, "utf8");
}

export function createXlsxExportBuffer(dataset: ResponseExportDataset, locale: AppLocale = DEFAULT_LOCALE) {
  const worksheet = utils.aoa_to_sheet([
    dataset.columns.map((column) => column.label),
    ...dataset.rows.map((row) => dataset.columns.map((column) => row.values[column.key] ?? "")),
  ]);
  const workbook = utils.book_new();

  utils.book_append_sheet(workbook, worksheet, getExportCopy(locale).sheetName);

  return write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  });
}

export function getResponseExportFilename(slug: string, format: ResponseExportFormat) {
  const safeSlug = slugify(slug) || "form";
  return `${safeSlug}-responses.${format}`;
}

export function getResponseExportContentType(format: ResponseExportFormat) {
  return format === "csv"
    ? "text/csv; charset=utf-8"
    : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}

export function parseResponseExportFormat(value: string | null): ResponseExportFormat {
  if (value === "csv" || value === "xlsx") {
    return value;
  }

  throw new AppError("Unsupported export format.", 422);
}

export async function createOwnedFormResponseExport(userId: string, formId: string, format: ResponseExportFormat, locale: AppLocale = DEFAULT_LOCALE) {
  const form = await loadOwnedFormResponsesForExport(userId, formId);
  const dataset = buildResponseExportDataset(form, locale);
  const filename = getResponseExportFilename(form.slug, format);
  const contentType = getResponseExportContentType(format);
  const body = format === "csv" ? createCsvExportBuffer(dataset) : createXlsxExportBuffer(dataset, locale);

  return {
    filename,
    contentType,
    body,
    dataset,
    form,
  };
}
