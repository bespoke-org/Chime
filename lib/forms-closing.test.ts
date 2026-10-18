import { describe, expect, test } from "bun:test";

type FormRecord = {
  id: string;
  slug: string;
  title: string;
  status: "PUBLISHED";
  webhookUrl: null;
  webhookSecret: null;
  closesAt: Date | null;
  maxResponses: number | null;
  closedManually: boolean;
  blocks: Array<Record<string, unknown>>;
};

let currentForm: FormRecord | null = null;
let storedResponseCount = 0;
let countCalls = 0;
let createdResponses: Array<Record<string, unknown>> = [];

const { mock } = (await import("bun:test")) as unknown as {
  mock: {
    module: (specifier: string, factory: () => Record<string, unknown>) => void;
  };
};

mock.module("server-only", () => ({}));

mock.module("@/lib/db", () => ({
  db: {
    form: {
      findFirst: async () => currentForm,
    },
    response: {
      count: async () => {
        countCalls += 1;
        return storedResponseCount;
      },
      create: async (args: { data: Record<string, unknown> }) => {
        createdResponses.push(args.data);
        return {
          id: "resp-1",
          submittedAt: new Date("2026-10-18T10:00:00.000Z"),
          ...args.data,
        };
      },
    },
  },
}));

const { createAnonymousResponse } = await import("@/lib/forms");
const { AppError } = await import("@/lib/errors");

function block(id: string, type: string, position: number) {
  const now = new Date("2026-10-18T09:00:00.000Z");
  return {
    id,
    formId: "form-1",
    type,
    title: id,
    description: "",
    required: false,
    position,
    config: {},
    createdAt: now,
    updatedAt: now,
  };
}

function resetTestState(
  overrides: Partial<FormRecord> = {},
  responseCount = 0,
) {
  currentForm = {
    id: "form-1",
    slug: "demo",
    title: "Demo",
    status: "PUBLISHED",
    webhookUrl: null,
    webhookSecret: null,
    closesAt: null,
    maxResponses: null,
    closedManually: false,
    blocks: [block("q-1", "SHORT_TEXT", 0)],
    ...overrides,
  };
  storedResponseCount = responseCount;
  countCalls = 0;
  createdResponses = [];
}

async function submit() {
  try {
    await createAnonymousResponse("demo", { "q-1": "Ada" });
    return null;
  } catch (error) {
    return error;
  }
}

describe("createAnonymousResponse closing", () => {
  test("stores the response when the form is open", async () => {
    resetTestState();

    expect(await submit()).toBe(null);
    expect(createdResponses.length).toBe(1);
    expect(countCalls).toBe(0);
  });

  test("answers 410 and stores nothing when closed manually", async () => {
    resetTestState({ closedManually: true });

    const error = await submit();

    expect(error instanceof AppError).toBe(true);
    expect((error as InstanceType<typeof AppError>).status).toBe(410);
    expect((error as Error).message).toBe(
      "This form is no longer accepting responses.",
    );
    expect(createdResponses.length).toBe(0);
  });

  test("answers 410 once the deadline has passed", async () => {
    resetTestState({ closesAt: new Date("2000-01-01T00:00:00.000Z") });

    const error = await submit();

    expect((error as InstanceType<typeof AppError>).status).toBe(410);
    expect(createdResponses.length).toBe(0);
  });

  test("answers 410 when the response cap is reached", async () => {
    resetTestState({ maxResponses: 3 }, 3);

    const error = await submit();

    expect((error as InstanceType<typeof AppError>).status).toBe(410);
    expect(countCalls).toBe(1);
    expect(createdResponses.length).toBe(0);
  });

  test("counts responses and stores while under the cap", async () => {
    resetTestState({ maxResponses: 3 }, 2);

    expect(await submit()).toBe(null);
    expect(countCalls).toBe(1);
    expect(createdResponses.length).toBe(1);
  });
});
