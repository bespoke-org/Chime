import { describe, expect, test } from "bun:test";

type VisitRow = {
  formId: string;
  visitorId: string;
  startedAt: Date | null;
  submittedAt: Date | null;
};

let publishedSlugs: Record<string, string> = {};
let editorIds: string[] = [];
let visits: VisitRow[] = [];

const { mock } = (await import("bun:test")) as unknown as {
  mock: {
    module: (specifier: string, factory: () => Record<string, unknown>) => void;
  };
};

mock.module("@/lib/db", () => ({
  db: {
    form: {
      findFirst: async (args: {
        where: {
          slug?: string;
          id?: string;
          OR?: Array<{ userId?: string }>;
        };
      }) => {
        if (args.where.slug !== undefined) {
          const id = publishedSlugs[args.where.slug];
          return id ? { id } : null;
        }

        const viewerId = args.where.OR?.[0]?.userId;
        return viewerId && editorIds.includes(viewerId)
          ? { id: args.where.id }
          : null;
      },
    },
    formVisit: {
      upsert: async (args: {
        where: { formId_visitorId: { formId: string; visitorId: string } };
        create: Pick<VisitRow, "formId" | "visitorId"> &
          Partial<Pick<VisitRow, "startedAt" | "submittedAt">>;
      }) => {
        const { formId, visitorId } = args.where.formId_visitorId;
        const existing = visits.find(
          (visit) => visit.formId === formId && visit.visitorId === visitorId,
        );

        if (!existing) {
          visits.push({
            ...args.create,
            startedAt: args.create.startedAt ?? null,
            submittedAt: args.create.submittedAt ?? null,
          });
        }
      },
      updateMany: async (args: {
        where: { formId: string; visitorId: string } & Partial<
          Record<"startedAt" | "submittedAt", null>
        >;
        data: Partial<Record<"startedAt" | "submittedAt", Date>>;
      }) => {
        for (const visit of visits) {
          if (
            visit.formId === args.where.formId &&
            visit.visitorId === args.where.visitorId &&
            (!("startedAt" in args.where) || visit.startedAt === null) &&
            (!("submittedAt" in args.where) || visit.submittedAt === null)
          ) {
            Object.assign(visit, args.data);
          }
        }
      },
    },
  },
}));

const { recordFormVisit } = await import("@/lib/form-visits");
const { getFunnelPercent } = await import("@/lib/form-funnel");

const visitorId = "6f1c2c1e-6c2b-4f7a-9f55-3d1b8c7a2e10";

function reset() {
  publishedSlugs = { "demo-form": "form-1" };
  editorIds = ["author-1"];
  visits = [];
}

async function errorMessage(promise: Promise<unknown>) {
  try {
    await promise;
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

describe("recordFormVisit", () => {
  test("records one visit per browser however often the form is opened", async () => {
    reset();
    await recordFormVisit("demo-form", { visitorId, event: "open" }, null);
    await recordFormVisit("demo-form", { visitorId, event: "open" }, null);

    expect(visits.length).toBe(1);
    expect(visits[0]?.startedAt).toBe(null);
  });

  test("a start without a recorded open still counts the visit as started", async () => {
    reset();
    await recordFormVisit("demo-form", { visitorId, event: "start" }, null);

    expect(visits.length).toBe(1);
    expect(visits[0]?.startedAt instanceof Date).toBe(true);
  });

  test("a start after an open marks the existing visit", async () => {
    reset();
    await recordFormVisit("demo-form", { visitorId, event: "open" }, null);
    await recordFormVisit("demo-form", { visitorId, event: "start" }, null);

    expect(visits.length).toBe(1);
    expect(visits[0]?.startedAt instanceof Date).toBe(true);
  });

  test("a submit after an open marks the visit as started and submitted", async () => {
    reset();
    await recordFormVisit("demo-form", { visitorId, event: "open" }, null);
    await recordFormVisit("demo-form", { visitorId, event: "submit" }, null);

    expect(visits.length).toBe(1);
    expect(visits[0]?.startedAt instanceof Date).toBe(true);
    expect(visits[0]?.submittedAt instanceof Date).toBe(true);
  });

  test("submitting twice from one browser counts one submitted visit", async () => {
    reset();
    await recordFormVisit("demo-form", { visitorId, event: "submit" }, null);
    const firstSubmittedAt = visits[0]?.submittedAt;
    await recordFormVisit("demo-form", { visitorId, event: "submit" }, null);

    expect(visits.length).toBe(1);
    expect(visits[0]?.submittedAt).toBe(firstSubmittedAt);
  });

  test("ignores forms that are not published", async () => {
    reset();
    await recordFormVisit("draft-form", { visitorId, event: "open" }, null);

    expect(visits.length).toBe(0);
  });

  test("does not record people who can edit the form", async () => {
    reset();
    await recordFormVisit(
      "demo-form",
      { visitorId, event: "open" },
      "author-1",
    );
    expect(visits.length).toBe(0);

    await recordFormVisit(
      "demo-form",
      { visitorId, event: "open" },
      "someone-else",
    );
    expect(visits.length).toBe(1);
  });

  test("rejects a visitor id that is not a UUID and unknown events", async () => {
    reset();
    expect(
      await errorMessage(
        recordFormVisit(
          "demo-form",
          { visitorId: "visitor-1", event: "open" },
          null,
        ),
      ),
    ).toContain("Invalid visit event.");
    expect(
      await errorMessage(
        recordFormVisit("demo-form", { visitorId, event: "close" }, null),
      ),
    ).toContain("Invalid visit event.");
    expect(visits.length).toBe(0);
  });
});

describe("getFunnelPercent", () => {
  test("rounds the share of visitors", () => {
    expect(getFunnelPercent(1, 3)).toBe(33);
    expect(getFunnelPercent(0, 5)).toBe(0);
  });

  test("caps the share at 100 when older responses outnumber visits", () => {
    expect(getFunnelPercent(12, 4)).toBe(100);
  });

  test("has no share when no visit was recorded", () => {
    expect(getFunnelPercent(3, 0)).toBe(null);
  });
});
