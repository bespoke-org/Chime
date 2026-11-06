import { describe, expect, test } from "bun:test";

import { getDefaultBlockConfig, type SerializedBlock } from "@/lib/blocks";
import { findPageByBlock, parsePageRegistry, resolvePages } from "@/lib/pages";

type TestBlock = SerializedBlock & { pageId?: string | null };

function createBlock(
  overrides: Partial<TestBlock> & Pick<TestBlock, "id" | "type" | "position">,
): TestBlock {
  const now = new Date("2026-04-14T12:00:00.000Z");

  return {
    formId: "form-1",
    title: "",
    description: "",
    required: false,
    createdAt: now,
    updatedAt: now,
    config: getDefaultBlockConfig(overrides.type),
    ...overrides,
  } as TestBlock;
}

function pageIds(pages: ReturnType<typeof resolvePages>) {
  return JSON.stringify(pages.map((page) => page.id));
}

function blockIds(pages: ReturnType<typeof resolvePages>) {
  return JSON.stringify(pages.map((page) => page.blocks.map((b) => b.id)));
}

describe("page registry parsing", () => {
  test("keeps valid entries in their stored order", () => {
    expect(
      JSON.stringify(parsePageRegistry([{ id: "intro" }, { id: "details" }])),
    ).toBe(JSON.stringify([{ id: "intro" }, { id: "details" }]));
  });

  test("returns an empty registry for values that are not arrays", () => {
    expect(JSON.stringify(parsePageRegistry(null))).toBe("[]");
    expect(JSON.stringify(parsePageRegistry(undefined))).toBe("[]");
    expect(JSON.stringify(parsePageRegistry({ id: "intro" }))).toBe("[]");
    expect(JSON.stringify(parsePageRegistry("intro"))).toBe("[]");
  });

  test("drops entries without a usable id", () => {
    expect(
      JSON.stringify(
        parsePageRegistry([
          null,
          7,
          "intro",
          {},
          { id: "" },
          { id: 42 },
          { id: "kept" },
        ]),
      ),
    ).toBe(JSON.stringify([{ id: "kept" }]));
  });

  test("strips unknown keys from entries", () => {
    expect(
      JSON.stringify(
        parsePageRegistry([{ id: "intro", blocks: ["a", "b"], order: 2 }]),
      ),
    ).toBe(JSON.stringify([{ id: "intro" }]));
  });
});

describe("page resolution", () => {
  test("orders pages by the position of their first block, not by registry order", () => {
    const pages = resolvePages(
      [
        createBlock({
          id: "name",
          type: "SHORT_TEXT",
          position: 0,
          pageId: "page-a",
        }),
        createBlock({
          id: "notes",
          type: "LONG_TEXT",
          position: 1,
          pageId: "page-b",
        }),
      ],
      [{ id: "page-b" }, { id: "page-a" }],
    );

    expect(pageIds(pages)).toBe(JSON.stringify(["page-a", "page-b"]));
    expect(JSON.stringify(pages[0]?.definition)).toBe(
      JSON.stringify({ id: "page-a" }),
    );
    expect(JSON.stringify(pages[1]?.definition)).toBe(
      JSON.stringify({ id: "page-b" }),
    );
  });

  test("collects the blocks of one page across a later page", () => {
    const pages = resolvePages(
      [
        createBlock({
          id: "first",
          type: "SHORT_TEXT",
          position: 0,
          pageId: "page-a",
        }),
        createBlock({
          id: "middle",
          type: "SHORT_TEXT",
          position: 1,
          pageId: "page-b",
        }),
        createBlock({
          id: "last",
          type: "LONG_TEXT",
          position: 2,
          pageId: "page-a",
        }),
      ],
      [{ id: "page-a" }, { id: "page-b" }],
    );

    expect(pageIds(pages)).toBe(JSON.stringify(["page-a", "page-b"]));
    expect(blockIds(pages)).toBe(
      JSON.stringify([["first", "last"], ["middle"]]),
    );
  });

  test("makes a block without pageId a page of its own named after the block", () => {
    const pages = resolvePages(
      [
        createBlock({ id: "intro", type: "TEXT", position: 0, pageId: null }),
        createBlock({
          id: "name",
          type: "SHORT_TEXT",
          position: 1,
          pageId: "page-a",
        }),
      ],
      [{ id: "page-a" }],
    );

    expect(pageIds(pages)).toBe(JSON.stringify(["intro", "page-a"]));
    expect(JSON.stringify(pages[0]?.definition)).toBe("null");
    expect(blockIds(pages)).toBe(JSON.stringify([["intro"], ["name"]]));
  });

  test("makes a block whose pageId is missing from the registry a page of its own", () => {
    const pages = resolvePages(
      [
        createBlock({
          id: "name",
          type: "SHORT_TEXT",
          position: 0,
          pageId: "page-a",
        }),
        createBlock({
          id: "orphan",
          type: "TEXT",
          position: 1,
          pageId: "ghost",
        }),
      ],
      [{ id: "page-a" }],
    );

    expect(pageIds(pages)).toBe(JSON.stringify(["page-a", "orphan"]));
    expect(JSON.stringify(pages[1]?.definition)).toBe("null");
    expect(blockIds(pages)).toBe(JSON.stringify([["name"], ["orphan"]]));
  });

  test("produces no page for registry entries without blocks", () => {
    const pages = resolvePages(
      [
        createBlock({
          id: "name",
          type: "SHORT_TEXT",
          position: 0,
          pageId: "page-a",
        }),
      ],
      [{ id: "page-a" }, { id: "page-empty" }],
    );

    expect(pageIds(pages)).toBe(JSON.stringify(["page-a"]));
  });

  test("collapses duplicate registry ids into a single page", () => {
    const pages = resolvePages(
      [
        createBlock({
          id: "name",
          type: "SHORT_TEXT",
          position: 0,
          pageId: "page-a",
        }),
        createBlock({
          id: "notes",
          type: "LONG_TEXT",
          position: 1,
          pageId: "page-a",
        }),
      ],
      [{ id: "page-a" }, { id: "page-a" }],
    );

    expect(pageIds(pages)).toBe(JSON.stringify(["page-a"]));
    expect(blockIds(pages)).toBe(JSON.stringify([["name", "notes"]]));
  });

  test("returns no pages when there are no blocks", () => {
    expect(pageIds(resolvePages([], [{ id: "page-a" }]))).toBe("[]");
  });

  test("sorts unsorted blocks by position before grouping", () => {
    const pages = resolvePages(
      [
        createBlock({
          id: "b-middle",
          type: "SHORT_TEXT",
          position: 1,
          pageId: "page-b",
        }),
        createBlock({
          id: "a-last",
          type: "LONG_TEXT",
          position: 3,
          pageId: "page-a",
        }),
        createBlock({
          id: "a-first",
          type: "TEXT",
          position: 0,
          pageId: "page-a",
        }),
      ],
      [{ id: "page-a" }, { id: "page-b" }],
    );

    expect(pageIds(pages)).toBe(JSON.stringify(["page-a", "page-b"]));
    expect(blockIds(pages)).toBe(
      JSON.stringify([["a-first", "a-last"], ["b-middle"]]),
    );
  });
});

