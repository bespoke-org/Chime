"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { PanelLeftClose, Plus } from "lucide-react";
import type {
  Dispatch,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  SetStateAction,
} from "react";

import {
  blockCreationOrder,
  blockIcons,
  type BlockType,
} from "@/components/builder/block-creation";
import {
  getInsertedNodePosition,
  shouldShowMinimap,
} from "@/components/builder/graph-layout";
import { BlockEditorPanel } from "@/components/form-builder-panels";
import { useI18n } from "@/components/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { blockTypeTranslationKeys, type BranchOperator } from "@/lib/blocks";
import { type BranchValidationIssue } from "@/lib/branching";
import {
  buildBranchingGraph,
  type BranchingGraphEdge,
} from "@/lib/branching-graph";
import type {
  BranchRuleDraft,
  ChoiceOptionDraft,
} from "@/lib/form-builder-drafts";
import type { BuilderBlock } from "@/lib/form-types";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

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
  startCameraX: number;
  startCameraY: number;
};

type GraphCamera = {
  x: number;
  y: number;
  zoom: number;
};

type GraphViewport = {
  left: number;
  top: number;
  width: number;
  height: number;
  zoom: number;
  canvasWidth: number;
  canvasHeight: number;
};

const MIN_GRAPH_ZOOM = 0.5;
const MAX_GRAPH_ZOOM = 2;
const DEFAULT_GRAPH_ZOOM = 1;

type GraphNodePositionOverride = {
  x: number;
  y: number;
};

const GRAPH_LAYOUT_STORAGE_KEY_PREFIX = "lively-forms:branching-graph-layout:";
const GRAPH_INSPECTOR_WIDTH_STORAGE_KEY_PREFIX =
  "lively-forms:branching-graph-inspector-width:";
const GRAPH_CANVAS_PADDING = 720;
const DEFAULT_IMMERSIVE_INSPECTOR_WIDTH = 560;
// Matches the panel's left-4 inset.
const IMMERSIVE_INSPECTOR_OFFSET = 16;
const MIN_IMMERSIVE_INSPECTOR_WIDTH = 420;
const MAX_IMMERSIVE_INSPECTOR_WIDTH = 960;

type ImmersiveInspectorWidthBounds = {
  min: number;
  max: number;
};

function getGraphLayoutStorageKey(formId: string) {
  return `${GRAPH_LAYOUT_STORAGE_KEY_PREFIX}${formId}`;
}

function getGraphInspectorWidthStorageKey(formId: string) {
  return `${GRAPH_INSPECTOR_WIDTH_STORAGE_KEY_PREFIX}${formId}`;
}

function getImmersiveInspectorWidthBounds(viewportWidth: number) {
  const availableWidth = Math.max(280, viewportWidth - 32);
  const preferredMaxWidth = Math.min(
    MAX_IMMERSIVE_INSPECTOR_WIDTH,
    Math.round(viewportWidth * 0.5),
  );
  const min = Math.min(MIN_IMMERSIVE_INSPECTOR_WIDTH, availableWidth);
  const max = Math.max(min, Math.min(availableWidth, preferredMaxWidth));

  return { min, max } satisfies ImmersiveInspectorWidthBounds;
}

function clampImmersiveInspectorWidth(width: number, viewportWidth: number) {
  const bounds = getImmersiveInspectorWidthBounds(viewportWidth);
  return Math.min(bounds.max, Math.max(bounds.min, width));
}

function readPersistedInspectorWidth(formId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(
      getGraphInspectorWidthStorageKey(formId),
    );

    if (!rawValue) {
      return null;
    }

    const parsedValue = Number(rawValue);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
}

function persistInspectorWidth(formId: string, width: number) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      getGraphInspectorWidthStorageKey(formId),
      String(width),
    );
  } catch {
    // Ignore storage failures so graph mode remains usable.
  }
}

function readPersistedGraphLayout(formId: string) {
  if (typeof window === "undefined") {
    return {} as Record<string, GraphNodePositionOverride>;
  }

  try {
    const rawValue = window.localStorage.getItem(
      getGraphLayoutStorageKey(formId),
    );

    if (!rawValue) {
      return {} as Record<string, GraphNodePositionOverride>;
    }

    const parsedValue = JSON.parse(rawValue) as Record<
      string,
      Partial<GraphNodePositionOverride>
    >;

    return Object.fromEntries(
      Object.entries(parsedValue).flatMap(([blockId, position]) =>
        typeof position?.x === "number" && typeof position?.y === "number"
          ? [[blockId, { x: position.x, y: position.y }]]
          : [],
      ),
    );
  } catch {
    return {} as Record<string, GraphNodePositionOverride>;
  }
}

function persistGraphLayout(
  formId: string,
  overrides: Record<string, GraphNodePositionOverride>,
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (!Object.keys(overrides).length) {
      window.localStorage.removeItem(getGraphLayoutStorageKey(formId));
      return;
    }

    window.localStorage.setItem(
      getGraphLayoutStorageKey(formId),
      JSON.stringify(overrides),
    );
  } catch {
    // Ignore storage failures so graph mode remains usable.
  }
}

type GraphNodeDragState = {
  pointerId: number;
  blockIds: string[];
  startClientX: number;
  startClientY: number;
  startPositions: Record<string, GraphNodePositionOverride>;
  moved: boolean;
};

