import { z } from "zod";

import type { SerializedBlock } from "@/lib/blocks";
import type { PublicForm, StoredAnswerValue } from "@/lib/form-types";

export const PUBLIC_FORM_DRAFT_STORAGE_PREFIX = "chime-public-runner-draft";
export const PUBLIC_FORM_DRAFT_VERSION = 1;

// One instance of a repeating block's nested answer: the block's flat answer
// shape, or null where the instance was left unanswered (holes serialize as
// null, see the repeating-pages design).
const instanceValueSchema = z.union([
  z.string(),
  z.array(z.string()),
  z.null(),
]);

// Flat answers stay string or string[]; a repeating block stores one entry
// per instance, so the nested string[][] (and its null holes) parses too.
const answerValueSchema = z.union([z.string(), z.array(instanceValueSchema)]);

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

function isDraftAnswerValue(value: unknown): value is StoredAnswerValue {
  if (typeof value === "string") {
    return true;
  }

  return (
    Array.isArray(value) &&
    value.every(
      (instance) =>
        instance === null ||
        typeof instance === "string" ||
        (Array.isArray(instance) &&
          instance.every((item) => typeof item === "string")),
    )
  );
}

function sanitizeAnswersForDraft(
  answers: Record<string, StoredAnswerValue>,
): Record<string, StoredAnswerValue> {
  return Object.fromEntries(
    Object.entries(answers).filter(([, value]) => isDraftAnswerValue(value)),
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
    answers: Record<string, StoredAnswerValue>;
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
