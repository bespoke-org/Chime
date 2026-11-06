import { describe, expect, test } from "bun:test";

import type { FormBlock, FormBlockType } from "@prisma/client";
import { read } from "xlsx";

const { mock } = (await import("bun:test")) as unknown as {
  mock: {
    module: (specifier: string, factory: () => Record<string, unknown>) => void;
  };
};

mock.module("@/lib/db", () => ({ db: {} }));

const {
  buildResponseExportDataset,
  createCsvExportBuffer,
  createXlsxExportBuffer,
  getResponseExportFilename,
  parseResponseExportFormat,
  serializeExportAnswer,
} = await import("@/lib/response-exports");
const { serializeBlock } = await import("@/lib/blocks");

type ExportForm = Parameters<typeof buildResponseExportDataset>[0];
type ExportResponse = ExportForm["responses"][number];

const now = new Date("2026-04-14T00:00:00.000Z");

function createBlock(
  id: string,
  type: FormBlockType,
  overrides: Partial<FormBlock> = {},
): FormBlock {
  return {
    id,
    formId: "form-1",
    type,
    title: id,
    description: "",
    required: false,
    position: 0,
    pageId: null,
    createdAt: now,
    updatedAt: now,
    config: {},
    ...overrides,
  };
}

function createResponse(
  id: string,
  answersJson: unknown,
  submittedAt = now,
): ExportResponse {
  return {
    id,
    formId: "form-1",
    answersJson,
    formSnapshotJson: [],
    submittedAt,
  } as ExportResponse;
}

function createForm(
  blocks: FormBlock[],
  responses: ExportResponse[],
): ExportForm {
  return {
    id: "form-1",
    slug: "survey",
    blocks: blocks.map((block, index) => ({ ...block, position: index })),
    responses,
    organization: null,
  } as unknown as ExportForm;
}

function csvText(buffer: Buffer) {
  return buffer.toString("utf8");
}

function csvLines(buffer: Buffer) {
  return csvText(buffer).replace(/^﻿/, "").split("\r\n");
}

function readXlsxSheet(buffer: Buffer) {
  const workbook = read(buffer);
  const sheetName = workbook.SheetNames[0];
  return { sheetName, sheet: workbook.Sheets[sheetName] };
}

function questionValues(form: ExportForm, locale?: "en" | "ru") {
  const dataset = buildResponseExportDataset(form, locale);
  return dataset.rows.map((row) =>
    dataset.columns
      .filter((column) => column.blockId)
      .map((column) => row.values[column.key]),
  );
}

describe("buildResponseExportDataset columns", () => {
  test("keeps metadata columns first and question columns in block order", () => {
    const form = createForm(
      [
        createBlock("intro", "TEXT"),
        createBlock("name", "SHORT_TEXT", { title: "Name" }),
        createBlock("note", "TEXT"),
        createBlock("age", "NUMBER", { title: "Age" }),
      ],
      [],
    );

    const dataset = buildResponseExportDataset(form, "en");

    expect(JSON.stringify(dataset.columns.map((column) => column.label))).toBe(
      JSON.stringify([
        "Submission #",
        "Submitted at",
        "Response ID",
        "Name",
        "Age",
      ]),
    );
    expect(
      JSON.stringify(dataset.columns.map((column) => column.blockId ?? null)),
    ).toBe(JSON.stringify([null, null, null, "name", "age"]));
  });

  test("numbers duplicate question titles from the second occurrence", () => {
    const form = createForm(
      [
        createBlock("a", "SHORT_TEXT", { title: "Email" }),
        createBlock("b", "SHORT_TEXT", { title: "Email" }),
        createBlock("c", "SHORT_TEXT", { title: " Email " }),
      ],
      [],
    );

    const labels = buildResponseExportDataset(form, "en")
      .columns.filter((column) => column.blockId)
      .map((column) => column.label);

    expect(JSON.stringify(labels)).toBe(
      JSON.stringify(["Email", "Email (2)", "Email (3)"]),
    );
  });

  test("falls back to a localized question number for empty titles", () => {
    const blocks = [
      createBlock("intro", "TEXT"),
      createBlock("a", "SHORT_TEXT", { title: "" }),
      createBlock("b", "SHORT_TEXT", { title: "   " }),
    ];

    const en = buildResponseExportDataset(createForm(blocks, []), "en")
      .columns.filter((column) => column.blockId)
      .map((column) => column.label);
    const ru = buildResponseExportDataset(createForm(blocks, []), "ru")
      .columns.filter((column) => column.blockId)
      .map((column) => column.label);

    expect(JSON.stringify(en)).toBe(
      JSON.stringify(["Question 1", "Question 2"]),
    );
    expect(JSON.stringify(ru)).toBe(JSON.stringify(["Вопрос 1", "Вопрос 2"]));
  });

  test("a fallback label colliding with a real title is numbered too", () => {
    const form = createForm(
      [
        createBlock("a", "SHORT_TEXT", { title: "Question 2" }),
        createBlock("b", "SHORT_TEXT", { title: "" }),
      ],
      [],
    );

    const labels = buildResponseExportDataset(form, "en")
      .columns.filter((column) => column.blockId)
      .map((column) => column.label);

    expect(JSON.stringify(labels)).toBe(
      JSON.stringify(["Question 2", "Question 2 (2)"]),
    );
  });
});

