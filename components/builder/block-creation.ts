import {
  BadgeCheck,
  CalendarDays,
  Hash,
  Link2,
  Paperclip,
  Radio,
  Rows3,
  SquareCheck,
  Star,
  TextCursorInput,
  Type,
  type LucideIcon,
} from "lucide-react";

import { getBlockDisplayLabel } from "@/lib/branching";
import type { BuilderBlock } from "@/lib/form-types";
import {
  findPageByBlock,
  resolvePages,
  type PageDefinition,
} from "@/lib/pages";

export type BlockType = BuilderBlock["type"];

export const blockIcons: Record<BlockType, LucideIcon> = {
  TEXT: Type,
  SHORT_TEXT: TextCursorInput,
  LONG_TEXT: Rows3,
  SINGLE_CHOICE: Radio,
  MULTIPLE_CHOICE: SquareCheck,
  NUMBER: Hash,
  LINK: Link2,
  AGREEMENT: BadgeCheck,
  DATE: CalendarDays,
  RATING: Star,
  FILE_UPLOAD: Paperclip,
};

export const blockCreationOrder: BlockType[] = [
  "TEXT",
  "SHORT_TEXT",
  "LONG_TEXT",
  "NUMBER",
  "LINK",
  "DATE",
  "RATING",
  "FILE_UPLOAD",
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "AGREEMENT",
];

// One rendered stretch of the block list: a registry page with its blocks
// (definition set, header rendered) or a run of standalone blocks whose
// pageId is null or missing from the registry (no header). Consecutive
// standalone pages are folded into one section, because the sidebar shows
// them as one headerless run.
export type BuilderPageSection = {
  id: string;
  definition: PageDefinition | null;
  blocks: BuilderBlock[];
};

type PageIdFactory = () => string;

function byPosition(a: BuilderBlock, b: BuilderBlock) {
  return a.position - b.position;
}

function blockPageId(block: BuilderBlock) {
  return block.pageId ?? null;
}

// Sections in display order: non-empty pages ordered by their first block,
// empty registry pages kept by registry order between the pages they follow.
export function buildPageSections(
  blocks: BuilderBlock[],
  pages: PageDefinition[],
): BuilderPageSection[] {
  const resolved = resolvePages(blocks, pages);
  const withBlocks = new Set(
    resolved.filter((page) => page.definition).map((page) => page.id),
  );
  const empty = pages.filter((definition) => !withBlocks.has(definition.id));
  const registryIndex = new Map<string, number>();
  pages.forEach((definition, index) => {
    if (!registryIndex.has(definition.id)) {
      registryIndex.set(definition.id, index);
    }
  });

  const sections: BuilderPageSection[] = [];
  let pendingEmpty = 0;

  const pushSection = (section: BuilderPageSection) => {
    const previous = sections[sections.length - 1];

    // Standalone blocks that follow each other read as one headerless run.
    if (previous && !previous.definition && !section.definition) {
      previous.blocks.push(...section.blocks);
      return;
    }

    sections.push(section);
  };

  for (const page of resolved) {
    if (page.definition) {
      const currentIndex = registryIndex.get(page.definition.id) ?? Infinity;

      while (
        pendingEmpty < empty.length &&
        (registryIndex.get(empty[pendingEmpty].id) ?? Infinity) < currentIndex
      ) {
        sections.push({
          id: empty[pendingEmpty].id,
          definition: empty[pendingEmpty],
          blocks: [],
        });
        pendingEmpty++;
      }
    }

    pushSection({
      id: page.id,
      definition: page.definition,
      blocks: [...page.blocks],
    });
  }

  while (pendingEmpty < empty.length) {
    sections.push({
      id: empty[pendingEmpty].id,
      definition: empty[pendingEmpty],
      blocks: [],
    });
    pendingEmpty++;
  }

  return sections;
}

// The registry rewritten in display order, so the stored array order stays
// consistent with the order the block positions give the pages.
function reorderRegistryByDisplay(
  pages: PageDefinition[],
  blocks: BuilderBlock[],
): PageDefinition[] {
  const sectionOrder = new Map(
    buildPageSections(blocks, pages).map((section, index) => [
      section.id,
      index,
    ]),
  );

  return [...pages].sort(
    (a, b) =>
      (sectionOrder.get(a.id) ?? Infinity) -
      (sectionOrder.get(b.id) ?? Infinity),
  );
}

