import { describe, expect, test } from "bun:test";

import { parseBlockConfig } from "@/lib/blocks";
import {
  collectResponseIdentity,
  formatResponseIdentity,
} from "@/lib/response-identity";

const identityBlock = {
  id: "name",
  type: "SHORT_TEXT" as const,
  title: "Your name",
  config: parseBlockConfig("SHORT_TEXT", {
    identity: true,
    identityKey: "name",
  }),
};

const plainBlock = {
  id: "note",
  type: "SHORT_TEXT" as const,
  title: "Notes",
  config: parseBlockConfig("SHORT_TEXT", {}),
};

describe("collectResponseIdentity", () => {
  test("passes a flat string answer through", () => {
    expect(collectResponseIdentity([identityBlock], { name: "Ada" })).toEqual([
      { key: "name", blockId: "name", title: "Your name", value: "Ada" },
    ]);
  });

  test("takes instance 0 of a repeating answer", () => {
    expect(
      collectResponseIdentity([identityBlock], { name: ["Ann", "Bob"] }),
    ).toEqual([
      { key: "name", blockId: "name", title: "Your name", value: "Ann" },
    ]);
  });

  test("drops a repeating answer whose first instance is empty or missing", () => {
    expect(collectResponseIdentity([identityBlock], { name: [""] })).toEqual(
      [],
    );
    expect(collectResponseIdentity([identityBlock], { name: [] })).toEqual([]);
    expect(collectResponseIdentity([identityBlock], {})).toEqual([]);
  });

  test("keeps dropping values that are not strings", () => {
    expect(collectResponseIdentity([identityBlock], { name: 42 })).toEqual([]);
    expect(collectResponseIdentity([identityBlock], { name: null })).toEqual(
      [],
    );
  });

  test("skips blocks without identity config", () => {
    expect(
      collectResponseIdentity([plainBlock, identityBlock], {
        note: "hello",
        name: ["Ada"],
      }),
    ).toEqual([
      { key: "name", blockId: "name", title: "Your name", value: "Ada" },
    ]);
  });

  test("joins the values in block order", () => {
    const secondBlock = {
      id: "email",
      type: "SHORT_TEXT" as const,
      title: "Email",
      config: parseBlockConfig("SHORT_TEXT", { identity: true }),
    };

    expect(
      formatResponseIdentity(
        collectResponseIdentity([identityBlock, secondBlock], {
          name: ["Ada"],
          email: "ada@example.com",
        }),
      ),
    ).toBe("Ada · ada@example.com");
  });
});