describe("buildResponseExportDataset rows", () => {
  test("drops answers for blocks that no longer exist and blanks missing answers", () => {
    const form = createForm(
      [createBlock("name", "SHORT_TEXT"), createBlock("age", "NUMBER")],
      [createResponse("r1", { name: "Ada", deleted: "ghost" })],
    );

    const dataset = buildResponseExportDataset(form, "en");

    expect(JSON.stringify(questionValues(form))).toBe(
      JSON.stringify([["Ada", ""]]),
    );
    expect(JSON.stringify(Object.keys(dataset.rows[0].values))).toBe(
      JSON.stringify([
        "submissionNumber",
        "submittedAt",
        "responseId",
        "name",
        "age",
      ]),
    );
  });

  test("tolerates answersJson that is not an object", () => {
    const form = createForm(
      [createBlock("name", "SHORT_TEXT")],
      [
        createResponse("r1", null),
        createResponse("r2", ["Ada"]),
        createResponse("r3", "Ada"),
        createResponse("r4", 42),
      ],
    );

    expect(JSON.stringify(questionValues(form))).toBe(
      JSON.stringify([[""], [""], [""], [""]]),
    );
  });

  test("numbers submissions sequentially and formats the timestamp as ISO", () => {
    const form = createForm(
      [createBlock("name", "SHORT_TEXT")],
      [
        createResponse("r1", {}, new Date("2026-01-01T10:00:00.000Z")),
        createResponse("r2", {}, new Date("2026-01-02T10:00:00.000Z")),
      ],
    );

    const rows = buildResponseExportDataset(form, "en").rows;

    expect(rows[0].values.submissionNumber).toBe("1");
    expect(rows[1].values.submissionNumber).toBe("2");
    expect(rows[1].values.submittedAt).toBe("2026-01-02T10:00:00.000Z");
    expect(rows[1].values.responseId).toBe("r2");
  });

  test("joins multiple-choice values with a pipe even when an option contains one", () => {
    const form = createForm(
      [createBlock("colors", "MULTIPLE_CHOICE")],
      [createResponse("r1", { colors: ["red | blue", "green"] })],
    );

    expect(questionValues(form)[0][0]).toBe("red | blue | green");
  });

  test("ignores non-string entries inside a stored multiple-choice answer", () => {
    const form = createForm(
      [createBlock("colors", "MULTIPLE_CHOICE")],
      [createResponse("r1", { colors: ["red", 1, null, { a: 1 }, "blue"] })],
    );

    expect(questionValues(form)[0][0]).toBe("red | blue");
  });

  test("renders non-string scalar answers as empty", () => {
    const form = createForm(
      [createBlock("age", "NUMBER")],
      [
        createResponse("r1", { age: 42 }),
        createResponse("r2", { age: true }),
        createResponse("r3", { age: { value: 1 } }),
      ],
    );

    expect(JSON.stringify(questionValues(form))).toBe(
      JSON.stringify([[""], [""], [""]]),
    );
  });
});

