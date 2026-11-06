import { z } from "zod";

import type { SerializedBlock } from "@/lib/blocks";

// The page registry stored in Form.pagesJson. The registry gives pages stable
// identities; display order comes from block positions. A repeating page
// names the number block whose answer sets how many instances it has.
export const pageRepeatSchema = z.object({
  countBlockId: z.string().min(1),
});

export const pageDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().max(100).optional(),
  repeat: pageRepeatSchema.optional(),
});

export type PageRepeatSettings = z.infer<typeof pageRepeatSchema>;
export type PageDefinition = z.infer<typeof pageDefinitionSchema>;

// A resolved page: either a registry page with its blocks, or a standalone
// block (pageId null or unknown to the registry) whose page id is the block
// id. definition is null only for standalone pages.
export type ResolvedPage = {
  id: string;
  definition: PageDefinition | null;
  blocks: SerializedBlock[];
};

export function parsePageRegistry(value: unknown): PageDefinition[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    const parsed = pageDefinitionSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

// Pages in display order: sorted by position, grouped by pageId, a page's
// place fixed by its first block. Registry entries without blocks produce no
// page; duplicate registry ids are collapsed to the first entry.
export function resolvePages(
  blocks: SerializedBlock[],
  pagesJson: unknown,
): ResolvedPage[] {
  const registry = parsePageRegistry(pagesJson);
  const definitions = new Map<string, PageDefinition>();
  for (const definition of registry) {
    if (!definitions.has(definition.id)) {
      definitions.set(definition.id, definition);
    }
  }

  const ordered = [...blocks].sort((a, b) => a.position - b.position);
  const pages = new Map<string, ResolvedPage>();
  const order: string[] = [];

  for (const block of ordered) {
    const definition = block.pageId
      ? (definitions.get(block.pageId) ?? null)
      : null;
    const id = definition ? definition.id : block.id;

    let page = pages.get(id);
    if (!page) {
      page = { id, definition, blocks: [] };
      pages.set(id, page);
      order.push(id);
    }

    page.blocks.push(block);
  }

  return order.map((id) => pages.get(id) as ResolvedPage);
}

export function findPageByBlock(
  pages: ResolvedPage[],
  blockId: string,
): ResolvedPage | null {
  return (
    pages.find((page) => page.blocks.some((block) => block.id === blockId)) ??
    null
  );
}
