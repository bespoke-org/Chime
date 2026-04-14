"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import type {
  Dispatch,
  PointerEvent as ReactPointerEvent,
  SetStateAction,
  WheelEvent as ReactWheelEvent,
} from "react";

import { BranchRulesEditor } from "@/components/builder/branch-rules-editor";
import { useI18n } from "@/components/i18n-provider";
import { AuthoredMarkdown } from "@/components/ui/authored-markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  blockTypeTranslationKeys,
  isQuestionBlock,
  type BranchOperator,
} from "@/lib/blocks";
import {
  getBlockDisplayLabel,
  type BranchValidationIssue,
} from "@/lib/branching";
import {
  buildBranchingGraph,
  type BranchingGraphEdge,
} from "@/lib/branching-graph";
import type { BranchRuleDraft } from "@/lib/form-builder-drafts";
import type { BuilderBlock } from "@/lib/form-types";
import { cn } from "@/lib/utils";

function getEdgePath(
  source: { x: number; y: number; width: number; height: number },
  target: { x: number; y: number; width: number; height: number },
  options?: {
    minControlOffset?: number;
    controlOffsetFactor?: number;
    maxControlOffset?: number;
  },
) {
  const startX = source.x + source.width;
  const startY = source.y + source.height / 2;
  const endX = target.x;
  const endY = target.y + target.height / 2;
  const minControlOffset = options?.minControlOffset ?? 48;
  const controlOffsetFactor = options?.controlOffsetFactor ?? 0.32;
  const maxControlOffset =
    options?.maxControlOffset ?? Number.POSITIVE_INFINITY;
  const controlOffset = Math.min(
    maxControlOffset,
    Math.max(minControlOffset, Math.abs(endX - startX) * controlOffsetFactor),
  );

  return `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;
}

function getEdgeLabelPosition(
  source: { x: number; y: number; width: number; height: number },
  target: { x: number; y: number; width: number; height: number },
) {
  const startX = source.x + source.width;
  const endX = target.x;

  return {
    x: startX + (endX - startX) / 2,
    y: source.y + source.height / 2 + (target.y - source.y) / 2,
  };
}

function getBranchOperatorLabel(
  t: (key: string, values?: Record<string, string | number>) => string,
  blockType: BuilderBlock["type"],
  operator: BranchOperator,
) {
  if (
    blockType === "SINGLE_CHOICE" &&
    (operator === "equals" || operator === "not_equals")
  ) {
    return t(`builder.branchOperatorLabels.singleChoice.${operator}`);
  }

  if (blockType === "MULTIPLE_CHOICE" && operator === "contains_any") {
    return t("builder.branchOperatorLabels.multipleChoice.contains_any");
  }

  if (
    blockType === "AGREEMENT" &&
    (operator === "equals" || operator === "not_equals")
  ) {
    return t(`builder.branchOperatorLabels.agreement.${operator}`);
  }

  if (
    blockType === "DATE" &&
    ["equals", "not_equals", "gt", "gte", "lt", "lte"].includes(operator)
  ) {
    return t(`builder.branchOperatorLabels.date.${operator}`);
  }

  return t(`builder.branchOperators.${operator}`);
}

function getGraphEdgeLabel(
  t: (key: string, values?: Record<string, string | number>) => string,
  block: BuilderBlock,
  edge: BranchingGraphEdge,
) {
  if (edge.kind === "linear") {
    return null;
  }

  if (edge.kind === "default") {
    return t("builder.graphDefaultRoute");
  }

  const operatorLabel = getBranchOperatorLabel(
    t,
    block.type,
    edge.operator ?? "equals",
  );

  if (block.type === "AGREEMENT" && edge.value) {
    return `${operatorLabel}: ${t(`builder.branchAgreementValues.${edge.value}`)}`;
  }

  if (edge.value) {
    return `${operatorLabel}: ${edge.value}`;
  }

  return operatorLabel;
}

type GraphPanState = {
  pointerId: number;
  startX: number;
  startY: number;
  scrollLeft: number;
  scrollTop: number;
};

type GraphViewport = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type GraphNodePositionOverride = {
  x: number;
  y: number;
};

type GraphNodeDragState = {
  pointerId: number;
  blockId: string;
  startClientX: number;
  startClientY: number;
  startNodeX: number;
  startNodeY: number;
  moved: boolean;
};

export function BranchingGraphWorkspace({
  allBlocks,
  selectedBlockId,
  selectedGraphEdgeId,
  blockDraft,
  branchRulesDraft,
  branchValidationIssues,
  setBlockDraft,
  setBranchRulesDraft,
  saveBlock,
  busy,
  onSelectBlock,
  onSelectEdge,
}: {
  allBlocks: BuilderBlock[];
  selectedBlockId: string | null;
  selectedGraphEdgeId: string | null;
  blockDraft: BuilderBlock | null;
  branchRulesDraft: BranchRuleDraft[];
  branchValidationIssues: BranchValidationIssue[];
  setBlockDraft: Dispatch<SetStateAction<BuilderBlock | null>>;
  setBranchRulesDraft: Dispatch<SetStateAction<BranchRuleDraft[]>>;
  saveBlock: () => Promise<boolean>;
  busy: string | null;
  onSelectBlock: (blockId: string) => void;
  onSelectEdge: (edgeId: string, sourceBlockId: string) => void;
}) {
  const { t } = useI18n();
  const graphScrollRef = useRef<HTMLDivElement | null>(null);
  const graphPanStateRef = useRef<GraphPanState | null>(null);
  const graphNodeDragStateRef = useRef<GraphNodeDragState | null>(null);
  const suppressNodeClickRef = useRef<string | null>(null);
  const hasInitializedGraphCameraRef = useRef(false);
  const [isPanningGraph, setIsPanningGraph] = useState(false);
  const [graphNodePositionOverrides, setGraphNodePositionOverrides] = useState<
    Record<string, GraphNodePositionOverride>
  >({});
  const [graphViewport, setGraphViewport] = useState<GraphViewport>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });
  const graph = useMemo(() => buildBranchingGraph(allBlocks), [allBlocks]);
  const positionedNodes = useMemo(
    () =>
      graph.nodes.map((node) => {
        const override = graphNodePositionOverrides[node.blockId];
        return override ? { ...node, ...override } : node;
      }),
    [graph.nodes, graphNodePositionOverrides],
  );
  const nodesById = useMemo(
    () => new Map(positionedNodes.map((node) => [node.blockId, node])),
    [positionedNodes],
  );
  const selectedEdge =
    graph.edges.find((edge) => edge.id === selectedGraphEdgeId) ?? null;
  const selectedEdgeTarget = selectedEdge
    ? (allBlocks.find((block) => block.id === selectedEdge.targetBlockId) ??
      null)
    : null;
  const isSavingSelectedBlock = Boolean(
    blockDraft && busy === `block-${blockDraft.id}`,
  );

  function updateConfig(patch: Record<string, unknown>) {
    setBlockDraft((current) =>
      current
        ? {
            ...current,
            config: {
              ...(current.config as Record<string, unknown>),
              ...patch,
            } as BuilderBlock["config"],
          }
        : current,
    );
  }

  function syncGraphViewport() {
    const container = graphScrollRef.current;

    if (!container) {
      return;
    }

    setGraphViewport({
      left: container.scrollLeft,
      top: container.scrollTop,
      width: container.clientWidth,
      height: container.clientHeight,
    });
  }

  useEffect(() => {
    const container = graphScrollRef.current;
    const firstNode = positionedNodes[0];

    if (!container) {
      return;
    }

    if (!hasInitializedGraphCameraRef.current && firstNode) {
      const nextScrollTop = Math.max(
        0,
        firstNode.y + firstNode.height / 2 - container.clientHeight / 2,
      );
      container.scrollTop = nextScrollTop;
      hasInitializedGraphCameraRef.current = true;
    }

    syncGraphViewport();
  }, [graph.width, graph.height, positionedNodes]);

  function handleGraphPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    if ((event.target as HTMLElement).closest("button")) {
      return;
    }

    const container = graphScrollRef.current;

    if (!container) {
      return;
    }

    graphPanStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    };

    container.setPointerCapture(event.pointerId);
    setIsPanningGraph(true);
  }

  function handleGraphPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const container = graphScrollRef.current;
    const panState = graphPanStateRef.current;

    if (!container || !panState || panState.pointerId !== event.pointerId) {
      return;
    }

    container.scrollLeft =
      panState.scrollLeft - (event.clientX - panState.startX);
    container.scrollTop =
      panState.scrollTop - (event.clientY - panState.startY);
    syncGraphViewport();
  }

  function handleGraphPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const container = graphScrollRef.current;
    const panState = graphPanStateRef.current;

    if (!container || !panState || panState.pointerId !== event.pointerId) {
      return;
    }

    if (container.hasPointerCapture(event.pointerId)) {
      container.releasePointerCapture(event.pointerId);
    }

    graphPanStateRef.current = null;
    setIsPanningGraph(false);
  }

  function handleGraphNodePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    node: (typeof positionedNodes)[number],
  ) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    graphNodeDragStateRef.current = {
      pointerId: event.pointerId,
      blockId: node.blockId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startNodeX: node.x,
      startNodeY: node.y,
      moved: false,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleGraphNodePointerMove(
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    const dragState = graphNodeDragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startClientX;
    const deltaY = event.clientY - dragState.startClientY;

    if (!dragState.moved && Math.abs(deltaX) + Math.abs(deltaY) > 3) {
      dragState.moved = true;
    }

    setGraphNodePositionOverrides((current) => ({
      ...current,
      [dragState.blockId]: {
        x: Math.max(24, dragState.startNodeX + deltaX),
        y: Math.max(24, dragState.startNodeY + deltaY),
      },
    }));
  }

  function handleGraphNodePointerUp(
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    const dragState = graphNodeDragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    graphNodeDragStateRef.current = null;

    if (dragState.moved) {
      suppressNodeClickRef.current = dragState.blockId;
      return;
    }

    onSelectBlock(dragState.blockId);
  }

  function handleGraphNodeClick(blockId: string) {
    if (suppressNodeClickRef.current === blockId) {
      suppressNodeClickRef.current = null;
      return;
    }

    onSelectBlock(blockId);
  }

  function handleGraphWheel(event: ReactWheelEvent<HTMLDivElement>) {
    const container = graphScrollRef.current;

    if (!container) {
      return;
    }

    const nextScrollLeft = container.scrollLeft + event.deltaX;
    const nextScrollTop = container.scrollTop + event.deltaY;
    const canScrollHorizontally =
      container.scrollWidth > container.clientWidth && event.deltaX !== 0;
    const canScrollVertically =
      container.scrollHeight > container.clientHeight && event.deltaY !== 0;

    if (!canScrollHorizontally && !canScrollVertically) {
      return;
    }

    event.preventDefault();

    if (canScrollHorizontally) {
      container.scrollLeft = nextScrollLeft;
    }

    if (canScrollVertically) {
      container.scrollTop = nextScrollTop;
    }

    syncGraphViewport();
  }

  const minimapWidth = 192;
  const minimapHeight = 128;
  const minimapScale = Math.min(
    minimapWidth / Math.max(graph.width, 1),
    minimapHeight / Math.max(graph.height, 1),
  );
  const minimapContentWidth = graph.width * minimapScale;
  const minimapContentHeight = graph.height * minimapScale;
  const minimapOffsetX = (minimapWidth - minimapContentWidth) / 2;
  const minimapOffsetY = (minimapHeight - minimapContentHeight) / 2;

  return (
    <div className="space-y-5">
      <Card className="relative overflow-hidden bg-[var(--bg-strong)] p-0">
        {graph.nodes.length ? (
          <div
            ref={graphScrollRef}
            className="relative overflow-x-auto overflow-y-auto p-4 lg:max-h-[calc(100vh-18rem)]"
            onPointerDown={handleGraphPointerDown}
            onPointerMove={handleGraphPointerMove}
            onPointerUp={handleGraphPointerEnd}
            onPointerCancel={handleGraphPointerEnd}
            onWheel={handleGraphWheel}
            onScroll={syncGraphViewport}
            style={{
              cursor: isPanningGraph ? "grabbing" : "grab",
            }}
          >
            <div
              className="relative"
              style={{
                width: `${graph.width}px`,
                height: `${graph.height}px`,
              }}
            >
              <svg
                className="absolute inset-0 h-full w-full"
                aria-label={t("builder.graphCanvasAria")}
              >
                {graph.edges.map((edge) => {
                  const sourceNode = nodesById.get(edge.sourceBlockId);
                  const targetNode = nodesById.get(edge.targetBlockId);

                  if (!sourceNode || !targetNode) {
                    return null;
                  }

                  const isSelected = selectedGraphEdgeId === edge.id;
                  const isActiveFromBlock =
                    !isSelected && selectedBlockId === edge.sourceBlockId;

                  return (
                    <path
                      key={edge.id}
                      d={getEdgePath(sourceNode, targetNode)}
                      fill="none"
                      stroke={
                        isSelected
                          ? "var(--accent)"
                          : isActiveFromBlock
                            ? "color-mix(in srgb, var(--accent) 65%, var(--line-strong))"
                            : "color-mix(in srgb, var(--line-strong) 80%, transparent)"
                      }
                      strokeWidth={isSelected ? 3 : 2}
                      strokeDasharray={
                        edge.kind === "linear" ? undefined : "8 6"
                      }
                      opacity={isSelected || isActiveFromBlock ? 1 : 0.72}
                    />
                  );
                })}
              </svg>

              {graph.edges.map((edge) => {
                const sourceNode = nodesById.get(edge.sourceBlockId);
                const targetNode = nodesById.get(edge.targetBlockId);
                const sourceBlock = allBlocks.find(
                  (block) => block.id === edge.sourceBlockId,
                );

                if (!sourceNode || !targetNode || !sourceBlock) {
                  return null;
                }

                const edgeLabel = getGraphEdgeLabel(t, sourceBlock, edge);

                if (!edgeLabel) {
                  return null;
                }

                const labelPosition = getEdgeLabelPosition(
                  sourceNode,
                  targetNode,
                );
                const isSelected = selectedGraphEdgeId === edge.id;

                return (
                  <button
                    key={`${edge.id}-label`}
                    type="button"
                    className={cn(
                      "absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-3 py-1 text-xs font-medium shadow-[var(--shadow-card)] transition",
                      isSelected
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)]"
                        : "border-[color:var(--line)] bg-[var(--bg-strong)] text-[var(--muted)] hover:border-[var(--line-strong)] hover:text-[var(--ink)]",
                    )}
                    style={{
                      left: `${labelPosition.x}px`,
                      top: `${labelPosition.y}px`,
                    }}
                    onClick={() => onSelectEdge(edge.id, edge.sourceBlockId)}
                  >
                    {edgeLabel}
                  </button>
                );
              })}

              {positionedNodes.map((node) => {
                const isSelected = selectedBlockId === node.blockId;

                return (
                  <button
                    key={node.blockId}
                    type="button"
                    className={cn(
                      "absolute flex items-start justify-start rounded-[24px] border p-4 text-left transition",
                      isSelected
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[var(--shadow-elevated)]"
                        : "border-[color:var(--line)] bg-[var(--bg-start)] hover:border-[var(--line-strong)] hover:bg-[var(--bg)]",
                    )}
                    style={{
                      left: `${node.x}px`,
                      top: `${node.y}px`,
                      width: `${node.width}px`,
                      height: `${node.height}px`,
                    }}
                    onPointerDown={(event) =>
                      handleGraphNodePointerDown(event, node)
                    }
                    onPointerMove={handleGraphNodePointerMove}
                    onPointerUp={handleGraphNodePointerUp}
                    onPointerCancel={handleGraphNodePointerUp}
                    onClick={() => handleGraphNodeClick(node.blockId)}
                  >
                    <div className="w-full self-start">
                      <Badge>
                        {t(blockTypeTranslationKeys[node.block.type])}
                      </Badge>
                      <h3 className="mt-4 line-clamp-2 text-base font-semibold text-[var(--ink)]">
                        {node.label}
                      </h3>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex min-h-[420px] items-center justify-center p-8 text-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                {t("builder.graphModeEyebrow")}
              </p>
              <h3 className="mt-4 font-display text-3xl text-[var(--ink)]">
                {t("builder.graphEmptyTitle")}
              </h3>
              <p className="mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">
                {t("builder.graphEmptyDescription")}
              </p>
            </div>
          </div>
        )}

        {graph.nodes.length ? (
          <div className="pointer-events-none absolute bottom-4 right-4 z-10">
            <div className="overflow-hidden rounded-[18px] border border-[color:color-mix(in_srgb,var(--line)_45%,transparent)] shadow-[var(--shadow-surface)] backdrop-blur-sm">
              <svg
                aria-hidden="true"
                width={minimapWidth}
                height={minimapHeight}
                viewBox={`0 0 ${minimapWidth} ${minimapHeight}`}
                className="block"
              >
                <rect
                  x="0"
                  y="0"
                  width={minimapWidth}
                  height={minimapHeight}
                  rx="14"
                  fill="color-mix(in srgb, var(--bg-end) 92%, transparent)"
                />
                {graph.edges.map((edge) => {
                  const sourceNode = nodesById.get(edge.sourceBlockId);
                  const targetNode = nodesById.get(edge.targetBlockId);

                  if (!sourceNode || !targetNode) {
                    return null;
                  }

                  const scaledSource = {
                    ...sourceNode,
                    x: minimapOffsetX + sourceNode.x * minimapScale,
                    y: minimapOffsetY + sourceNode.y * minimapScale,
                    width: sourceNode.width * minimapScale,
                    height: sourceNode.height * minimapScale,
                  };
                  const scaledTarget = {
                    ...targetNode,
                    x: minimapOffsetX + targetNode.x * minimapScale,
                    y: minimapOffsetY + targetNode.y * minimapScale,
                    width: targetNode.width * minimapScale,
                    height: targetNode.height * minimapScale,
                  };

                  return (
                    <path
                      key={`minimap-${edge.id}`}
                      d={getEdgePath(scaledSource, scaledTarget, {
                        minControlOffset: 6,
                        controlOffsetFactor: 0.14,
                        maxControlOffset: 14,
                      })}
                      fill="none"
                      stroke="color-mix(in srgb, var(--line-strong) 75%, transparent)"
                      strokeWidth={1.25}
                      opacity={0.8}
                    />
                  );
                })}
                {positionedNodes.map((node) => {
                  const isSelected = selectedBlockId === node.blockId;

                  return (
                    <rect
                      key={`minimap-node-${node.blockId}`}
                      x={minimapOffsetX + node.x * minimapScale}
                      y={minimapOffsetY + node.y * minimapScale}
                      width={Math.max(node.width * minimapScale, 8)}
                      height={Math.max(node.height * minimapScale, 8)}
                      rx={2.5}
                      fill={
                        isSelected
                          ? "var(--accent)"
                          : "color-mix(in srgb, var(--surface-strong) 88%, transparent)"
                      }
                      stroke="color-mix(in srgb, var(--line-strong) 80%, transparent)"
                      strokeWidth={1}
                    />
                  );
                })}
                <rect
                  x={minimapOffsetX + graphViewport.left * minimapScale}
                  y={minimapOffsetY + graphViewport.top * minimapScale}
                  width={Math.max(graphViewport.width * minimapScale, 12)}
                  height={Math.max(graphViewport.height * minimapScale, 12)}
                  rx={6}
                  fill="color-mix(in srgb, var(--accent-soft) 22%, transparent)"
                  stroke="var(--accent)"
                  strokeWidth={1.5}
                />
              </svg>
            </div>
          </div>
        ) : null}
      </Card>

      <Card className="bg-[var(--bg-strong)] p-6">
        {!selectedBlockId || !blockDraft ? (
          <div>
            <h3 className="font-display text-3xl text-[var(--ink)]">
              {t("builder.graphSelectionTitle")}
            </h3>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              {t("builder.graphSelectionDescription")}
            </p>
          </div>
        ) : !isQuestionBlock(blockDraft.type) ? (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="font-display text-3xl text-[var(--ink)]">
                  {getBlockDisplayLabel(blockDraft)}
                </h3>
                {blockDraft.description ? (
                  <AuthoredMarkdown
                    content={blockDraft.description}
                    className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]"
                  />
                ) : null}
                <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                  {t("builder.graphTextBlockDescription")}
                </p>
              </div>
              <Button
                onClick={() => void saveBlock()}
                disabled={isSavingSelectedBlock}
              >
                {isSavingSelectedBlock ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : null}
                {t("builder.saveBlock")}
              </Button>
            </div>

            <BranchRulesEditor
              allBlocks={allBlocks}
              blockDraft={blockDraft}
              branchRulesDraft={branchRulesDraft}
              branchValidationIssues={branchValidationIssues}
              setBranchRulesDraft={setBranchRulesDraft}
              updateConfig={updateConfig}
            />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="font-display text-3xl text-[var(--ink)]">
                  {getBlockDisplayLabel(blockDraft)}
                </h3>
                {blockDraft.description ? (
                  <AuthoredMarkdown
                    content={blockDraft.description}
                    className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]"
                  />
                ) : null}
                {selectedEdge && selectedEdgeTarget ? (
                  <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
                    {t("builder.graphSelectedRoute", {
                      route:
                        getGraphEdgeLabel(t, blockDraft, selectedEdge) ??
                        t("builder.graphDefaultRoute"),
                      target: getBlockDisplayLabel(selectedEdgeTarget),
                    })}
                  </p>
                ) : null}
              </div>
              <Button
                onClick={() => void saveBlock()}
                disabled={isSavingSelectedBlock}
              >
                {isSavingSelectedBlock ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : null}
                {t("builder.saveBlock")}
              </Button>
            </div>

            <BranchRulesEditor
              allBlocks={allBlocks}
              blockDraft={blockDraft}
              branchRulesDraft={branchRulesDraft}
              branchValidationIssues={branchValidationIssues}
              setBranchRulesDraft={setBranchRulesDraft}
              updateConfig={updateConfig}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
