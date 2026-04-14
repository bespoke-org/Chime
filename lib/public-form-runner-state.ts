import type { SerializedBlock } from "@/lib/blocks";
import { resolveNextBlockId } from "@/lib/branching";
import type { AnswerValue } from "@/lib/form-types";

export type PublicFormRunnerRoute = {
  history: string[];
  cursor: number;
};

export function createInitialRunnerRoute(
  blocks: Pick<SerializedBlock, "id">[],
): PublicFormRunnerRoute {
  const firstBlockId = blocks[0]?.id;

  return {
    history: firstBlockId ? [firstBlockId] : [],
    cursor: 0,
  };
}

export function getRouteCursor(route: PublicFormRunnerRoute) {
  return Math.min(route.cursor, Math.max(route.history.length - 1, 0));
}

export function getCurrentRouteBlockId(
  route: PublicFormRunnerRoute,
  blocks: Pick<SerializedBlock, "id">[],
) {
  const cursor = getRouteCursor(route);
  return route.history[cursor] ?? blocks[0]?.id ?? null;
}

export function getVisibleRouteTotal(args: {
  blocks: SerializedBlock[];
  currentBlockId: string | null;
  answers: Record<string, AnswerValue>;
  cursor: number;
}) {
  const { blocks, currentBlockId, answers, cursor } = args;

  if (!currentBlockId) {
    return 1;
  }

  let total = cursor + 1;
  let nextId = resolveNextBlockId(blocks, currentBlockId, answers);
  let safetyCounter = 0;

  while (nextId && safetyCounter < blocks.length) {
    total += 1;
    nextId = resolveNextBlockId(blocks, nextId, answers);
    safetyCounter += 1;
  }

  return Math.max(total, cursor + 1);
}

export function hasRunnerProgress(args: {
  answers: Record<string, AnswerValue>;
  cursor: number;
  historyLength: number;
  initialHistoryLength: number;
}) {
  const { answers, cursor, historyLength, initialHistoryLength } = args;
  const hasAnyAnswer = Object.values(answers).some((value) =>
    typeof value === "string" ? value.trim().length > 0 : value.length > 0,
  );

  return hasAnyAnswer || cursor > 0 || historyLength > initialHistoryLength;
}

export function advanceRunnerRoute(
  route: PublicFormRunnerRoute,
  sourceBlockId: string,
  nextBlockId: string,
): PublicFormRunnerRoute {
  const activeBlockId = route.history[route.cursor] ?? null;

  if (activeBlockId !== sourceBlockId) {
    return route;
  }

  const nextHistory = [
    ...route.history.slice(0, route.cursor + 1),
    nextBlockId,
  ];

  return {
    history: nextHistory,
    cursor: nextHistory.length - 1,
  };
}

export function retreatRunnerRoute(route: PublicFormRunnerRoute) {
  return {
    ...route,
    cursor: Math.max(0, route.cursor - 1),
  };
}