describe("serializeExportAnswer agreement", () => {
  const agreement = serializeBlock(createBlock("terms", "AGREEMENT"));

  test("localizes agreement answers", () => {
    expect(serializeExportAnswer("agreed", agreement, "en")).toBe("Agree");
    expect(serializeExportAnswer("not_agreed", agreement, "en")).toBe(
      "Do not agree",
    );
    expect(serializeExportAnswer("agreed", agreement, "ru")).toBe("Согласен");
    expect(serializeExportAnswer("not_agreed", agreement, "ru")).toBe(
      "Не согласен",
    );
  });

  test("maps an unknown agreement value to the negative label", () => {
    expect(serializeExportAnswer("yes", agreement, "en")).toBe("Do not agree");
    expect(serializeExportAnswer("AGREED", agreement, "en")).toBe(
      "Do not agree",
    );
  });

  test("leaves the raw value alone for other block types", () => {
    const text = serializeBlock(createBlock("name", "SHORT_TEXT"));

    expect(serializeExportAnswer("agreed", text, "en")).toBe("agreed");
    expect(serializeExportAnswer("agreed", undefined, "en")).toBe("agreed");
  });
});

describe("createCsvExportBuffer", () => {
  test("starts with a BOM, uses CRLF rows and keeps the header for an empty dataset", () => {
    const form = createForm(
      [createBlock("name", "SHORT_TEXT", { title: "Name" })],
      [],
    );
    const buffer = createCsvExportBuffer(
      buildResponseExportDataset(form, "en"),
    );
    const text = csvText(buffer);

    expect(text.startsWith("﻿")).toBe(true);
    expect(text).toBe("﻿Submission #,Submitted at,Response ID,Name");
    expect(text.includes("\n")).toBe(false);
  });

  test("quotes cells and header labels containing commas, quotes or line breaks", () => {
    const form = createForm(
      [
        createBlock("a", "SHORT_TEXT", { title: 'Say "hi", please' }),
        createBlock("b", "LONG_TEXT", { title: "Story" }),
        createBlock("c", "LONG_TEXT", { title: "Note" }),
      ],
      [
        createResponse("r1", {
          a: 'He said "no"',
          b: "line one\r\nline two",
          c: "first\nsecond",
        }),
      ],
    );

    const lines = csvLines(
      createCsvExportBuffer(buildResponseExportDataset(form, "en")),
    );

    expect(lines[0]).toBe(
      'Submission #,Submitted at,Response ID,"Say ""hi"", please",Story,Note',
    );
    expect(lines.length).toBe(3);
    expect(lines.slice(1).join("\r\n")).toBe(
      `1,${now.toISOString()},r1,"He said ""no""","line one\r\nline two","first\nsecond"`,
    );
  });

  test("neutralizes cells that a spreadsheet would evaluate as formulas", () => {
    const form = createForm(
      [
        createBlock("a", "SHORT_TEXT"),
        createBlock("b", "SHORT_TEXT"),
        createBlock("c", "SHORT_TEXT"),
        createBlock("d", "SHORT_TEXT"),
        createBlock("e", "SHORT_TEXT"),
        createBlock("f", "SHORT_TEXT"),
      ],
      [
        createResponse("r1", {
          a: '=HYPERLINK("http://evil","x")',
          b: "+1+1",
          c: "-cmd|' /C calc'!A0",
          d: "@SUM(A1)",
          e: "\tleading tab",
          f: "\rleading cr",
        }),
      ],
    );

    const line = csvLines(
      createCsvExportBuffer(buildResponseExportDataset(form, "en")),
    )[1];

    expect(line.includes(`"'=HYPERLINK(""http://evil"",""x"")"`)).toBe(true);
    expect(line.includes(",'+1+1,")).toBe(true);
    expect(line.includes(`,'-cmd|' /C calc'!A0,`)).toBe(true);
    expect(line.includes(",'@SUM(A1),")).toBe(true);
    expect(line.includes(`,'\tleading tab,`)).toBe(true);
    expect(line.includes(`"'\rleading cr"`)).toBe(true);
  });

  test("neutralizes a formula-like header label", () => {
    const form = createForm(
      [createBlock("a", "SHORT_TEXT", { title: "=1+1" })],
      [],
    );

    const header = csvLines(
      createCsvExportBuffer(buildResponseExportDataset(form, "en")),
    )[0];

    expect(header.endsWith(",'=1+1")).toBe(true);
  });

  test("keeps plain negative and decimal numbers unquoted and readable", () => {
    const form = createForm(
      [
        createBlock("a", "NUMBER"),
        createBlock("b", "NUMBER"),
        createBlock("c", "NUMBER"),
      ],
      [createResponse("r1", { a: "-5", b: "-0.25", c: "-5 apples" })],
    );

    const line = csvLines(
      createCsvExportBuffer(buildResponseExportDataset(form, "en")),
    )[1];

    expect(line.endsWith(",-5,-0.25,'-5 apples")).toBe(true);
  });

  test("neutralized multiple-choice cells are only prefixed once", () => {
    const form = createForm(
      [createBlock("colors", "MULTIPLE_CHOICE")],
      [createResponse("r1", { colors: ["=a", "=b"] })],
    );

    const line = csvLines(
      createCsvExportBuffer(buildResponseExportDataset(form, "en")),
    )[1];

    expect(line.endsWith(",'=a | =b")).toBe(true);
  });
});

