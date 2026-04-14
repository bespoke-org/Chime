import {
  getBranchRules,
  getDefaultNextBlockId,
  getEndForm,
  type BranchOperator,
  type SerializedBlock,
} from "@/lib/blocks";
import { getBlockDisplayLabel, getPossibleNextBlockIds } from "@/lib/branching";

const GRAPH_PADDING_X = 48;
const GRAPH_PADDING_Y = 48;
export const BRANCHING_GRAPH_NODE_WIDTH = 248;
export const BRANCHING_GRAPH_NODE_HEIGHT = 125;
export const BRANCHING_GRAPH_COLUMN_GAP = 72;
export const BRANCHING_GRAPH_ROW_GAP = 88;

export type BranchingGraphEdgeKind = "linear" | "default" | "rule";

export type BranchingGraphNode = {
  blockId: string;
  column: number;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  block: SerializedBlock;
};

export type BranchingGraphEdge = {
  id: string;
  sourceBlockId: string;
  targetBlockId: string;
  kind: BranchingGraphEdgeKind;
  ruleIndex?: number;
  operator?: BranchOperator;
  value?: string | null;
};

export type BranchingGraphData = {
  nodes: BranchingGraphNode[];
  edges: BranchingGraphEdge[];
  width: number;
  height: number;
};

function createFanOffset(index: number, total: number) {
  if (total <= 1) {
    return 0;
  }

  const centeredIndex = index - (total - 1) / 2;
  return centeredIndex * 2;
}

function getOutgoingEdgeSortWeight(edge: BranchingGraphEdge) {
  if (edge.kind === "linear") {
    return 0;
  }

  if (edge.kind === "default") {
    return 1;
  }

  return 2;
}

