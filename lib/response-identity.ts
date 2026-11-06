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
    const raw = answers[block.id];
    // On a repeating page the block stores one string per instance; identity
    // is the first instance.
    const value =
      typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;

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
