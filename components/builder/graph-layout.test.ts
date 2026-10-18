import { describe, expect, test } from "bun:test";

import {
  getInsertedNodePosition,
  shouldShowMinimap,
} from "@/components/builder/graph-layout";
import {
  BRANCHING_GRAPH_COLUMN_GAP,
  BRANCHING_GRAPH_NODE_HEIGHT,
  BRANCHING_GRAPH_NODE_WIDTH,
  BRANCHING_GRAPH_ROW_GAP,
} from "@/lib/branching-graph";

describe("shouldShowMinimap", () => {
  const viewport = { width: 1200, height: 700 };

  test("hides the minimap when the graph fits the canvas", () => {
    expect(shouldShowMinimap({ width: 900, height: 300 }, viewport, 1)).toBe(
      false,
    );
  });

  test("shows the minimap when the graph is wider than the canvas", () => {
    expect(shouldShowMinimap({ width: 1500, height: 300 }, viewport, 1)).toBe(
      true,
    );
  });

  test("shows the minimap when the graph is taller than the canvas", () => {
    expect(shouldShowMinimap({ width: 900, height: 900 }, viewport, 1)).toBe(
      true,
    );
  });

  test("shows the minimap once zooming in makes the graph overflow", () => {
    expect(shouldShowMinimap({ width: 900, height: 300 }, viewport, 2)).toBe(
      true,
    );
  });

  test("hides the minimap when zooming out makes the graph fit", () => {
    expect(shouldShowMinimap({ width: 1500, height: 300 }, viewport, 0.5)).toBe(
      false,
    );
  });

  test("hides the minimap before the canvas has been measured", () => {
    expect(
      shouldShowMinimap(
        { width: 1500, height: 900 },
        { width: 0, height: 0 },
        1,
      ),
    ).toBe(false);
  });
});

describe("getInsertedNodePosition", () => {
  const predecessor = {
    x: 48,
    y: 48,
    width: BRANCHING_GRAPH_NODE_WIDTH,
    height: BRANCHING_GRAPH_NODE_HEIGHT,
  };

  test("places the new node in the next column on the same row", () => {
    const position = getInsertedNodePosition(predecessor, []);

    expect(position.x).toBe(
      48 + BRANCHING_GRAPH_NODE_WIDTH + BRANCHING_GRAPH_COLUMN_GAP,
    );
    expect(position.y).toBe(48);
  });

  test("moves the new node down when that spot is taken", () => {
    const taken = {
      ...predecessor,
      x: 48 + BRANCHING_GRAPH_NODE_WIDTH + BRANCHING_GRAPH_COLUMN_GAP,
    };
    const position = getInsertedNodePosition(predecessor, [taken]);

    expect(position.x).toBe(taken.x);
    expect(position.y).toBe(
      48 + BRANCHING_GRAPH_NODE_HEIGHT + BRANCHING_GRAPH_ROW_GAP,
    );
  });
});
