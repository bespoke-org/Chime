import { describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";

import type { BlockType } from "@/components/builder/block-creation";
import { BranchingGraphWorkspace } from "@/components/builder/branching-graph-workspace";
import { I18nProvider } from "@/components/i18n-provider";
import { getDefaultBlockConfig } from "@/lib/blocks";
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

function renderWorkspace({
  selectedBlockId,
  onAddBlockAfter,
}: {
  selectedBlockId: string | null;
  onAddBlockAfter: (blockId: string, blockType: BlockType) => void;
}) {
  const blocks = [
    createBlock({
      id: "block-1",
      type: "SHORT_TEXT",
      position: 0,
      title: "First question",
    }),
    createBlock({
      id: "block-2",
      type: "SHORT_TEXT",
      position: 1,
      title: "Second question",
    }),
  ];

  return render(
    <I18nProvider
      locale="en"
      messages={{ builder: { addBlockAfter: "Add block after this one" } }}
    >
      <BranchingGraphWorkspace
        formId="form-1"
        allBlocks={blocks}
        selectedBlockId={selectedBlockId}
        blockDraft={null}
        branchRulesDraft={[]}
        branchValidationIssues={[]}
        selectedBlockIcon={null}
        choiceOptionsDraft={[]}
        setChoiceOptionsDraft={() => {}}
        setBlockDraft={() => {}}
        setBranchRulesDraft={() => {}}
        deleteBlock={() => {}}
        saveBlock={async () => true}
        busy={null}
        onSelectBlock={() => {}}
        onAddBlockAfter={onAddBlockAfter}
        hideInspector
      />
    </I18nProvider>,
  );
}

describe("BranchingGraphWorkspace", () => {
  test("shows a localized add button only for the selected node", () => {
    const restoreDom = installTestDom();
    const view = renderWorkspace({
      selectedBlockId: "block-1",
      onAddBlockAfter: () => {},
    });

    const addButtons = view.getAllByRole("button", {
      name: "Add block after this one",
    });

    expect(addButtons.length).toBe(1);
    expect(
      addButtons[0]
        ?.closest("[data-graph-node-id]")
        ?.getAttribute("data-graph-node-id"),
    ).toBe("block-1");

    cleanup();
    restoreDom();
  });

  test("opens the block type menu and reports the chosen type", () => {
    const restoreDom = installTestDom();
    const calls: Array<[string, BlockType]> = [];
    const view = renderWorkspace({
      selectedBlockId: "block-1",
      onAddBlockAfter: (blockId, blockType) => {
        calls.push([blockId, blockType]);
      },
    });

    expect(view.queryByText("blocks.types.NUMBER")).toBe(null);

    fireEvent.click(
      view.getByRole("button", { name: "Add block after this one" }),
    );

    expect(view.getByText("blocks.types.NUMBER") !== null).toBe(true);
    expect(view.getByText("blocks.types.AGREEMENT") !== null).toBe(true);

    fireEvent.click(view.getByText("blocks.types.NUMBER"));

    expect(calls.length).toBe(1);
    expect(calls[0]?.[0]).toBe("block-1");
    expect(calls[0]?.[1]).toBe("NUMBER");
    expect(view.queryByText("blocks.types.NUMBER")).toBe(null);

    cleanup();
    restoreDom();
  });
});