// Before any page operation the registry must cover every block: with no
// registry the whole form becomes one page, and in a form that already has
// pages each headerless run of blocks becomes a page of its own. After this,
// every rendered section carries a definition.
function materializeRegistry(
  blocks: BuilderBlock[],
  pages: PageDefinition[],
  createPageId: PageIdFactory,
): { blocks: BuilderBlock[]; pages: PageDefinition[] } {
  if (pages.length === 0) {
    const id = createPageId();

    return {
      blocks: blocks.map((block) => ({ ...block, pageId: id })),
      pages: [{ id }],
    };
  }

  const registry = new Set(pages.map((definition) => definition.id));
  const nextBlocks = blocks.map((block) => ({ ...block }));
  const nextPages = [...pages];
  let runStart = -1;

  const closeRun = (runEnd: number) => {
    if (runStart < 0) {
      return;
    }

    const id = createPageId();

    for (let index = runStart; index < runEnd; index += 1) {
      nextBlocks[index].pageId = id;
    }

    nextPages.push({ id });
    runStart = -1;
  };

  nextBlocks.forEach((block, index) => {
    if (blockPageId(block) && registry.has(blockPageId(block) as string)) {
      closeRun(index);
      return;
    }

    if (runStart < 0) {
      runStart = index;
    }
  });
  closeRun(nextBlocks.length);

  return {
    blocks: nextBlocks,
    pages: reorderRegistryByDisplay(nextPages, nextBlocks),
  };
}

// The page a new block lands on: the page of the block it is created after,
// or the last section when the block is appended at the end. null means the
// block stands on its own, which keeps a form without pages exactly as it
// was.
export function pageIdForNewBlock(args: {
  pages: PageDefinition[];
  blocks: BuilderBlock[];
  afterBlockId: string | null;
}): string | null {
  if (args.pages.length === 0) {
    return null;
  }

  const ordered = [...args.blocks].sort(byPosition);

  if (!args.afterBlockId) {
    const sections = buildPageSections(ordered, args.pages);
    const lastSection = sections[sections.length - 1];

    return lastSection?.definition ? lastSection.definition.id : null;
  }

  const anchor = ordered.find((block) => block.id === args.afterBlockId);

  if (!anchor) {
    return null;
  }

  const anchorPage = findPageByBlock(
    resolvePages(ordered, args.pages),
    anchor.id,
  );

  return anchorPage?.definition ? anchorPage.definition.id : null;
}

// Starts a page at the gap below afterBlockId: the rest of that block's page
// moves to a fresh page, so a gap at the end of a page starts an empty one.
// Returns null when the anchor block is unknown.
export function splitPageAfter(args: {
  blocks: BuilderBlock[];
  pages: PageDefinition[];
  afterBlockId: string;
  createPageId?: PageIdFactory;
}): { blocks: BuilderBlock[]; pages: PageDefinition[] } | null {
  const createPageId = args.createPageId ?? (() => crypto.randomUUID());
  const ordered = [...args.blocks].sort(byPosition);
  const anchorIndex = ordered.findIndex(
    (block) => block.id === args.afterBlockId,
  );

  if (anchorIndex < 0) {
    return null;
  }

  const materialized = materializeRegistry(ordered, args.pages, createPageId);
  const anchorPageId = blockPageId(materialized.blocks[anchorIndex]);
  const runStart = anchorIndex + 1;
  let runEnd = runStart;

  while (
    runEnd < materialized.blocks.length &&
    blockPageId(materialized.blocks[runEnd]) === anchorPageId
  ) {
    runEnd += 1;
  }

  const newPageId = createPageId();
  const blocks = materialized.blocks.map((block, index) =>
    index >= runStart && index < runEnd
      ? { ...block, pageId: newPageId }
      : block,
  );
  const pages = reorderRegistryByDisplay(
    [...materialized.pages, { id: newPageId }],
    blocks,
  );

  return { blocks, pages };
}

