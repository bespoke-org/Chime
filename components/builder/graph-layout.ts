import {
  BRANCHING_GRAPH_COLUMN_GAP,
  BRANCHING_GRAPH_ROW_GAP,
} from "@/lib/branching-graph";

type Size = { width: number; height: number };
type Rect = Size & { x: number; y: number };

// The minimap only helps when part of the graph is outside the canvas.
export function shouldShowMinimap(
  contentBounds: Size,
  viewport: Size,
  zoom: number,
) {
  if (viewport.width <= 0 || viewport.height <= 0) {
    return false;
  }

  return (
    contentBounds.width * zoom > viewport.width ||
    contentBounds.height * zoom > viewport.height
  );
}

function intersects(left: Rect, right: Rect) {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

// Places a new node in the column right of its predecessor, moving it down a
// row at a time while that spot is taken by another node.
export function getInsertedNodePosition(predecessor: Rect, otherNodes: Rect[]) {
  const candidate = {
    x: predecessor.x + predecessor.width + BRANCHING_GRAPH_COLUMN_GAP,
    y: predecessor.y,
    width: predecessor.width,
    height: predecessor.height,
  };

  while (otherNodes.some((node) => intersects(candidate, node))) {
    candidate.y += predecessor.height + BRANCHING_GRAPH_ROW_GAP;
  }

  return { x: candidate.x, y: candidate.y };
}
