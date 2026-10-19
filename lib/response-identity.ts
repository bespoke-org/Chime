import type { SerializedBlock, ShortTextBlockConfig } from "@/lib/blocks";

export type ResponseIdentityEntry = {
  key: string | null;
  blockId: string;
  title: string;
  value: string;
};

// The answers to short-text questions the creator marked as identifying the
// respondent, in block order. Shared by the webhook and the responses pages.
export function collectResponseIdentity(
  blocks: Array<Pick<SerializedBlock, "id" | "type" | "title" | "config">>,
  answers: Record<string, unknown>,
): ResponseIdentityEntry[] {
  return blocks.flatMap((block) => {
    if (block.type !== "SHORT_TEXT") {
      return [];
    }

    const config = block.config as Partial<ShortTextBlockConfig>;
    const value = answers[block.id];

    if (!config.identity || typeof value !== "string" || !value) {
      return [];
    }

    return [
      {
        key: config.identityKey ?? null,
        blockId: block.id,
        title: block.title,
        value,
      },
    ];
  });
}

export function formatResponseIdentity(identity: ResponseIdentityEntry[]) {
  return identity.map((entry) => entry.value).join(" · ");
}