// Deletes a page: its blocks move to the page before it. The first page is
// not deletable while later pages exist; deleting the only page clears the
// registry and the blocks fall back to single-block pages. Returns null when
// the page is unknown or protected.
export function deletePageById(args: {
  blocks: BuilderBlock[];
  pages: PageDefinition[];
  pageId: string;
  createPageId?: PageIdFactory;
}): { blocks: BuilderBlock[]; pages: PageDefinition[] } | null {
  const createPageId = args.createPageId ?? (() => crypto.randomUUID());
  const ordered = [...args.blocks].sort(byPosition);
  const displaySections = buildPageSections(ordered, args.pages);
  const displayIndex = displaySections.findIndex(
    (section) => section.id === args.pageId && section.definition,
  );

  if (displayIndex < 0) {
    return null;
  }

  const hasOtherPages = displaySections.some(
    (section, index) => index !== displayIndex && section.definition,
  );

  // The only page: clearing the registry returns the form to the look it had
  // before pages, with every block back on a page of its own.
  if (!hasOtherPages) {
    return { blocks: ordered.map((block) => ({ ...block })), pages: [] };
  }

  if (displayIndex === 0) {
    return null;
  }

  const materialized = materializeRegistry(ordered, args.pages, createPageId);
  const sections = buildPageSections(materialized.blocks, materialized.pages);
  const index = sections.findIndex(
    (section) => section.id === args.pageId && section.definition,
  );
  const previous = index > 0 ? sections[index - 1] : null;

  if (index < 0 || !previous?.definition) {
    return null;
  }

  const blocks = materialized.blocks.map((block) =>
    blockPageId(block) === args.pageId
      ? { ...block, pageId: previous.definition?.id ?? null }
      : block,
  );
  const pages = reorderRegistryByDisplay(
    materialized.pages.filter((definition) => definition.id !== args.pageId),
    blocks,
  );

  return { blocks, pages };
}

// Moves a whole page to another place in the form: its run of blocks and its
// registry entry travel together, so the page keeps its blocks and its repeat
// settings. The target anchors the landing spot: the dragged page lands after
// it when moving down the list, before it when moving up. Returns null when
// either page is unknown or the pages coincide.
export function movePageToAnchor(args: {
  blocks: BuilderBlock[];
  pages: PageDefinition[];
  draggedPageId: string;
  targetPageId: string;
}): { blocks: BuilderBlock[]; pages: PageDefinition[] } | null {
  const sections = buildPageSections(args.blocks, args.pages);
  const fromIndex = sections.findIndex(
    (section) => section.definition?.id === args.draggedPageId,
  );
  const toIndex = sections.findIndex(
    (section) => section.definition?.id === args.targetPageId,
  );

  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return null;
  }

  // Removing the dragged section shifts the target by one when it came later,
  // so splicing at the target's index puts the page after it when moving down
  // and before it when moving up.
  const [moved] = sections.splice(fromIndex, 1);
  sections.splice(toIndex, 0, moved);

  const blocks = sections
    .flatMap((section) => section.blocks)
    .map((block, index) => ({ ...block, position: index }));
  const pages = sections.flatMap((section) =>
    section.definition ? [section.definition] : [],
  );

  return { blocks, pages };
}

// The page a dragged block receives after being dropped on overBlockId:
// the page of that block, or undefined when the page does not change.
export function pageIdAfterDrop(args: {
  blocks: BuilderBlock[];
  pages: PageDefinition[];
  draggedBlockId: string;
  overBlockId: string;
}): string | null | undefined {
  if (args.pages.length === 0) {
    return undefined;
  }

  const ordered = [...args.blocks].sort(byPosition);
  const resolved = resolvePages(ordered, args.pages);
  const overPage = findPageByBlock(resolved, args.overBlockId);

  if (!overPage) {
    return undefined;
  }

  const draggedPage = findPageByBlock(resolved, args.draggedBlockId);

  if (draggedPage?.id === overPage.id) {
    return undefined;
  }

  return overPage.definition ? overPage.definition.id : null;
}

// The count questions the repeat control of the page at sectionIndex offers:
// the number blocks of the pages displayed before it, skipping pages that
// repeat themselves. Headerless runs never repeat, so their blocks qualify.
export function countBlockCandidates(
  sections: BuilderPageSection[],
  sectionIndex: number,
): Array<{ id: string; title: string }> {
  const candidates: Array<{ id: string; title: string }> = [];

  for (const section of sections.slice(0, sectionIndex)) {
    if (section.definition?.repeat) {
      continue;
    }

    for (const block of section.blocks) {
      if (block.type === "NUMBER") {
        candidates.push({ id: block.id, title: getBlockDisplayLabel(block) });
      }
    }
  }

  return candidates;
}

// The flat-list placement for a block created at a gap inside a section:
// before the block that follows the gap, wherever that block lives, or at
// the end of the form when no block follows.
export function insertionForGap(
  sections: BuilderPageSection[],
  sectionIndex: number,
  gapIndex: number,
): { kind: "end" } | { kind: "before"; blockId: string } {
  const section = sections[sectionIndex];

  if (!section) {
    return { kind: "end" };
  }

  if (gapIndex < section.blocks.length) {
    return { kind: "before", blockId: section.blocks[gapIndex].id };
  }

  for (let index = sectionIndex + 1; index < sections.length; index += 1) {
    const nextSection = sections[index];

    if (nextSection.blocks.length > 0) {
      return { kind: "before", blockId: nextSection.blocks[0].id };
    }
  }

  return { kind: "end" };
}