type GraphSelectionRect = {
  pointerId: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  additive: boolean;
};

type ImmersiveInspectorResizeState = {
  startClientX: number;
  startWidth: number;
};

type SafariGestureEvent = Event & {
  clientX: number;
  clientY: number;
  scale: number;
};

export function BranchingGraphWorkspace({
  formId,
  allBlocks,
  selectedBlockId,
  blockDraft,
  branchRulesDraft,
  branchValidationIssues,
  selectedBlockIcon,
  choiceOptionsDraft,
  setChoiceOptionsDraft,
  setBlockDraft,
  setBranchRulesDraft,
  deleteBlock,
  saveBlock,
  busy,
  onSelectBlock,
  onAddBlockAfter,
  immersive = false,
  hideInspector = false,
  immersiveInspectorOpen = false,
  immersiveFormTitle,
  onCloseImmersiveInspector,
  onClearSelection,
  overlay,
}: {
  formId: string;
  allBlocks: BuilderBlock[];
  selectedBlockId: string | null;
  selectedGraphEdgeId?: string | null;
  blockDraft: BuilderBlock | null;
  branchRulesDraft: BranchRuleDraft[];
  branchValidationIssues: BranchValidationIssue[];
  selectedBlockIcon: LucideIcon | null;
  choiceOptionsDraft: ChoiceOptionDraft[];
  setChoiceOptionsDraft: Dispatch<SetStateAction<ChoiceOptionDraft[]>>;
  setBlockDraft: Dispatch<SetStateAction<BuilderBlock | null>>;
  setBranchRulesDraft: Dispatch<SetStateAction<BranchRuleDraft[]>>;
  deleteBlock: (blockId: string) => void;
  saveBlock: () => Promise<boolean>;
  busy: string | null;
  onSelectBlock: (blockId: string) => void;
  onAddBlockAfter?: (blockId: string, blockType: BlockType) => void;
  immersive?: boolean;
  hideInspector?: boolean;
  immersiveInspectorOpen?: boolean;
  immersiveFormTitle?: string;
  onCloseImmersiveInspector?: () => void;
  onClearSelection?: () => void;
  overlay?: ReactNode;
}) {
  const { t } = useI18n();
  const graphScrollRef = useRef<HTMLDivElement | null>(null);
  const graphSceneRef = useRef<HTMLDivElement | null>(null);
  const graphPanStateRef = useRef<GraphPanState | null>(null);
  const graphNodeDragStateRef = useRef<GraphNodeDragState | null>(null);
  const immersiveInspectorResizeStateRef =
    useRef<ImmersiveInspectorResizeState | null>(null);
  const suppressNodeClickRef = useRef<string | null>(null);
  const insertAfterBlockIdRef = useRef<string | null>(null);
  const knownBlockIdsRef = useRef<Set<string> | null>(null);
  const addMenuRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedGraphCameraRef = useRef(false);
  const hasLoadedPersistedGraphLayoutRef = useRef(false);
  const graphCameraRef = useRef<GraphCamera>({
    x: 0,
    y: 0,
    zoom: DEFAULT_GRAPH_ZOOM,
  });
  const gestureStartZoomRef = useRef(DEFAULT_GRAPH_ZOOM);
  const isNativeGestureZoomingRef = useRef(false);
  const [isPanningGraph, setIsPanningGraph] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [graphNodePositionOverrides, setGraphNodePositionOverrides] = useState<
    Record<string, GraphNodePositionOverride>
  >({});
  const [immersiveInspectorWidth, setImmersiveInspectorWidth] = useState(
    DEFAULT_IMMERSIVE_INSPECTOR_WIDTH,
  );
  const [isResizingImmersiveInspector, setIsResizingImmersiveInspector] =
    useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>(() =>
    selectedBlockId ? [selectedBlockId] : [],
  );
  const [selectionRect, setSelectionRect] = useState<GraphSelectionRect | null>(
    null,
  );
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [addMenuNodeId, setAddMenuNodeId] = useState<string | null>(null);
  const [graphViewport, setGraphViewport] = useState<GraphViewport>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    zoom: DEFAULT_GRAPH_ZOOM,
    canvasWidth: 0,
    canvasHeight: 0,
  });
  const graph = useMemo(() => buildBranchingGraph(allBlocks), [allBlocks]);
  const viewportPadding = immersive ? GRAPH_CANVAS_PADDING : 0;
  // While the panel is open, the graph may pan right far enough to clear it.
  const inspectorPanAllowance =
    immersive && immersiveInspectorOpen
      ? IMMERSIVE_INSPECTOR_OFFSET + immersiveInspectorWidth
      : 0;

  useEffect(() => {
    const persistedOverrides = readPersistedGraphLayout(formId);
    const validBlockIds = new Set(allBlocks.map((block) => block.id));
    const nextOverrides = Object.fromEntries(
      Object.entries(persistedOverrides).filter(([blockId]) =>
        validBlockIds.has(blockId),
      ),
    );

    hasLoadedPersistedGraphLayoutRef.current = false;
    setGraphNodePositionOverrides(nextOverrides);
    persistGraphLayout(formId, nextOverrides);
    hasLoadedPersistedGraphLayoutRef.current = true;
  }, [formId, allBlocks]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const persistedWidth = readPersistedInspectorWidth(formId);
    const nextWidth = clampImmersiveInspectorWidth(
      persistedWidth ?? DEFAULT_IMMERSIVE_INSPECTOR_WIDTH,
      window.innerWidth,
    );

    setImmersiveInspectorWidth(nextWidth);
    persistInspectorWidth(formId, nextWidth);
  }, [formId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    function handleResize() {
      setImmersiveInspectorWidth((current) => {
        const nextWidth = clampImmersiveInspectorWidth(
          current,
          window.innerWidth,
        );
        persistInspectorWidth(formId, nextWidth);
        return nextWidth;
      });
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [formId]);

  useEffect(() => {
    if (selectedBlockId) {
      setSelectedNodeIds((current) =>
        current.length > 1 && current.includes(selectedBlockId)
          ? current
          : [selectedBlockId],
      );
      return;
    }

    setSelectedNodeIds((current) => (current.length > 1 ? current : []));
  }, [selectedBlockId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.code === "Space") {
        setIsSpacePressed(true);
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.code === "Space") {
        setIsSpacePressed(false);
      }
    }

    function handleBlur() {
      setIsSpacePressed(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !isResizingImmersiveInspector) {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      const resizeState = immersiveInspectorResizeStateRef.current;

      if (!resizeState) {
        return;
      }

      const deltaX = event.clientX - resizeState.startClientX;
      const nextWidth = clampImmersiveInspectorWidth(
        resizeState.startWidth + deltaX,
        window.innerWidth,
      );

      setImmersiveInspectorWidth(nextWidth);
    }

    function stopResizing() {
      immersiveInspectorResizeStateRef.current = null;
      setIsResizingImmersiveInspector(false);
    }

    function handlePointerUp() {
      persistInspectorWidth(formId, immersiveInspectorWidth);
      stopResizing();
    }

    function handleBlur() {
      persistInspectorWidth(formId, immersiveInspectorWidth);
      stopResizing();
    }

    const previousBodyCursor = document.body.style.cursor;
    const previousBodyUserSelect = document.body.style.userSelect;

    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.body.style.cursor = previousBodyCursor;
      document.body.style.userSelect = previousBodyUserSelect;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [formId, immersiveInspectorWidth, isResizingImmersiveInspector]);

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
  useEffect(() => {
    const knownBlockIds = knownBlockIdsRef.current;
    const afterBlockId = insertAfterBlockIdRef.current;
    knownBlockIdsRef.current = new Set(allBlocks.map((block) => block.id));
    insertAfterBlockIdRef.current = null;

    if (!knownBlockIds || !afterBlockId) {
      return;
    }

    const newBlockId = allBlocks.find(
      (block) => !knownBlockIds.has(block.id),
    )?.id;
    const predecessor = nodesById.get(afterBlockId);

    if (!newBlockId || !predecessor) {
      return;
    }

    const position = getInsertedNodePosition(
      predecessor,
      positionedNodes.filter(
        (node) => node.blockId !== newBlockId && node.blockId !== afterBlockId,
      ),
    );

    setGraphNodePositionOverrides((current) => {
      const nextOverrides = { ...current, [newBlockId]: position };
      persistGraphLayout(formId, nextOverrides);
      return nextOverrides;
    });
  }, [allBlocks, formId, nodesById, positionedNodes]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!addMenuRef.current?.contains(event.target as Node)) {
        setAddMenuNodeId(null);
      }
    }

    if (!addMenuNodeId) {
      return;
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [addMenuNodeId]);

  const renderedGraphWidth = positionedNodes.length
    ? Math.max(...positionedNodes.map((node) => node.x + node.width))
    : graph.width;
  const renderedGraphHeight = positionedNodes.length
    ? Math.max(...positionedNodes.map((node) => node.y + node.height))
    : graph.height;
  const selectedNodeIdSet = useMemo(
    () => new Set(selectedNodeIds),
    [selectedNodeIds],
  );

  function clampGraphZoom(value: number) {
    return Math.min(MAX_GRAPH_ZOOM, Math.max(MIN_GRAPH_ZOOM, value));
  }

  function getGraphCoordinates(clientX: number, clientY: number) {
    const container = graphScrollRef.current;

    if (!container) {
      return null;
    }

    const rect = container.getBoundingClientRect();
    return {
      x:
        (clientX - rect.left - graphCameraRef.current.x) /
        graphCameraRef.current.zoom,
      y:
        (clientY - rect.top - graphCameraRef.current.y) /
        graphCameraRef.current.zoom,
    };
  }

  function getSelectionBounds(rect: GraphSelectionRect) {
    return {
      left: Math.min(rect.startX, rect.currentX),
      right: Math.max(rect.startX, rect.currentX),
      top: Math.min(rect.startY, rect.currentY),
      bottom: Math.max(rect.startY, rect.currentY),
    };
  }

  function getNodesWithinSelection(rect: GraphSelectionRect) {
    const bounds = getSelectionBounds(rect);

    return positionedNodes
      .filter((node) => {
        const left = node.x;
        const top = node.y;
        const right = left + node.width;
        const bottom = top + node.height;

        return (
          right >= bounds.left &&
          left <= bounds.right &&
          bottom >= bounds.top &&
          top <= bounds.bottom
        );
      })
      .map((node) => node.blockId);
  }

  const syncGraphViewport = useCallback(
    (camera: GraphCamera = graphCameraRef.current) => {
      const container = graphScrollRef.current;

      if (!container) {
        return;
      }

      setGraphViewport({
        left: -camera.x / camera.zoom,
        top: -camera.y / camera.zoom,
        width: container.clientWidth / camera.zoom,
        height: container.clientHeight / camera.zoom,
        zoom: camera.zoom,
        canvasWidth: container.clientWidth,
        canvasHeight: container.clientHeight,
      });
    },
    [],
  );

  const applyGraphCamera = useCallback(
    (nextCamera: GraphCamera) => {
      const container = graphScrollRef.current;
      const zoom = clampGraphZoom(nextCamera.zoom);
      const scaledWidth = renderedGraphWidth * zoom;
      const scaledHeight = renderedGraphHeight * zoom;

      let x = nextCamera.x;
      let y = nextCamera.y;

      if (container) {
        const extraPanX = viewportPadding + inspectorPanAllowance;
        const extraPanY = viewportPadding;
        // A graph smaller than the view may also pan up and left as far as
        // it pans down and right from the centered position.
        const minX =
          scaledWidth <= container.clientWidth
            ? Math.min(0, (container.clientWidth - scaledWidth) / 2 - extraPanX)
            : container.clientWidth - scaledWidth - extraPanX;
        const minY =
          scaledHeight <= container.clientHeight
            ? Math.min(
                0,
                (container.clientHeight - scaledHeight) / 2 - extraPanY,
              )
            : container.clientHeight - scaledHeight - extraPanY;
        const maxX =
          scaledWidth <= container.clientWidth
            ? (container.clientWidth - scaledWidth) / 2 + extraPanX
            : extraPanX;
        const maxY =
          scaledHeight <= container.clientHeight
            ? (container.clientHeight - scaledHeight) / 2 + extraPanY
            : extraPanY;

        x = Math.min(maxX, Math.max(minX, x));
        y = Math.min(maxY, Math.max(minY, y));
      }

      const camera = {
        x,
        y,
        zoom,
      } satisfies GraphCamera;

      graphCameraRef.current = camera;

      if (graphSceneRef.current) {
        graphSceneRef.current.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
      }

      syncGraphViewport(camera);
    },
    [
      inspectorPanAllowance,
      renderedGraphHeight,
      renderedGraphWidth,
      syncGraphViewport,
      viewportPadding,
    ],
  );

  // When the panel opens over the block that was just selected, pan the
  // graph right so the block stays visible beside the panel.
  const revealedBlockIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!immersive || !immersiveInspectorOpen || !selectedBlockId) {
      revealedBlockIdRef.current = null;
      return;
    }

    if (revealedBlockIdRef.current === selectedBlockId) {
      return;
    }

    revealedBlockIdRef.current = selectedBlockId;
    const container = graphScrollRef.current;
    const node = nodesById.get(selectedBlockId);

    if (!container || !node) {
      return;
    }

    const camera = graphCameraRef.current;
    const nodeLeft =
      container.getBoundingClientRect().left + camera.x + node.x * camera.zoom;
    const panelRight =
      IMMERSIVE_INSPECTOR_OFFSET + immersiveInspectorWidth + 24;

    if (nodeLeft < panelRight) {
      applyGraphCamera({ ...camera, x: camera.x + panelRight - nodeLeft });
    }
  }, [
    applyGraphCamera,
    immersive,
    immersiveInspectorOpen,
    immersiveInspectorWidth,
    nodesById,
    selectedBlockId,
  ]);

  const updateGraphZoomAtPoint = useCallback(
    (nextZoom: number, clientX: number, clientY: number) => {
      const container = graphScrollRef.current;
      const previousCamera = graphCameraRef.current;
      const clampedZoom = clampGraphZoom(nextZoom);

      if (!container || clampedZoom === previousCamera.zoom) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      const graphX = (localX - previousCamera.x) / previousCamera.zoom;
      const graphY = (localY - previousCamera.y) / previousCamera.zoom;

      applyGraphCamera({
        x: localX - graphX * clampedZoom,
        y: localY - graphY * clampedZoom,
        zoom: clampedZoom,
      });
    },
    [applyGraphCamera],
  );

  useEffect(() => {
    const container = graphScrollRef.current;
    const firstNode = positionedNodes[0];

    if (!container) {
      return;
    }

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    if (!hasInitializedGraphCameraRef.current && firstNode) {
      if (containerWidth <= 0 || containerHeight <= 0) {
        return;
      }

      applyGraphCamera({
        x: 0,
        y:
          containerHeight / 2 -
          (firstNode.y + firstNode.height / 2) * DEFAULT_GRAPH_ZOOM,
        zoom: DEFAULT_GRAPH_ZOOM,
      });
      hasInitializedGraphCameraRef.current = true;
      return;
    }

    applyGraphCamera(graphCameraRef.current);
  }, [applyGraphCamera, positionedNodes]);

  useEffect(() => {
    const container = graphScrollRef.current;

    if (!container || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      syncGraphViewport();
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [syncGraphViewport]);

  useEffect(() => {
    const container = graphScrollRef.current;

    if (!container || typeof window === "undefined") {
      return;
    }

    function handleNativeWheel(event: WheelEvent) {
      event.preventDefault();
      event.stopPropagation();

      if (event.ctrlKey) {
        if (isNativeGestureZoomingRef.current) {
          return;
        }

        updateGraphZoomAtPoint(
          graphCameraRef.current.zoom * Math.exp(-event.deltaY * 0.004),
          event.clientX,
          event.clientY,
        );
        return;
      }

      applyGraphCamera({
        x: graphCameraRef.current.x - event.deltaX,
        y: graphCameraRef.current.y - event.deltaY,
        zoom: graphCameraRef.current.zoom,
      });
    }

    function handleGestureStart(event: Event) {
      event.preventDefault();
      event.stopPropagation();
      isNativeGestureZoomingRef.current = true;
      gestureStartZoomRef.current = graphCameraRef.current.zoom;

      if (typeof document !== "undefined") {
        document.body.style.overscrollBehavior = "none";
      }
    }

    function handleGestureChange(event: Event) {
      const gestureEvent = event as SafariGestureEvent;
      event.preventDefault();
      event.stopPropagation();
      isNativeGestureZoomingRef.current = true;
      updateGraphZoomAtPoint(
        gestureStartZoomRef.current * gestureEvent.scale,
        gestureEvent.clientX,
        gestureEvent.clientY,
      );
    }

    function handleGestureEnd(event: Event) {
      event.preventDefault();
      event.stopPropagation();
      isNativeGestureZoomingRef.current = false;
      gestureStartZoomRef.current = graphCameraRef.current.zoom;

      if (typeof document !== "undefined") {
        document.body.style.overscrollBehavior = "";
      }
    }

    container.addEventListener("wheel", handleNativeWheel, {
      passive: false,
    });
    container.addEventListener("gesturestart", handleGestureStart, {
      passive: false,
    } as AddEventListenerOptions);
    container.addEventListener("gesturechange", handleGestureChange, {
      passive: false,
    } as AddEventListenerOptions);
    container.addEventListener("gestureend", handleGestureEnd, {
      passive: false,
    } as AddEventListenerOptions);

    return () => {
      container.removeEventListener("wheel", handleNativeWheel);
      container.removeEventListener("gesturestart", handleGestureStart);
      container.removeEventListener("gesturechange", handleGestureChange);
      container.removeEventListener("gestureend", handleGestureEnd);

      if (typeof document !== "undefined") {
        document.body.style.overscrollBehavior = "";
      }
    };
  }, [applyGraphCamera, updateGraphZoomAtPoint]);

  function handleGraphPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    const container = graphScrollRef.current;

    if (!container) {
      return;
    }

    if (isSpacePressed) {
      graphPanStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startCameraX: graphCameraRef.current.x,
        startCameraY: graphCameraRef.current.y,
      };

      container.setPointerCapture(event.pointerId);
      setIsPanningGraph(true);
      return;
    }

    if (
      (event.target as HTMLElement).closest("button, [data-graph-add-menu]")
    ) {
      return;
    }

    const graphPoint = getGraphCoordinates(event.clientX, event.clientY);

    if (!graphPoint) {
      return;
    }

    const nextSelection = {
      pointerId: event.pointerId,
      startX: graphPoint.x,
      startY: graphPoint.y,
      currentX: graphPoint.x,
      currentY: graphPoint.y,
      additive: event.metaKey || event.ctrlKey || event.shiftKey,
    } satisfies GraphSelectionRect;

    setSelectionRect(nextSelection);
    container.setPointerCapture(event.pointerId);
  }

  function handleGraphPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const container = graphScrollRef.current;
    const panState = graphPanStateRef.current;
    const activeSelectionRect = selectionRect;

    if (container && panState && panState.pointerId === event.pointerId) {
      applyGraphCamera({
        x: panState.startCameraX + (event.clientX - panState.startX),
        y: panState.startCameraY + (event.clientY - panState.startY),
        zoom: graphCameraRef.current.zoom,
      });
      return;
    }

    if (
      !container ||
      !activeSelectionRect ||
      activeSelectionRect.pointerId !== event.pointerId
    ) {
      return;
    }

    const graphPoint = getGraphCoordinates(event.clientX, event.clientY);

    if (!graphPoint) {
      return;
    }

    const nextSelection = {
      ...activeSelectionRect,
      currentX: graphPoint.x,
      currentY: graphPoint.y,
    } satisfies GraphSelectionRect;

    setSelectionRect(nextSelection);

    const selectedIds = getNodesWithinSelection(nextSelection);
    setSelectedNodeIds((current) =>
      nextSelection.additive
        ? Array.from(new Set([...current, ...selectedIds]))
        : selectedIds,
    );
  }

  function handleGraphPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const container = graphScrollRef.current;
    const panState = graphPanStateRef.current;
    const activeSelectionRect = selectionRect;

    if (!container) {
      return;
    }

    if (panState && panState.pointerId === event.pointerId) {
      if (container.hasPointerCapture(event.pointerId)) {
        container.releasePointerCapture(event.pointerId);
      }

      graphPanStateRef.current = null;
      setIsPanningGraph(false);
      return;
    }

    if (
      !activeSelectionRect ||
      activeSelectionRect.pointerId !== event.pointerId
    ) {
      return;
    }

    if (container.hasPointerCapture(event.pointerId)) {
      container.releasePointerCapture(event.pointerId);
    }

    const selectedIds = getNodesWithinSelection(activeSelectionRect);
    setSelectedNodeIds((current) =>
      activeSelectionRect.additive
        ? Array.from(new Set([...current, ...selectedIds]))
        : selectedIds,
    );
    setSelectionRect(null);

    // A click or marquee on empty canvas deselects the block.
    if (!activeSelectionRect.additive && selectedIds.length === 0) {
      onClearSelection?.();
    }
  }

  function handleGraphNodePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    node: (typeof positionedNodes)[number],
  ) {
    if (event.button !== 0 || isSpacePressed) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const isAdditiveSelection =
      event.metaKey || event.ctrlKey || event.shiftKey;

    if (isAdditiveSelection) {
      return;
    }

    const blockIdsToDrag = selectedNodeIdSet.has(node.blockId)
      ? selectedNodeIds
      : [node.blockId];
    const startPositions = Object.fromEntries(
      blockIdsToDrag.map((blockId) => {
        const dragNode = nodesById.get(blockId);
        return [
          blockId,
          {
            x: dragNode?.x ?? 24,
            y: dragNode?.y ?? 24,
          },
        ];
      }),
    );

    setSelectedNodeIds(blockIdsToDrag);

    graphNodeDragStateRef.current = {
      pointerId: event.pointerId,
      blockIds: blockIdsToDrag,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPositions,
      moved: false,
    };

    if (event.currentTarget.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
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

    if (!dragState.moved) {
      return;
    }

    const nextOverrides = {
      ...graphNodePositionOverrides,
    };

    for (const blockId of dragState.blockIds) {
      const startPosition = dragState.startPositions[blockId];

      if (!startPosition) {
        continue;
      }

      nextOverrides[blockId] = {
        x: Math.max(24, startPosition.x + deltaX / graphCameraRef.current.zoom),
        y: Math.max(24, startPosition.y + deltaY / graphCameraRef.current.zoom),
      };
    }

    setGraphNodePositionOverrides(nextOverrides);

    if (hasLoadedPersistedGraphLayoutRef.current) {
      persistGraphLayout(formId, nextOverrides);
    }
  }

  function handleGraphNodePointerUp(
    event: ReactPointerEvent<HTMLButtonElement>,
    node: (typeof positionedNodes)[number],
  ) {
    const dragState = graphNodeDragStateRef.current;
    const isAdditiveSelection =
      event.metaKey || event.ctrlKey || event.shiftKey;

    if (
      event.currentTarget.hasPointerCapture?.(event.pointerId) &&
      event.currentTarget.releasePointerCapture
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    graphNodeDragStateRef.current = null;

    if (isSpacePressed) {
      return;
    }

    if (!dragState || dragState.pointerId !== event.pointerId) {
      if (isAdditiveSelection) {
        setSelectedNodeIds((current) =>
          current.includes(node.blockId)
            ? current.filter((blockId) => blockId !== node.blockId)
            : [...current, node.blockId],
        );
      }
      return;
    }

    if (dragState.moved) {
      suppressNodeClickRef.current = node.blockId;
      return;
    }

    if (isAdditiveSelection) {
      setSelectedNodeIds((current) =>
        current.includes(node.blockId)
          ? current.filter((blockId) => blockId !== node.blockId)
          : [...current, node.blockId],
      );
      return;
    }

    setSelectedNodeIds([node.blockId]);
    onSelectBlock(node.blockId);
  }

  function handleGraphNodeClick(blockId: string) {
    if (suppressNodeClickRef.current === blockId) {
      suppressNodeClickRef.current = null;
      return;
    }

    if (isSpacePressed) {
      return;
    }

    setSelectedNodeIds([blockId]);
    onSelectBlock(blockId);
  }

  function handleGraphNodePointerLeave(
    event: ReactPointerEvent<HTMLElement>,
    blockId: string,
  ) {
    const relatedNodeId = (
      event.relatedTarget as HTMLElement | null
    )?.closest?.<HTMLElement>("[data-graph-node-id]")?.dataset.graphNodeId;

    if (relatedNodeId === blockId) {
      return;
    }

    setHoveredNodeId((current) => (current === blockId ? null : current));
  }

  function chooseBlockTypeAfter(blockId: string, blockType: BlockType) {
    insertAfterBlockIdRef.current = blockId;
    setAddMenuNodeId(null);
    onAddBlockAfter?.(blockId, blockType);
  }

  function handleImmersiveInspectorResizeStart(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (!immersive) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    immersiveInspectorResizeStateRef.current = {
      startClientX: event.clientX,
      startWidth: immersiveInspectorWidth,
    };
    setIsResizingImmersiveInspector(true);
  }

  const inspectorContent =
    !selectedBlockId || !blockDraft ? (
      <div>
        <h3 className="font-display text-3xl text-[var(--ink)]">
          {t("builder.graphSelectionTitle")}
        </h3>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          {t("builder.graphSelectionDescription")}
        </p>
      </div>
    ) : (
      <BlockEditorPanel
        allBlocks={allBlocks}
        blockDraft={blockDraft}
        selectedBlockIcon={selectedBlockIcon}
        choiceOptionsDraft={choiceOptionsDraft}
        branchRulesDraft={branchRulesDraft}
        branchValidationIssues={branchValidationIssues}
        setChoiceOptionsDraft={setChoiceOptionsDraft}
        setBranchRulesDraft={setBranchRulesDraft}
        setBlockDraft={setBlockDraft}
        deleteBlock={deleteBlock}
        saveBlock={() => {
          void saveBlock();
        }}
        busy={busy}
      />
    );

  const minimapWidth = 192;
  const minimapHeight = 128;
  const minimapScale = Math.min(
    minimapWidth / Math.max(renderedGraphWidth, 1),
    minimapHeight / Math.max(renderedGraphHeight, 1),
  );
  const minimapContentWidth = renderedGraphWidth * minimapScale;
  const minimapContentHeight = renderedGraphHeight * minimapScale;
  const minimapOffsetX = (minimapWidth - minimapContentWidth) / 2;
  const minimapOffsetY = (minimapHeight - minimapContentHeight) / 2;

  return (
    <div>
      <Card
        className={cn(
          "relative overflow-hidden bg-[var(--bg-strong)] p-0",
          immersive &&
            "h-full min-h-[calc(100dvh-5.5rem)] rounded-none border-x-0 border-y-0 bg-transparent shadow-none",
        )}
      >
        {graph.nodes.length ? (
          <div
            ref={graphScrollRef}
            className={cn(
              "relative overflow-hidden overscroll-x-none",
              immersive
                ? "h-full min-h-[calc(100dvh-5.5rem)] bg-transparent"
                : "h-[420px] lg:h-[calc(100vh-18rem)]",
            )}
            onPointerDown={handleGraphPointerDown}
            onPointerMove={handleGraphPointerMove}
            onPointerUp={handleGraphPointerEnd}
            onPointerCancel={handleGraphPointerEnd}
            style={{
              cursor: isPanningGraph
                ? "grabbing"
                : isSpacePressed
                  ? "grab"
                  : selectionRect
                    ? "crosshair"
                    : "default",
              overscrollBehavior: "contain",
            }}
          >
            <div
              ref={graphSceneRef}
              className="absolute left-0 top-0 origin-top-left will-change-transform"
              style={{
                width: `${renderedGraphWidth}px`,
                height: `${renderedGraphHeight}px`,
                transform: `translate(0px, 0px) scale(${DEFAULT_GRAPH_ZOOM})`,
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

                  const paddedSourceNode = {
                    ...sourceNode,
                    x: sourceNode.x,
                    y: sourceNode.y,
                  };
                  const paddedTargetNode = {
                    ...targetNode,
                    x: targetNode.x,
                    y: targetNode.y,
                  };
                  const isActiveFromBlock = selectedNodeIdSet.has(
                    edge.sourceBlockId,
                  );

                  return (
                    <path
                      key={edge.id}
                      d={getEdgePath(paddedSourceNode, paddedTargetNode)}
                      fill="none"
                      stroke={
                        isActiveFromBlock
                          ? "color-mix(in srgb, var(--accent) 65%, var(--line-strong))"
                          : "color-mix(in srgb, var(--line-strong) 80%, transparent)"
                      }
                      strokeWidth={isActiveFromBlock ? 3 : 2}
                      strokeDasharray={
                        edge.kind === "linear" ? undefined : "8 6"
                      }
                      opacity={isActiveFromBlock ? 1 : 0.72}
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

                const paddedSourceNode = {
                  ...sourceNode,
                  x: sourceNode.x,
                  y: sourceNode.y,
                };
                const paddedTargetNode = {
                  ...targetNode,
                  x: targetNode.x,
                  y: targetNode.y,
                };

                const labelPosition = getEdgeLabelPosition(
                  paddedSourceNode,
                  paddedTargetNode,
                );
                const isActiveFromBlock = selectedNodeIdSet.has(
                  edge.sourceBlockId,
                );

                return (
                  <div
                    key={`${edge.id}-label`}
                    className={cn(
                      "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-3 py-1 text-xs font-medium shadow-[var(--shadow-card)]",
                      isActiveFromBlock
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)]"
                        : "border-[color:var(--line)] bg-[var(--bg-strong)] text-[var(--muted)]",
                    )}
                    style={{
                      left: `${labelPosition.x}px`,
                      top: `${labelPosition.y}px`,
                    }}
                  >
                    {edgeLabel}
                  </div>
                );
              })}

              {selectionRect ? (
                <div
                  className="pointer-events-none absolute border border-[var(--accent)] bg-[color:color-mix(in_srgb,var(--accent-soft)_55%,transparent)]"
                  style={{
                    left: `${Math.min(selectionRect.startX, selectionRect.currentX)}px`,
                    top: `${Math.min(selectionRect.startY, selectionRect.currentY)}px`,
                    width: `${Math.abs(selectionRect.currentX - selectionRect.startX)}px`,
                    height: `${Math.abs(selectionRect.currentY - selectionRect.startY)}px`,
                  }}
                />
              ) : null}

              {positionedNodes.map((node) => {
                const isSelected = selectedNodeIdSet.has(node.blockId);
                const isAddMenuOpen = addMenuNodeId === node.blockId;
                const showAddButton =
                  Boolean(onAddBlockAfter) &&
                  (isSelected ||
                    isAddMenuOpen ||
                    hoveredNodeId === node.blockId);

                return (
                  <Fragment key={node.blockId}>
                    <button
                      type="button"
                      data-graph-node-id={node.blockId}
                      className={cn(
                        "absolute flex items-start justify-start rounded-[24px] border p-4 text-left transition",
                        isSelected
                          ? immersive
                            ? "border-[var(--accent)] bg-[var(--surface-strong)] shadow-[var(--shadow-elevated)] ring-1 ring-[color:color-mix(in_srgb,var(--accent)_28%,transparent)]"
                            : "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[var(--shadow-elevated)]"
                          : immersive
                            ? "border-[color:var(--line)] bg-[var(--surface-strong)] shadow-[var(--shadow-surface)] hover:border-[var(--line-strong)] hover:bg-[var(--surface)]"
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
                      onPointerUp={(event) =>
                        handleGraphNodePointerUp(event, node)
                      }
                      onPointerCancel={(event) =>
                        handleGraphNodePointerUp(event, node)
                      }
                      onPointerEnter={() => setHoveredNodeId(node.blockId)}
                      onPointerLeave={(event) =>
                        handleGraphNodePointerLeave(event, node.blockId)
                      }
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
                    {showAddButton ? (
                      // The wrapper starts at the card edge so the pointer never
                      // crosses a gap that would clear the hover state.
                      <div
                        data-graph-node-id={node.blockId}
                        className="absolute z-10 -translate-y-1/2 py-2 pl-1.5 pr-2"
                        style={{
                          left: `${node.x + node.width}px`,
                          top: `${node.y + node.height / 2}px`,
                        }}
                        onPointerDown={(event) => event.stopPropagation()}
                        onPointerEnter={() => setHoveredNodeId(node.blockId)}
                        onPointerLeave={(event) =>
                          handleGraphNodePointerLeave(event, node.blockId)
                        }
                      >
                        <button
                          type="button"
                          className="flex size-7 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] shadow-[var(--shadow-card)] transition hover:bg-[var(--accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                          aria-label={t("builder.addBlockAfter")}
                          title={t("builder.addBlockAfter")}
                          aria-expanded={isAddMenuOpen}
                          aria-haspopup="menu"
                          onClick={() =>
                            setAddMenuNodeId((current) =>
                              current === node.blockId ? null : node.blockId,
                            )
                          }
                        >
                          <Plus size={16} strokeWidth={2.5} />
                        </button>
                      </div>
                    ) : null}
                    {isAddMenuOpen ? (
                      <div
                        ref={addMenuRef}
                        data-graph-add-menu
                        className="absolute z-20 min-w-[220px] rounded-[18px] border border-[color:var(--line)] bg-[var(--bg-strong)] p-2 shadow-[var(--shadow-card)]"
                        style={{
                          left: `${node.x + node.width + 44}px`,
                          top: `${node.y}px`,
                        }}
                      >
                        <div className="grid gap-1">
                          {blockCreationOrder.map((type) => {
                            const Icon = blockIcons[type];

                            return (
                              <button
                                key={type}
                                type="button"
                                className="flex items-center gap-2 rounded-[12px] px-3 py-2 text-left text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--surface)]"
                                onClick={() =>
                                  chooseBlockTypeAfter(node.blockId, type)
                                }
                              >
                                <Icon className="size-4" />
                                {t(blockTypeTranslationKeys[type])}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </Fragment>
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

        {overlay ? (
          <div className="absolute left-4 top-4 z-20 sm:left-6 sm:top-6">
            {overlay}
          </div>
        ) : null}

        {graph.nodes.length &&
        shouldShowMinimap(
          { width: renderedGraphWidth, height: renderedGraphHeight },
          {
            width: graphViewport.canvasWidth,
            height: graphViewport.canvasHeight,
          },
          graphViewport.zoom,
        ) ? (
          <div
            className={cn(
              "pointer-events-none absolute right-4 z-10",
              immersive ? "bottom-4 sm:bottom-4" : "bottom-4",
            )}
          >
            <div className="overflow-hidden rounded-[18px] border border-[color:var(--line)] bg-[var(--surface)] shadow-[var(--shadow-surface)]">
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
                  fill="var(--surface)"
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
                  const isSelected = selectedNodeIdSet.has(node.blockId);

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

      {hideInspector ? null : immersive ? (
        immersiveInspectorOpen ? (
          <aside
            className="fixed bottom-4 left-4 top-4 z-20 overflow-hidden rounded-xl border border-[color:var(--line)] bg-[var(--surface-strong)] shadow-[var(--shadow-elevated)] sm:bottom-4 sm:left-4 sm:top-4"
            style={{ width: `${immersiveInspectorWidth}px` }}
          >
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize block settings panel"
              className={cn(
                "absolute inset-y-0 right-0 z-10 w-1 cursor-ew-resize touch-none",
                isResizingImmersiveInspector && "bg-[var(--accent-soft)]",
              )}
              onPointerDown={handleImmersiveInspectorResizeStart}
            />
            <div className="flex h-full flex-col overflow-hidden pr-1">
              <div className="border-b border-[color:var(--line)] px-5 py-4">
                <div className="flex items-center gap-4">
                  <Button
                    size="icon"
                    variant="secondary"
                    onClick={onCloseImmersiveInspector}
                    aria-label="Close block settings"
                    title="Close block settings"
                  >
                    <PanelLeftClose className="size-4" />
                  </Button>
                  <div className="min-w-0 flex-1">
                    {immersiveFormTitle ? (
                      <p className="truncate font-display text-2xl text-[var(--ink)]">
                        {immersiveFormTitle}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                {inspectorContent}
              </div>
            </div>
          </aside>
        ) : null
      ) : (
        <Card className="bg-[var(--bg-strong)] p-6">{inspectorContent}</Card>
      )}
    </div>
  );
}