describe("createXlsxExportBuffer", () => {
  test("writes formula-looking values as text cells", () => {
    const form = createForm(
      [createBlock("a", "SHORT_TEXT"), createBlock("b", "NUMBER")],
      [createResponse("r1", { a: "=1+1", b: "-5" })],
    );

    const { sheet } = readXlsxSheet(
      createXlsxExportBuffer(buildResponseExportDataset(form, "en"), "en"),
    );

    expect(sheet.D2.t).toBe("s");
    expect(sheet.D2.v).toBe("=1+1");
    expect(sheet.D2.f === undefined).toBe(true);
    expect(sheet.E2.t).toBe("s");
    expect(sheet.E2.v).toBe("-5");
  });

  test("uses a localized sheet name within the 31 character limit", () => {
    const form = createForm([createBlock("a", "SHORT_TEXT")], []);
    const dataset = buildResponseExportDataset(form, "en");

    const en = readXlsxSheet(createXlsxExportBuffer(dataset, "en")).sheetName;
    const ru = readXlsxSheet(createXlsxExportBuffer(dataset, "ru")).sheetName;

    expect(en).toBe("Responses");
    expect(ru).toBe("Ответы");
    expect(en.length <= 31 && ru.length <= 31).toBe(true);
  });

  test("truncates a cell above the Excel text limit instead of throwing", () => {
    const form = createForm(
      [createBlock("a", "LONG_TEXT")],
      [createResponse("r1", { a: "x".repeat(40_000) })],
    );

    const { sheet } = readXlsxSheet(
      createXlsxExportBuffer(buildResponseExportDataset(form, "en"), "en"),
    );

    expect(sheet.D2.v.length).toBe(32_767);
  });

  test("writes the header row and nothing else for an empty dataset", () => {
    const form = createForm(
      [createBlock("a", "SHORT_TEXT", { title: "A" })],
      [],
    );

    const { sheet } = readXlsxSheet(
      createXlsxExportBuffer(buildResponseExportDataset(form, "en"), "en"),
    );

    expect(sheet["!ref"]).toBe("A1:D1");
    expect(sheet.D1.v).toBe("A");
  });
});

describe("export format helpers", () => {
  test("accepts only the exact lowercase format names", () => {
    expect(parseResponseExportFormat("csv")).toBe("csv");
    expect(parseResponseExportFormat("xlsx")).toBe("xlsx");

    for (const value of ["CSV", " xlsx ", "pdf", "", null]) {
      let status: number | null = null;

      try {
        parseResponseExportFormat(value);
      } catch (error) {
        status = (error as { status?: number }).status ?? null;
      }

      expect(status).toBe(422);
    }
  });

  test("builds a safe filename from an unsafe slug", () => {
    expect(getResponseExportFilename("My Form/../etc?", "csv")).toBe(
      "my-form-etc-responses.csv",
    );
    expect(getResponseExportFilename("Опрос", "xlsx")).toBe(
      "form-responses.xlsx",
    );
    expect(getResponseExportFilename("", "csv")).toBe("form-responses.csv");
    expect(getResponseExportFilename("a".repeat(80), "csv")).toBe(
      `${"a".repeat(48)}-responses.csv`,
    );
  });
});

