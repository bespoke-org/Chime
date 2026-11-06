import type { SerializedBlock } from "@/lib/blocks";
import { resolveNextPageId } from "@/lib/branching";
import type { AnswerValue, StoredAnswerValue } from "@/lib/form-types";
import type { ResolvedPage } from "@/lib/pages";
import {
  effectiveRepeatSettings,
  projectInstanceAnswers,
  resolveInstanceCount,
} from "@/lib/repeat";

export type PublicFormRunnerRoute = {
  history: string[];
  cursor: number;
};

// A route step: the page plus which instance of it the step shows. A
// non-repeating page is the same loop with one instance, index 0.
export type RunnerRouteStep = {
  pageId: string;
  instanceIndex: number;
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

export function hasRunnerProgress(args: {
  answers: Record<string, StoredAnswerValue>;
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

export function retreatRunnerRoute(
  route: PublicFormRunnerRoute,
  options: { allowBackNavigation?: boolean } = {},
) {
  if (options.allowBackNavigation === false) {
    return route;
  }

  return {
    ...route,
    cursor: Math.max(0, route.cursor - 1),
  };
}

// History entries encode steps the way drafts store them: the plain page id
// for instance 0, "<pageId>#<instanceIndex>" for later instances.
export function encodeRunnerRouteStep(step: RunnerRouteStep) {
  return step.instanceIndex > 0
    ? `${step.pageId}#${step.instanceIndex}`
    : step.pageId;
}

// Lenient parse of a history entry. A bare id (a page, or a block id of an
// older draft whose page id equals the block id) is instance 0; an instance
// suffix must name a later instance, anything else is an unknown format.
export function parseRunnerRouteStep(entry: string): RunnerRouteStep | null {
  const separatorIndex = entry.lastIndexOf("#");

  if (separatorIndex < 0) {
    return entry ? { pageId: entry, instanceIndex: 0 } : null;
  }

  const pageId = entry.slice(0, separatorIndex);
  const instanceIndex = Number(entry.slice(separatorIndex + 1));

  if (!pageId || !Number.isInteger(instanceIndex) || instanceIndex < 1) {
    return null;
  }

  return { pageId, instanceIndex };
}

export function getCurrentRouteStep(
  route: PublicFormRunnerRoute,
  blocks: Pick<SerializedBlock, "id">[],
): RunnerRouteStep | null {
  const cursor = getRouteCursor(route);
  const entry = route.history[cursor];

  if (typeof entry === "string") {
    return parseRunnerRouteStep(entry);
  }

  const firstBlockId = blocks[0]?.id;
  return firstBlockId ? { pageId: firstBlockId, instanceIndex: 0 } : null;
}

// How a page contributes steps to the route under the current answers: its
// resolved instance count, no steps at all for a count of 0, one step when it
// does not repeat or its count is not determinable yet (the page shows with
// the count message and forward blocked).
export type PageInstancePlan =
  | { kind: "single" }
  | { kind: "instances"; count: number }
  | { kind: "skipped" }
  | { kind: "blocked"; status: "missing" | "invalid" }
  | { kind: "blocked"; status: "too_large"; max: number };

export function planPageInstances(
  page: ResolvedPage,
  pages: ResolvedPage[],
  answers: Record<string, StoredAnswerValue>,
): PageInstancePlan {
  const settings = effectiveRepeatSettings(page, pages);

  if (!settings) {
    return { kind: "single" };
  }

  const count = resolveInstanceCount(
    answers[settings.countBlockId] as AnswerValue | undefined,
  );

  if (count.status === "count") {
    return count.count === 0
      ? { kind: "skipped" }
      : { kind: "instances", count: count.count };
  }

  if (count.status === "too_large") {
    return { kind: "blocked", status: count.status, max: count.max };
  }

  return { kind: "blocked", status: count.status };
}

export function getPageStepWeight(plan: PageInstancePlan) {
  if (plan.kind === "instances") {
    return plan.count;
  }

  return plan.kind === "skipped" ? 0 : 1;
}

// The instance index a page exit evaluates branch rules against: the last
// instance step of the most recent repeating page in the visited route. The
// page being left repeats exactly when its own current step is that entry,
// which is its last instance at the moment of the exit.
export function getExitProjectionIndex(args: {
  route: PublicFormRunnerRoute;
  pages: ResolvedPage[];
}) {
  const cursor = getRouteCursor(args.route);

  for (let index = cursor; index >= 0; index -= 1) {
    const step = parseRunnerRouteStep(args.route.history[index] ?? "");

    if (!step) {
      continue;
    }

    const page = args.pages.find((candidate) => candidate.id === step.pageId);

    if (page && effectiveRepeatSettings(page, args.pages)) {
      return step.instanceIndex;
    }
  }

  return 0;
}

// The answers minus one page's blocks, for evaluating the exit of a page a
// count of 0 skipped: the page contributed no answers, so its exit must not
// see the stale instance answers the browser keeps after the count dropped.
// The server-side walk holds none of them either.
function omitPageAnswers(
  answers: Record<string, StoredAnswerValue>,
  page: ResolvedPage,
): Record<string, StoredAnswerValue> {
  const pageBlockIds = new Set(page.blocks.map((block) => block.id));
  const remaining: Record<string, StoredAnswerValue> = {};

  for (const [blockId, value] of Object.entries(answers)) {
    if (!pageBlockIds.has(blockId)) {
      remaining[blockId] = value;
    }
  }

  return remaining;
}

// The page the walk lands on after leaving exitPageId, hopping over repeating
// pages whose count resolved to 0: they contribute no steps, so their own
// exit decides where the walk continues, evaluated without their stale
// instance answers. nextProjectionIndex is the instance index the landing
// page's own exit evaluates against.
export function resolveLandingPage(args: {
  pages: ResolvedPage[];
  exitPageId: string;
  projectionIndex: number;
  answers: Record<string, StoredAnswerValue>;
}): { pageId: string; nextProjectionIndex: number } | null {
  let currentPageId = args.exitPageId;
  let projectionIndex = args.projectionIndex;
  let safetyCounter = 0;

  while (safetyCounter <= args.pages.length) {
    safetyCounter += 1;

    const currentPage = args.pages.find((page) => page.id === currentPageId);

    if (!currentPage) {
      return null;
    }

    const exitAnswers =
      planPageInstances(currentPage, args.pages, args.answers).kind ===
      "skipped"
        ? omitPageAnswers(args.answers, currentPage)
        : args.answers;

    const nextPageId = resolveNextPageId(
      args.pages,
      currentPageId,
      projectInstanceAnswers(exitAnswers, args.pages, projectionIndex),
    );

    if (!nextPageId) {
      return null;
    }

    const nextPage = args.pages.find((page) => page.id === nextPageId);

    if (!nextPage) {
      return null;
    }

    const plan = planPageInstances(nextPage, args.pages, args.answers);

    if (plan.kind === "skipped") {
      currentPageId = nextPageId;
      projectionIndex = 0;
      continue;
    }

    return {
      pageId: nextPageId,
      nextProjectionIndex:
        plan.kind === "instances" ? plan.count - 1 : projectionIndex,
    };
  }

  return null;
}

// The step that follows the given step under the current answers: the next
// instance while the page unfolds, else the landing step on another page once
// the last instance submits. No following step means the form ends there.
export function resolveNextRouteStep(args: {
  pages: ResolvedPage[];
  pageId: string;
  instanceIndex: number;
  projectionIndex: number;
  answers: Record<string, StoredAnswerValue>;
}): RunnerRouteStep | null {
  const page = args.pages.find((candidate) => candidate.id === args.pageId);

  if (!page) {
    return null;
  }

  const plan = planPageInstances(page, args.pages, args.answers);

  if (plan.kind === "instances" && args.instanceIndex + 1 < plan.count) {
    return { pageId: args.pageId, instanceIndex: args.instanceIndex + 1 };
  }

  const landing = resolveLandingPage({
    pages: args.pages,
    exitPageId: args.pageId,
    projectionIndex:
      plan.kind === "instances" ? plan.count - 1 : args.projectionIndex,
    answers: args.answers,
  });

  return landing ? { pageId: landing.pageId, instanceIndex: 0 } : null;
}

// The step counterpart of the page walk: progress counts steps, so a
// repeating page contributes its current instance count, a not-yet-reached
// repeating page whose count is unanswered contributes one step, and the
// instances of the current page still ahead of the cursor count too.
export function getVisibleStepTotal(args: {
  route: PublicFormRunnerRoute;
  pages: ResolvedPage[];
  answers: Record<string, StoredAnswerValue>;
}) {
  const cursor = getRouteCursor(args.route);
  const step = getCurrentRouteStep(args.route, args.pages);

  if (!step) {
    return 1;
  }

  const currentPage = args.pages.find((page) => page.id === step.pageId);

  if (!currentPage) {
    return Math.max(cursor + 1, 1);
  }

  const plan = planPageInstances(currentPage, args.pages, args.answers);
  const remainingInstances =
    plan.kind === "instances"
      ? Math.max(plan.count - 1 - step.instanceIndex, 0)
      : 0;

  let total = cursor + 1 + remainingInstances;
  let exitPageId = currentPage.id;
  let projectionIndex =
    plan.kind === "instances"
      ? plan.count - 1
      : getExitProjectionIndex({ route: args.route, pages: args.pages });
  let safetyCounter = 0;

  while (safetyCounter <= args.pages.length) {
    safetyCounter += 1;

    const landing = resolveLandingPage({
      pages: args.pages,
      exitPageId,
      projectionIndex,
      answers: args.answers,
    });

    if (!landing) {
      break;
    }

    const landingPage = args.pages.find((page) => page.id === landing.pageId);

    if (!landingPage) {
      break;
    }

    total += getPageStepWeight(
      planPageInstances(landingPage, args.pages, args.answers),
    );
    exitPageId = landing.pageId;
    projectionIndex = landing.nextProjectionIndex;
  }

  return Math.max(total, cursor + 1);
}