describe("findPageByBlock", () => {
  function createPages() {
    return resolvePages(
      [
        createBlock({
          id: "name",
          type: "SHORT_TEXT",
          position: 0,
          pageId: "page-a",
        }),
        createBlock({
          id: "notes",
          type: "LONG_TEXT",
          position: 1,
          pageId: "page-a",
        }),
        createBlock({ id: "intro", type: "TEXT", position: 2, pageId: null }),
        createBlock({
          id: "rating",
          type: "RATING",
          position: 3,
          pageId: "page-b",
        }),
      ],
      [{ id: "page-a" }, { id: "page-b" }],
    );
  }

  test("returns the page that contains the block", () => {
    const pages = createPages();

    expect(findPageByBlock(pages, "notes")?.id).toBe("page-a");
    expect(findPageByBlock(pages, "rating")?.id).toBe("page-b");
  });

  test("finds the standalone page of a block without pageId", () => {
    const pages = createPages();

    expect(findPageByBlock(pages, "intro")?.id).toBe("intro");
  });

  test("returns null for an unknown block id", () => {
    const pages = createPages();

    expect(findPageByBlock(pages, "ghost")).toBe(null);
  });
});

describe("repeating page registry entries", () => {
  test("parses entries with repeat settings", () => {
    expect(
      JSON.stringify(
        parsePageRegistry([
          { id: "count-page" },
          { id: "team-page", repeat: { countBlockId: "count" } },
        ]),
      ),
    ).toBe(
      JSON.stringify([
        { id: "count-page" },
        { id: "team-page", repeat: { countBlockId: "count" } },
      ]),
    );
  });

  test("drops entries whose repeat settings have an empty count block id", () => {
    expect(
      JSON.stringify(
        parsePageRegistry([{ id: "team-page", repeat: { countBlockId: "" } }]),
      ),
    ).toBe("[]");
  });

  test("resolved pages carry their repeat settings", () => {
    const pages = resolvePages(
      [
        createBlock({
          id: "count",
          type: "NUMBER",
          position: 0,
          pageId: "count-page",
        }),
        createBlock({
          id: "name",
          type: "SHORT_TEXT",
          position: 1,
          pageId: "team-page",
        }),
      ],
      [
        { id: "count-page" },
        { id: "team-page", repeat: { countBlockId: "count" } },
      ],
    );

    expect(pages[1]?.definition).toEqual({
      id: "team-page",
      repeat: { countBlockId: "count" },
    });
  });
});
