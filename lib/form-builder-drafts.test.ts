import { describe, expect, test } from "bun:test";

import {
  createBranchRuleDrafts,
  createChoiceOptionDrafts,
  createDefaultBranchRuleDraft,
  fromDateTimeLocalValue,
  hasBuilderBlockDraftChanges,
  parseMaxResponsesDraft,
  serializeBranchRuleDrafts,
  serializeChoiceOptionDrafts,
  toDateTimeLocalValue,
} from "@/lib/form-builder-drafts";
import { getDefaultBlockConfig } from "@/lib/blocks";
import type { BuilderBlock } from "@/lib/form-types";

function createBlock(
  overrides: Partial<BuilderBlock> &
    Pick<BuilderBlock, "id" | "type" | "position">,
): BuilderBlock {
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
  } as BuilderBlock;
}

describe("form builder draft helpers", () => {
  test("preserves choice option order when drafts are saved back into block config", () => {
    const drafts = createChoiceOptionDrafts(["First", "Second", "Third"]);

    expect(JSON.stringify(serializeChoiceOptionDrafts(drafts))).toBe(
      JSON.stringify(["First", "Second", "Third"]),
    );
  });

  test("preserves branch rule operator, value, and target when drafts are saved", () => {
    const serialized = serializeBranchRuleDrafts([
      {
        id: "draft-1",
        operator: "contains",
        value: "vip",
        targetBlockId: "priority-review",
      },
    ]);

    expect(JSON.stringify(serialized)).toBe(
      JSON.stringify([
        {
          operator: "contains",
          value: "vip",
          targetBlockId: "priority-review",
        },
      ]),
    );
  });

  test("starts agreement branch rules with the agreed answer as the default value", () => {
    const draft = createDefaultBranchRuleDraft({
      blockType: "AGREEMENT",
      targetBlockId: "accepted",
    });

    expect(draft.operator).toBe("equals");
    expect(draft.value).toBe("agreed");
    expect(draft.targetBlockId).toBe("accepted");
  });

  test("treats choice drafts with regenerated ids as unchanged when the saved content matches", () => {
    const savedBlock = createBlock({
      id: "choice-1",
      type: "SINGLE_CHOICE",
      position: 0,
      title: "Pick one",
      config: {
        ...getDefaultBlockConfig("SINGLE_CHOICE"),
        options: ["Yes", "No"],
      },
    });

    expect(
      hasBuilderBlockDraftChanges({
        savedBlock,
        blockDraft: savedBlock,
        choiceOptionsDraft: createChoiceOptionDrafts(["Yes", "No"]),
        branchRulesDraft: [],
      }),
    ).toBe(false);

    expect(
      hasBuilderBlockDraftChanges({
        savedBlock,
        blockDraft: savedBlock,
        choiceOptionsDraft: createChoiceOptionDrafts(["Yes", "Maybe"]),
        branchRulesDraft: [],
      }),
    ).toBe(true);
  });

  test("counts a draft that fails the block schema as changed", () => {
    const savedBlock = createBlock({
      id: "name",
      type: "SHORT_TEXT",
      position: 0,
    });

    expect(
      hasBuilderBlockDraftChanges({
        savedBlock,
        blockDraft: {
          ...savedBlock,
          config: { ...savedBlock.config, validationRegex: "(" },
        } as BuilderBlock,
        choiceOptionsDraft: [],
        branchRulesDraft: [],
      }),
    ).toBe(true);
  });

  test("detects branching edits from serialized rule content instead of draft ids", () => {
    const savedBlock = createBlock({
      id: "question-1",
      type: "SHORT_TEXT",
      position: 0,
      title: "Why?",
      config: {
        ...getDefaultBlockConfig("SHORT_TEXT"),
        branchRules: [
          {
            operator: "contains",
            value: "vip",
            targetBlockId: "priority-review",
          },
        ],
      },
    });

    expect(
      hasBuilderBlockDraftChanges({
        savedBlock,
        blockDraft: savedBlock,
        choiceOptionsDraft: [],
        branchRulesDraft: createBranchRuleDrafts([
          {
            operator: "contains",
            value: "vip",
            targetBlockId: "priority-review",
          },
        ]),
      }),
    ).toBe(false);

    expect(
      hasBuilderBlockDraftChanges({
        savedBlock,
        blockDraft: savedBlock,
        choiceOptionsDraft: [],
        branchRulesDraft: createBranchRuleDrafts([
          {
            operator: "contains",
            value: "vip-only",
            targetBlockId: "priority-review",
          },
        ]),
      }),
    ).toBe(true);
  });
});

describe("closing draft helpers", () => {
  test("round-trips a datetime-local value through ISO", () => {
    const local = "2030-05-06T07:08";
    const iso = fromDateTimeLocalValue(local);

    expect(iso).toBe(new Date(local).toISOString());
    expect(toDateTimeLocalValue(iso)).toBe(local);
  });

  test("maps empty and invalid values", () => {
    expect(toDateTimeLocalValue(null)).toBe("");
    expect(toDateTimeLocalValue("nonsense")).toBe("");
    expect(fromDateTimeLocalValue("   ")).toBe(null);
    expect(fromDateTimeLocalValue("nonsense")).toBe("nonsense");
  });

  test("parses the response limit draft", () => {
    expect(parseMaxResponsesDraft("")).toBe(null);
    expect(parseMaxResponsesDraft(" 25 ")).toBe(25);
    expect(Number.isNaN(parseMaxResponsesDraft("abc") as number)).toBe(true);
  });
});