export function buildBranchingGraph(
  blocks: SerializedBlock[],
): BranchingGraphData {
  const blockById = new Map(blocks.map((block) => [block.id, block]));
  const edges: BranchingGraphEdge[] = [];

  blocks.forEach((block, blockIndex) => {
    const possibleNextBlockIds = new Set(
      getPossibleNextBlockIds(blocks, block),
    );
    const defaultNextBlockId = getDefaultNextBlockId(block.config);
    const linearNextBlockId = blocks[blockIndex + 1]?.id ?? null;

    if (getEndForm(block.config)) {
      return;
    }

    getBranchRules(block.config).forEach((rule, ruleIndex) => {
      const targetBlock = blockById.get(rule.targetBlockId);

      if (!targetBlock || targetBlock.position <= block.position) {
        return;
      }

      edges.push({
        id: `${block.id}:rule:${ruleIndex}:${rule.targetBlockId}`,
        sourceBlockId: block.id,
        targetBlockId: rule.targetBlockId,
        kind: "rule",
        ruleIndex,
        operator: rule.operator,
        value: rule.value,
      });
    });

    if (
      defaultNextBlockId &&
      possibleNextBlockIds.has(defaultNextBlockId) &&
      blockById.has(defaultNextBlockId)
    ) {
      edges.push({
        id: `${block.id}:default:${defaultNextBlockId}`,
        sourceBlockId: block.id,
        targetBlockId: defaultNextBlockId,
        kind: "default",
      });
    }

    if (
      !defaultNextBlockId &&
      linearNextBlockId &&
      possibleNextBlockIds.has(linearNextBlockId) &&
      blockById.has(linearNextBlockId)
    ) {
      edges.push({
        id: `${block.id}:linear:${linearNextBlockId}`,
        sourceBlockId: block.id,
        targetBlockId: linearNextBlockId,
        kind: "linear",
      });
    }
  });

  const edgesBySource = new Map<string, BranchingGraphEdge[]>();
  const edgesByTarget = new Map<string, BranchingGraphEdge[]>();

  edges.forEach((edge) => {
    const outgoing = edgesBySource.get(edge.sourceBlockId) ?? [];
    outgoing.push(edge);
    edgesBySource.set(edge.sourceBlockId, outgoing);

    const incoming = edgesByTarget.get(edge.targetBlockId) ?? [];
    incoming.push(edge);
    edgesByTarget.set(edge.targetBlockId, incoming);
  });

  edgesBySource.forEach((outgoingEdges, blockId) => {
    outgoingEdges.sort((left, right) => {
      const weightDifference =
        getOutgoingEdgeSortWeight(left) - getOutgoingEdgeSortWeight(right);

      if (weightDifference !== 0) {
        return weightDifference;
      }

      const leftTargetPosition =
        blockById.get(left.targetBlockId)?.position ?? 0;
      const rightTargetPosition =
        blockById.get(right.targetBlockId)?.position ?? 0;

      return leftTargetPosition - rightTargetPosition;
    });
    edgesBySource.set(blockId, outgoingEdges);
  });

  const rowById = new Map<string, number>(blocks.map((block) => [block.id, 0]));

  for (let pass = 0; pass < 6; pass += 1) {
    blocks.forEach((block) => {
      const incomingEdges = edgesByTarget.get(block.id) ?? [];

      if (!incomingEdges.length) {
        return;
      }

      const suggestedRows = incomingEdges.map((edge) => {
        const sourceRow = rowById.get(edge.sourceBlockId) ?? 0;
        const outgoingEdges = edgesBySource.get(edge.sourceBlockId) ?? [];
        const edgeIndex = outgoingEdges.findIndex(
          (outgoingEdge) => outgoingEdge.id === edge.id,
        );

        return sourceRow + createFanOffset(edgeIndex, outgoingEdges.length);
      });

      const averageSuggestedRow =
        suggestedRows.reduce((sum, row) => sum + row, 0) / suggestedRows.length;

      const existingRow = rowById.get(block.id) ?? 0;
      rowById.set(block.id, existingRow * 0.2 + averageSuggestedRow * 0.8);
    });

    [...blocks].reverse().forEach((block) => {
      const outgoingEdges = edgesBySource.get(block.id) ?? [];

      if (!outgoingEdges.length) {
        return;
      }

      const suggestedRows = outgoingEdges.map((edge, index) => {
        const targetRow = rowById.get(edge.targetBlockId) ?? 0;
        return targetRow - createFanOffset(index, outgoingEdges.length);
      });

      const averageSuggestedRow =
        suggestedRows.reduce((sum, row) => sum + row, 0) / suggestedRows.length;

      const existingRow = rowById.get(block.id) ?? 0;
      rowById.set(block.id, existingRow * 0.75 + averageSuggestedRow * 0.25);
    });
  }

  blocks.forEach((block) => {
    rowById.set(block.id, Math.round(rowById.get(block.id) ?? 0));
  });

  const minRow = Math.min(0, ...Array.from(rowById.values()));
  const normalizedRowOffset = Math.abs(minRow);

  const nodes = blocks.map((block) => {
    const row = (rowById.get(block.id) ?? 0) + normalizedRowOffset;
    const column = block.position;

    return {
      blockId: block.id,
      column,
      row,
      x:
        GRAPH_PADDING_X +
        column * (BRANCHING_GRAPH_NODE_WIDTH + BRANCHING_GRAPH_COLUMN_GAP),
      y:
        GRAPH_PADDING_Y +
        row * (BRANCHING_GRAPH_NODE_HEIGHT + BRANCHING_GRAPH_ROW_GAP),
      width: BRANCHING_GRAPH_NODE_WIDTH,
      height: BRANCHING_GRAPH_NODE_HEIGHT,
      label: getBlockDisplayLabel(block),
      block,
    } satisfies BranchingGraphNode;
  });

  const width = nodes.length
    ? Math.max(...nodes.map((node) => node.x + node.width)) + GRAPH_PADDING_X
    : GRAPH_PADDING_X * 2 + BRANCHING_GRAPH_NODE_WIDTH;
  const height = nodes.length
    ? Math.max(...nodes.map((node) => node.y + node.height)) + GRAPH_PADDING_Y
    : GRAPH_PADDING_Y * 2 + BRANCHING_GRAPH_NODE_HEIGHT;

  return {
    nodes,
    edges,
    width,
    height,
  };
}
