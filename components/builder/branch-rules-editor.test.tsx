import { describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { useState } from "react";

import { BranchRulesEditor } from "@/components/builder/branch-rules-editor";
import { I18nProvider } from "@/components/i18n-provider";
import {
  getDefaultBlockConfig,
  type BlockConfig,
  type SerializedBlock,
} from "@/lib/blocks";
import type { BranchValidationIssue } from "@/lib/branching";
import { type BranchRuleDraft } from "@/lib/form-builder-drafts";
import type { BuilderBlock } from "@/lib/form-types";
import { installTestDom } from "@/test/install-dom";

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

function BranchRulesEditorHarness({
  allBlocks,
  blockDraft,
  branchValidationIssues = [],
}: {
  allBlocks: BuilderBlock[];
  blockDraft: BuilderBlock;
  branchValidationIssues?: BranchValidationIssue[];
}) {
  const [currentBlockDraft, setCurrentBlockDraft] = useState(blockDraft);
  const [branchRulesDraft, setBranchRulesDraft] = useState<BranchRuleDraft[]>(
    [],
  );

  function updateConfig(patch: Record<string, unknown>) {
    setCurrentBlockDraft(
      (current) =>
        ({
          ...current,
          config: {
            ...(current.config as Record<string, unknown>),
            ...patch,
          } as BlockConfig,
        }) as SerializedBlock,
    );
  }

  return (
    <I18nProvider locale="en" messages={{}}>
      <BranchRulesEditor
        allBlocks={allBlocks}
        blockDraft={currentBlockDraft}
        branchRulesDraft={branchRulesDraft}
        branchValidationIssues={branchValidationIssues}
        setBranchRulesDraft={setBranchRulesDraft}
        updateConfig={updateConfig}
      />
      <pre data-testid="branch-rules-draft">
        {JSON.stringify(branchRulesDraft)}
      </pre>
      <pre data-testid="block-config">
        {JSON.stringify(currentBlockDraft.config)}
      </pre>
    </I18nProvider>
  );
}

describe("BranchRulesEditor", () => {
  test("adds an agreement branch rule using the first available target and agreed default", () => {
    const restoreDom = installTestDom();
    const blockDraft = createBlock({
      id: "agreement",
      type: "AGREEMENT",
      position: 0,
      title: "Consent",
    });
    const targetBlock = createBlock({
      id: "follow-up",
      type: "SHORT_TEXT",
      position: 1,
      title: "Why?",
    });

    const view = render(
      <BranchRulesEditorHarness
        allBlocks={[blockDraft, targetBlock]}
        blockDraft={blockDraft}
      />,
    );

    fireEvent.click(
      view.getByRole("button", { name: "builder.addBranchRule" }),
    );

    const branchRules = JSON.parse(
      view.getByTestId("branch-rules-draft").textContent ?? "[]",
    ) as Array<Record<string, string | null>>;
    const blockConfig = JSON.parse(
      view.getByTestId("block-config").textContent ?? "{}",
    ) as Record<string, unknown>;

    expect(branchRules.length).toBe(1);
    expect(branchRules[0]?.operator).toBe("equals");
    expect(branchRules[0]?.value).toBe("agreed");
    expect(branchRules[0]?.targetBlockId).toBe("follow-up");
    expect(JSON.stringify(blockConfig.branchRules)).toBe(
      JSON.stringify([
        {
          operator: "equals",
          value: "agreed",
          targetBlockId: "follow-up",
        },
      ]),
    );

    cleanup();
    restoreDom();
  });

  test("shows no-target guidance and disables adding branch rules when there are no future targets", () => {
    const restoreDom = installTestDom();
    const blockDraft = createBlock({
      id: "last-question",
      type: "SHORT_TEXT",
      position: 0,
      title: "Last question",
    });

    const view = render(
      <BranchRulesEditorHarness
        allBlocks={[blockDraft]}
        blockDraft={blockDraft}
      />,
    );

    const addButton = view.getByRole("button", {
      name: "builder.addBranchRule",
    });

    expect(addButton.hasAttribute("disabled")).toBe(true);
    expect(view.getByText("builder.branchingNoTargets") !== null).toBe(true);

    cleanup();
    restoreDom();
  });

  test("hides branching controls when terminal mode is enabled", () => {
    const restoreDom = installTestDom();
    const blockDraft = createBlock({
      id: "question-1",
      type: "SHORT_TEXT",
      position: 0,
      title: "Last question",
      config: {
        ...getDefaultBlockConfig("SHORT_TEXT"),
        endForm: true,
      },
    });
    const nextBlock = createBlock({
      id: "question-2",
      type: "SHORT_TEXT",
      position: 1,
      title: "Next",
    });

    const view = render(
      <BranchRulesEditorHarness
        allBlocks={[blockDraft, nextBlock]}
        blockDraft={blockDraft}
      />,
    );

    expect(view.getByText("builder.endFormAfterBlock") !== null).toBe(true);
    expect(view.queryByText("builder.branchOtherwise")).toBe(null);
    expect(
      (
        view.getByRole("button", {
          name: "builder.addBranchRule",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    cleanup();
    restoreDom();
  });

  test("shows only the terminal toggle for text blocks", () => {
    const restoreDom = installTestDom();
    const blockDraft = createBlock({
      id: "intro",
      type: "TEXT",
      position: 0,
      title: "Intro",
    });
    const nextBlock = createBlock({
      id: "question-1",
      type: "SHORT_TEXT",
      position: 1,
      title: "Next",
    });

    const view = render(
      <BranchRulesEditorHarness
        allBlocks={[blockDraft, nextBlock]}
        blockDraft={blockDraft}
      />,
    );

    expect(view.getByText("builder.endFormAfterBlock") !== null).toBe(true);
    expect(view.queryByText("builder.branchOtherwise")).toBe(null);
    expect(view.queryByText("builder.branchingHelp")).toBe(null);

    cleanup();
    restoreDom();
  });

  test("renders branch issues only for the selected block", () => {
    const restoreDom = installTestDom();
    const blockDraft = createBlock({
      id: "question-1",
      type: "SINGLE_CHOICE",
      position: 0,
      title: "Choose one",
      config: {
        ...getDefaultBlockConfig("SINGLE_CHOICE"),
        options: ["A", "B"],
      },
    });
    const nextBlock = createBlock({
      id: "question-2",
      type: "SHORT_TEXT",
      position: 1,
      title: "Next",
    });
    const issues: BranchValidationIssue[] = [
      {
        severity: "blocker",
        code: "invalid-target",
        message: "missing target",
        blockId: "question-1",
        ruleIndex: 0,
        targetBlockId: "missing-block",
      },
      {
        severity: "warning",
        code: "partial-choice-coverage",
        message: "partial coverage",
        blockId: "question-1",
      },
      {
        severity: "warning",
        code: "fragile-text-match",
        message: "other block warning",
        blockId: "question-2",
      },
    ];

    const view = render(
      <BranchRulesEditorHarness
        allBlocks={[blockDraft, nextBlock]}
        blockDraft={blockDraft}
        branchValidationIssues={issues}
      />,
    );

    expect(
      view.getByText("branching.issueMessages.invalid-target") !== null,
    ).toBe(true);
    expect(
      view.getByText("branching.issueMessages.partial-choice-coverage") !==
        null,
    ).toBe(true);
    expect(view.queryByText("branching.issueMessages.fragile-text-match")).toBe(
      null,
    );

    cleanup();
    restoreDom();
  });
});
