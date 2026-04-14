import { describe, expect, test } from "bun:test";

import {
  createChoiceOptionDrafts,
  createDefaultBranchRuleDraft,
  serializeBranchRuleDrafts,
  serializeChoiceOptionDrafts,
} from "@/lib/form-builder-drafts";

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
});
