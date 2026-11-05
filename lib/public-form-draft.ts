import { z } from "zod";

import { resolveNextBlockId } from "@/lib/branching";
import type { SerializedBlock } from "@/lib/blocks";
import type { AnswerValue, PublicForm } from "@/lib/form-types";

export const PUBLIC_FORM_DRAFT_STORAGE_PREFIX = "chime-public-runner-draft";
export const PUBLIC_FORM_DRAFT_VERSION = 1;

const answerValueSchema = z.union([z.string(), z.array(z.string())]);

const publicFormDraftSchema = z.object({
  version: z.literal(PUBLIC_FORM_DRAFT_VERSION),
  formId: z.string().min(1),
  fingerprint: z.string().min(1),
  answers: z.record(z.string(), answerValueSchema),
  history: z.array(z.string()),
  cursor: z.number().int().min(0),
  savedAt: z.number().int().nonnegative(),
});

export type PublicFormDraft = z.infer<typeof publicFormDraftSchema>;

export type PublicFormDraftReadResult =
  | {
      status: "missing" | "unavailable" | "invalid";
    }
  | {
      status: "ok";
      draft: PublicFormDraft;
    };

export type PublicFormDraftValidationResult =
  | {
      status: "restored";
      draft: PublicFormDraft;
    }
  | {
      status: "stale" | "invalid";
    };

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const entries = Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([key, entryValue]) =>
        `${JSON.stringify(key)}:${stableStringify(entryValue)}`,
    );

  return `{${entries.join(",")}}`;
}

function hashString(value: string) {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
}

function sanitizeBlocksForFingerprint(blocks: SerializedBlock[]) {
  return blocks.map((block) => ({
    id: block.id,
    type: block.type,
    required: block.required,
    position: block.position,
    config: block.config,
  }));
}

function sanitizeAnswersForDraft(
  answers: Record<string, AnswerValue>,
): Record<string, AnswerValue> {
  return Object.fromEntries(
    Object.entries(answers).filter((entry): entry is [string, AnswerValue] => {
      const [, value] = entry;

      return (
        typeof value === "string" ||
        (Array.isArray(value) &&
          value.every((item) => typeof item === "string"))
      );
    }),
  );
}

export function getPublicFormDraftStorageKey(formId: string) {
  return `${PUBLIC_FORM_DRAFT_STORAGE_PREFIX}:${formId}`;
}

export function createPublicFormDraftFingerprint(
  form: Pick<PublicForm, "blocks">,
) {
  return hashString(stableStringify(sanitizeBlocksForFingerprint(form.blocks)));
}

export function parsePublicFormDraft(value: unknown) {
  const parsed = publicFormDraftSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function readStoredPublicFormDraft(
  storageKey: string,
): PublicFormDraftReadResult {
  let rawDraft: string | null = null;

  try {
    rawDraft = window.localStorage.getItem(storageKey);
  } catch {
    return { status: "unavailable" };
  }

  if (!rawDraft) {
    return { status: "missing" };
  }

  try {
    const draft = parsePublicFormDraft(JSON.parse(rawDraft));
    return draft ? { status: "ok", draft } : { status: "invalid" };
  } catch {
    return { status: "invalid" };
  }
}

export function writeStoredPublicFormDraft(
  storageKey: string,
  draft: PublicFormDraft,
) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(draft));
  } catch {
    // ignore persistence failures
  }
}

export function removeStoredPublicFormDraft(storageKey: string) {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // ignore persistence failures
  }
}

export function createPublicFormDraft(
  form: Pick<PublicForm, "id" | "blocks">,
  state: {
    answers: Record<string, AnswerValue>;
    history: string[];
    cursor: number;
  },
): PublicFormDraft {
  return {
    version: PUBLIC_FORM_DRAFT_VERSION,
    formId: form.id,
    fingerprint: createPublicFormDraftFingerprint(form),
    answers: sanitizeAnswersForDraft(state.answers),
    history: [...state.history],
    cursor: state.cursor,
    savedAt: Date.now(),
  };
}

export function validatePublicFormDraft(
  form: Pick<PublicForm, "id" | "blocks">,
  draft: PublicFormDraft,
): PublicFormDraftValidationResult {
  if (
    draft.formId !== form.id ||
    draft.fingerprint !== createPublicFormDraftFingerprint(form)
  ) {
    return { status: "stale" };
  }

  const firstBlock = form.blocks[0];

  if (!firstBlock) {
    return draft.history.length === 0 && draft.cursor === 0
      ? {
          status: "restored",
          draft: {
            ...draft,
            history: [],
          },
        }
      : { status: "invalid" };
  }

  if (draft.history.length === 0 || draft.cursor >= draft.history.length) {
    return { status: "invalid" };
  }

  const activeHistory = draft.history.slice(0, draft.cursor + 1);

  if (activeHistory[0] !== firstBlock.id) {
    return { status: "invalid" };
  }

  for (let index = 0; index < activeHistory.length - 1; index += 1) {
    const currentBlockId = activeHistory[index];
    const expectedNextBlockId = activeHistory[index + 1];
    const resolvedNextBlockId = resolveNextBlockId(
      form.blocks,
      currentBlockId,
      draft.answers,
    );

    if (!resolvedNextBlockId || resolvedNextBlockId !== expectedNextBlockId) {
      return { status: "invalid" };
    }
  }

  const knownBlockIds = new Set(form.blocks.map((block) => block.id));
  const knownAnswers = Object.fromEntries(
    Object.entries(draft.answers).filter(([blockId]) =>
      knownBlockIds.has(blockId),
    ),
  );

  return {
    status: "restored",
    draft: {
      ...draft,
      answers: sanitizeAnswersForDraft(knownAnswers),
      history: activeHistory,
      cursor: activeHistory.length - 1,
    },
  };
}
