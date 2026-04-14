import { describe, expect, test } from "bun:test";

import { getDefaultBlockConfig } from "@/lib/blocks";
import { buildBranchingGraph } from "@/lib/branching-graph";
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

describe("buildBranchingGraph", () => {
  test("lays out linear forms as a left-to-right sequence with linear edges", () => {
    const blocks = [
      createBlock({
        id: "block-1",
        type: "SHORT_TEXT",
        position: 0,
        title: "One",
      }),
      createBlock({
        id: "block-2",
        type: "SHORT_TEXT",
        position: 1,
        title: "Two",
      }),
      createBlock({
        id: "block-3",
        type: "SHORT_TEXT",
        position: 2,
        title: "Three",
      }),
    ];

    const graph = buildBranchingGraph(blocks);
    const node1 = graph.nodes.find((node) => node.blockId === "block-1");
    const node2 = graph.nodes.find((node) => node.blockId === "block-2");
    const node3 = graph.nodes.find((node) => node.blockId === "block-3");

    expect((node1?.x ?? 0) < (node2?.x ?? 0)).toBe(true);
    expect((node2?.x ?? 0) < (node3?.x ?? 0)).toBe(true);
    expect(node1?.y).toBe(node2?.y);
    expect(node2?.y).toBe(node3?.y);
    expect(
      JSON.stringify(
        graph.edges.map((edge) => ({
          kind: edge.kind,
          sourceBlockId: edge.sourceBlockId,
          targetBlockId: edge.targetBlockId,
        })),
      ),
    ).toBe(
      JSON.stringify([
        {
          kind: "linear",
          sourceBlockId: "block-1",
          targetBlockId: "block-2",
        },
        {
          kind: "linear",
          sourceBlockId: "block-2",
          targetBlockId: "block-3",
        },
      ]),
    );
  });

  test("fans out branch-rule targets while preserving left-to-right block order", () => {
    const blocks = [
      createBlock({
        id: "block-1",
        type: "SINGLE_CHOICE",
        position: 0,
        title: "Choose",
        config: {
          ...getDefaultBlockConfig("SINGLE_CHOICE"),
          options: ["Yes", "No"],
          branchRules: [
            {
              operator: "equals",
              value: "Yes",
              targetBlockId: "block-3",
            },
          ],
          defaultNextBlockId: null,
        },
      }),
      createBlock({
        id: "block-2",
        type: "SHORT_TEXT",
        position: 1,
        title: "Default next",
      }),
      createBlock({
        id: "block-3",
        type: "SHORT_TEXT",
        position: 2,
        title: "Branch target",
      }),
    ];

    const graph = buildBranchingGraph(blocks);
    const defaultNode = graph.nodes.find((node) => node.blockId === "block-2");
    const branchNode = graph.nodes.find((node) => node.blockId === "block-3");

    expect((defaultNode?.x ?? 0) < (branchNode?.x ?? 0)).toBe(true);
    expect((branchNode?.y ?? 0) > (defaultNode?.y ?? 0)).toBe(true);
    expect(
      JSON.stringify(
        graph.edges.map((edge) => ({
          kind: edge.kind,
          sourceBlockId: edge.sourceBlockId,
          targetBlockId: edge.targetBlockId,
        })),
      ),
    ).toBe(
      JSON.stringify([
        {
          kind: "rule",
          sourceBlockId: "block-1",
          targetBlockId: "block-3",
        },
        {
          kind: "linear",
          sourceBlockId: "block-1",
          targetBlockId: "block-2",
        },
        {
          kind: "linear",
          sourceBlockId: "block-2",
          targetBlockId: "block-3",
        },
      ]),
    );
  });

  test("does not render outgoing edges from terminal blocks", () => {
    const blocks = [
      createBlock({
        id: "block-1",
        type: "SHORT_TEXT",
        position: 0,
        title: "Terminal",
        config: {
          ...getDefaultBlockConfig("SHORT_TEXT"),
          branchRules: [
            { operator: "is_not_empty", value: null, targetBlockId: "block-3" },
          ],
          defaultNextBlockId: "block-2",
          endForm: true,
        },
      }),
      createBlock({
        id: "block-2",
        type: "SHORT_TEXT",
        position: 1,
        title: "Next",
      }),
      createBlock({
        id: "block-3",
        type: "SHORT_TEXT",
        position: 2,
        title: "Branched",
      }),
    ];

    const graph = buildBranchingGraph(blocks);
    expect(graph.edges.some((edge) => edge.sourceBlockId === "block-1")).toBe(
      false,
    );
  });

  test("keeps multi-branch targets distributed to reduce edge overlap", () => {
    const blocks = [
      createBlock({
        id: "block-1",
        type: "SINGLE_CHOICE",
        position: 0,
        title: "Choose",
        config: {
          ...getDefaultBlockConfig("SINGLE_CHOICE"),
          options: ["A", "B", "C"],
          branchRules: [
            { operator: "equals", value: "A", targetBlockId: "block-3" },
            { operator: "equals", value: "B", targetBlockId: "block-4" },
          ],
          defaultNextBlockId: "block-2",
        },
      }),
      createBlock({
        id: "block-2",
        type: "SHORT_TEXT",
        position: 1,
        title: "Default",
      }),
      createBlock({
        id: "block-3",
        type: "SHORT_TEXT",
        position: 2,
        title: "Branch A",
      }),
      createBlock({
        id: "block-4",
        type: "SHORT_TEXT",
        position: 3,
        title: "Branch B",
      }),
    ];

    const graph = buildBranchingGraph(blocks);
    const node2 = graph.nodes.find((node) => node.blockId === "block-2");
    const node3 = graph.nodes.find((node) => node.blockId === "block-3");
    const node4 = graph.nodes.find((node) => node.blockId === "block-4");

    expect(new Set([node2?.y, node3?.y, node4?.y]).size > 1).toBe(true);
    expect(
      (node2?.y ?? 0) !== (node3?.y ?? 0) ||
        (node2?.y ?? 0) !== (node4?.y ?? 0),
    ).toBe(true);
  });
});