describe("rating export values", () => {
  test("exports the stored rating as a plain number string", () => {
    const form = createForm(
      [
        createBlock("score", "RATING", {
          title: "Score",
          config: { min: 0, max: 10, minLabel: "Low", maxLabel: "High" },
        }),
      ],
      [
        createResponse("r1", { score: "10" }),
        createResponse("r2", { score: "0" }),
        createResponse("r3", {}),
        createResponse("r4", { score: 7 }),
      ],
    );

    expect(JSON.stringify(questionValues(form, "ru"))).toBe(
      JSON.stringify([["10"], ["0"], [""], [""]]),
    );

    const lines = csvLines(
      createCsvExportBuffer(buildResponseExportDataset(form)),
    );
    expect(lines[1]?.endsWith(",10")).toBe(true);
    expect(lines[2]?.endsWith(",0")).toBe(true);
  });

  test("does not localize rating values like agreement answers", () => {
    const block = serializeBlock(createBlock("score", "RATING"));

    expect(serializeExportAnswer("5", block, "ru")).toBe("5");
  });
});

describe("file upload export values", () => {
  test("writes the download URL of the app, not the upload id", () => {
    const form = createForm(
      [
        createBlock("cv", "FILE_UPLOAD", {
          title: "CV",
          config: { accept: "documents", maxSizeMb: 5 },
        }),
      ],
      [createResponse("r1", { cv: "up1" }), createResponse("r2", {})],
    );

    const dataset = buildResponseExportDataset(
      form,
      "en",
      "https://forms.example.com/",
    );

    expect(dataset.rows[0].values.cv).toBe(
      "https://forms.example.com/api/forms/form-1/uploads/up1",
    );
    expect(dataset.rows[1].values.cv).toBe("");
  });

  test("serializeExportAnswer needs the form id to build the link", () => {
    const block = serializeBlock(createBlock("cv", "FILE_UPLOAD"));

    expect(
      serializeExportAnswer("up1", block, "en", {
        baseUrl: "https://forms.example.com",
        formId: "form-1",
      }),
    ).toBe("https://forms.example.com/api/forms/form-1/uploads/up1");
    expect(serializeExportAnswer("up1", block, "en")).toBe("up1");
  });
});

describe("repeating export values", () => {
  test("joins instance values with a semicolon in instance order", () => {
    const form = createForm(
      [createBlock("names", "SHORT_TEXT")],
      [createResponse("r1", { names: ["Ada", null, "Grace"] })],
    );

    expect(questionValues(form)[0][0]).toBe("Ada; Grace");
  });

  test("keeps the pipe inside a multiple-choice instance", () => {
    const form = createForm(
      [createBlock("colors", "MULTIPLE_CHOICE")],
      [
        createResponse("r1", {
          colors: [["red", "blue"], null, ["green"]],
        }),
      ],
    );

    expect(questionValues(form)[0][0]).toBe("red | blue; green");
  });

  test("localizes each agreement instance", () => {
    const form = createForm(
      [createBlock("terms", "AGREEMENT")],
      [createResponse("r1", { terms: ["agreed", "not_agreed"] })],
    );

    expect(questionValues(form, "en")[0][0]).toBe("Agree; Do not agree");
    expect(questionValues(form, "ru")[0][0]).toBe("Согласен; Не согласен");
  });

  test("writes one download URL per file instance", () => {
    const form = createForm(
      [
        createBlock("cv", "FILE_UPLOAD", {
          title: "CV",
          config: { accept: "documents", maxSizeMb: 5 },
        }),
      ],
      [createResponse("r1", { cv: ["up1", "up2"] })],
    );

    const dataset = buildResponseExportDataset(
      form,
      "en",
      "https://forms.example.com/",
    );

    expect(dataset.rows[0].values.cv).toBe(
      "https://forms.example.com/api/forms/form-1/uploads/up1; https://forms.example.com/api/forms/form-1/uploads/up2",
    );
  });

  test("flat answers of the same block types keep their single-value shape", () => {
    const form = createForm(
      [
        createBlock("colors", "MULTIPLE_CHOICE"),
        createBlock("name", "SHORT_TEXT"),
      ],
      [createResponse("r1", { colors: ["red", "blue"], name: "Ada" })],
    );

    expect(JSON.stringify(questionValues(form)[0])).toBe(
      JSON.stringify(["red | blue", "Ada"]),
    );
  });

  test("serializeExportAnswer joins instances through the stored answer view", () => {
    const block = serializeBlock(createBlock("names", "SHORT_TEXT"));

    expect(serializeExportAnswer(["Ada", "Grace"], block, "en")).toBe(
      "Ada; Grace",
    );
    expect(serializeExportAnswer("Ada", block, "en")).toBe("Ada");
  });
});
