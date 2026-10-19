import type {
  FormBlock,
  FormBlockType as PrismaFormBlockType,
} from "@prisma/client";
import { z } from "zod";

import { DEFAULT_LOCALE, type AppLocale } from "@/lib/i18n";

const FORM_BLOCK_TYPES = {
  TEXT: "TEXT",
  SHORT_TEXT: "SHORT_TEXT",
  LONG_TEXT: "LONG_TEXT",
  SINGLE_CHOICE: "SINGLE_CHOICE",
  MULTIPLE_CHOICE: "MULTIPLE_CHOICE",
  NUMBER: "NUMBER",
  LINK: "LINK",
  AGREEMENT: "AGREEMENT",
  DATE: "DATE",
  RATING: "RATING",
  FILE_UPLOAD: "FILE_UPLOAD",
} as const satisfies Record<PrismaFormBlockType, PrismaFormBlockType>;

export const blockTypeValues = [
  FORM_BLOCK_TYPES.TEXT,
  FORM_BLOCK_TYPES.SHORT_TEXT,
  FORM_BLOCK_TYPES.LONG_TEXT,
  FORM_BLOCK_TYPES.SINGLE_CHOICE,
  FORM_BLOCK_TYPES.MULTIPLE_CHOICE,
  FORM_BLOCK_TYPES.NUMBER,
  FORM_BLOCK_TYPES.LINK,
  FORM_BLOCK_TYPES.AGREEMENT,
  FORM_BLOCK_TYPES.DATE,
  FORM_BLOCK_TYPES.RATING,
  FORM_BLOCK_TYPES.FILE_UPLOAD,
] as const;

export const blockTypeSchema = z.enum(blockTypeValues);

export const blockTypeLabels: Record<PrismaFormBlockType, string> = {
  TEXT: "Info text",
  SHORT_TEXT: "Short answer",
  LONG_TEXT: "Long answer",
  SINGLE_CHOICE: "Single choice",
  MULTIPLE_CHOICE: "Multiple choice",
  NUMBER: "Number",
  LINK: "Link",
  AGREEMENT: "Agreement",
  DATE: "Date",
  RATING: "Rating",
  FILE_UPLOAD: "File upload",
};

export const blockTypeTranslationKeys: Record<PrismaFormBlockType, string> = {
  TEXT: "blocks.types.TEXT",
  SHORT_TEXT: "blocks.types.SHORT_TEXT",
  LONG_TEXT: "blocks.types.LONG_TEXT",
  SINGLE_CHOICE: "blocks.types.SINGLE_CHOICE",
  MULTIPLE_CHOICE: "blocks.types.MULTIPLE_CHOICE",
  NUMBER: "blocks.types.NUMBER",
  LINK: "blocks.types.LINK",
  AGREEMENT: "blocks.types.AGREEMENT",
  DATE: "blocks.types.DATE",
  RATING: "blocks.types.RATING",
  FILE_UPLOAD: "blocks.types.FILE_UPLOAD",
};

const defaultBlockCopyByLocale: Record<
  AppLocale,
  {
    textBody: string;
    shortPlaceholder: string;
    longPlaceholder: string;
    numberPlaceholder: string;
    linkPlaceholder: string;
    agreementLabel: string;
    options: [string, string];
  }
> = {
  en: {
    textBody: "Introduce the next part of your form.",
    shortPlaceholder: "Type your answer here…",
    longPlaceholder: "Tell us a little more…",
    numberPlaceholder: "42",
    linkPlaceholder: "https://example.com",
    agreementLabel: "I agree",
    options: ["Option 1", "Option 2"],
  },
  ru: {
    textBody: "Подготовьте человека к следующей части формы.",
    shortPlaceholder: "Введите ответ…",
    longPlaceholder: "Расскажите немного подробнее…",
    numberPlaceholder: "42",
    linkPlaceholder: "https://example.com",
    agreementLabel: "Я согласен",
    options: ["Вариант 1", "Вариант 2"],
  },
};

function getDefaultBlockCopy(locale: AppLocale = DEFAULT_LOCALE) {
  return (
    defaultBlockCopyByLocale[locale] ?? defaultBlockCopyByLocale[DEFAULT_LOCALE]
  );
}

function normalizeRegexPattern(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const pattern = value.trim();
  return pattern || null;
}

const regexPatternSchema = z
  .unknown()
  .transform(normalizeRegexPattern)
  .superRefine((value, context) => {
    if (!value) {
      return;
    }

    try {
      new RegExp(value);
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use a valid regex pattern.",
      });
    }
  });

// A key the creator may give an identity field, so webhook consumers can
// address it by name instead of by block id.
export const IDENTITY_KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

const identityKeySchema = z
  .unknown()
  .transform((value) =>
    typeof value === "string" ? value.trim() || null : null,
  )
  .refine((value) => value === null || IDENTITY_KEY_PATTERN.test(value), {
    message:
      "Use a webhook key of lowercase letters, digits, and underscores that starts with a letter.",
  });

const numericLimitSchema = z
  .unknown()
  .transform((value) => {
    if (value === null || typeof value === "undefined") {
      return null;
    }

    if (typeof value === "number") {
      return Number.isFinite(value) ? value : Number.NaN;
    }

    if (typeof value === "string") {
      if (!value.trim()) {
        return null;
      }

      const normalized = normalizeNumericAnswer(value);
      return normalized === null ? Number.NaN : Number(normalized);
    }

    return Number.NaN;
  })
  .refine((value) => value === null || Number.isFinite(value), {
    message: "Use a valid number.",
  });

export const AGREEMENT_ANSWER_VALUES = {
  AGREED: "agreed",
  NOT_AGREED: "not_agreed",
} as const;

export const branchOperatorValues = [
  "equals",
  "not_equals",
  "is_empty",
  "is_not_empty",
  "contains",
  "contains_any",
  "gt",
  "gte",
  "lt",
  "lte",
] as const;

export const branchOperatorSchema = z.enum(branchOperatorValues);

function normalizeBranchRuleOperand(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

const rawBranchRuleSchema = z
  .object({
    operator: branchOperatorSchema.optional(),
    value: z.unknown().transform(normalizeBranchRuleOperand).optional(),
    targetBlockId: z.string().trim().min(1),
  })
  .transform((value) => ({
    operator: value.operator ?? "equals",
    value: value.value ?? null,
    targetBlockId: value.targetBlockId,
  }));

export const branchRuleSchema = rawBranchRuleSchema;

const branchRulesSchema = z.array(branchRuleSchema).max(50).default([]);
const defaultNextBlockIdSchema = z.preprocess(
  (value) => (typeof value === "string" && !value.trim() ? null : value),
  z.string().trim().min(1).nullable().default(null),
);
const endFormSchema = z.boolean().default(false);

const textConfigSchema = z.object({
  body: z.string().max(2400).default(defaultBlockCopyByLocale.en.textBody),
  endForm: endFormSchema,
});

const shortTextConfigSchema = z.object({
  placeholder: z
    .string()
    .max(120)
    .default(defaultBlockCopyByLocale.en.shortPlaceholder),
  validationRegex: regexPatternSchema.default(null),
  identity: z.boolean().default(false),
  identityKey: identityKeySchema.default(null),
  branchRules: branchRulesSchema,
  defaultNextBlockId: defaultNextBlockIdSchema,
  endForm: endFormSchema,
});

const longTextConfigSchema = z.object({
  placeholder: z
    .string()
    .max(240)
    .default(defaultBlockCopyByLocale.en.longPlaceholder),
  validationRegex: regexPatternSchema.default(null),
  branchRules: branchRulesSchema,
  defaultNextBlockId: defaultNextBlockIdSchema,
  endForm: endFormSchema,
});

const numberConfigSchema = z
  .object({
    placeholder: z
      .string()
      .max(120)
      .default(defaultBlockCopyByLocale.en.numberPlaceholder),
    allowFloat: z.boolean().default(false),
    min: numericLimitSchema.default(null),
    max: numericLimitSchema.default(null),
    branchRules: branchRulesSchema,
    defaultNextBlockId: defaultNextBlockIdSchema,
    endForm: endFormSchema,
  })
  .superRefine((value, context) => {
    if (!value.allowFloat) {
      if (value.min !== null && !Number.isInteger(value.min)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["min"],
          message: "Use a whole number when floats are disabled.",
        });
      }

      if (value.max !== null && !Number.isInteger(value.max)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["max"],
          message: "Use a whole number when floats are disabled.",
        });
      }
    }

    if (value.min !== null && value.max !== null && value.min > value.max) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["max"],
        message: "Maximum must be greater than or equal to minimum.",
      });
    }
  });

const linkConfigSchema = z.object({
  placeholder: z
    .string()
    .max(2048)
    .default(defaultBlockCopyByLocale.en.linkPlaceholder),
  branchRules: branchRulesSchema,
  defaultNextBlockId: defaultNextBlockIdSchema,
  endForm: endFormSchema,
});

const agreementConfigSchema = z.object({
  label: z
    .string()
    .trim()
    .max(160)
    .default(defaultBlockCopyByLocale.en.agreementLabel),
  branchRules: branchRulesSchema,
  defaultNextBlockId: defaultNextBlockIdSchema,
  endForm: endFormSchema,
});

const dateConfigSchema = z.object({
  branchRules: branchRulesSchema,
  defaultNextBlockId: defaultNextBlockIdSchema,
  endForm: endFormSchema,
});

export const RATING_MIN_VALUES = [0, 1] as const;
export const RATING_MAX_VALUES = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

const ratingLabelSchema = z.string().trim().max(40).default("");

const ratingConfigSchema = z
  .object({
    min: z.preprocess(
      (value) => value ?? undefined,
      z.union([z.literal(0), z.literal(1)]).default(1),
    ),
    max: z.preprocess(
      (value) => value ?? undefined,
      z.number().int().min(2).max(10).default(5),
    ),
    minLabel: ratingLabelSchema,
    maxLabel: ratingLabelSchema,
    branchRules: branchRulesSchema,
    defaultNextBlockId: defaultNextBlockIdSchema,
    endForm: endFormSchema,
  })
  .refine((value) => value.max > value.min, {
    path: ["max"],
    message: "Maximum must be greater than minimum.",
  });

export const FILE_UPLOAD_ACCEPT_VALUES = [
  "any",
  "images",
  "documents",
] as const;
export const FILE_UPLOAD_MIN_SIZE_MB = 1;
export const FILE_UPLOAD_MAX_SIZE_MB = 25;
export const FILE_UPLOAD_DEFAULT_SIZE_MB = 10;
export const FILE_UPLOAD_SIZE_OPTIONS_MB = [1, 2, 5, 10, 25] as const;

// Legacy or hand-edited configs fall back to the defaults instead of failing
// to parse: an unknown accept value or an out-of-range size is not worth
// breaking the form over.
const fileUploadConfigSchema = z.object({
  accept: z.preprocess(
    (value) =>
      FILE_UPLOAD_ACCEPT_VALUES.includes(value as FileUploadAccept)
        ? value
        : undefined,
    z.enum(FILE_UPLOAD_ACCEPT_VALUES).default("any"),
  ),
  maxSizeMb: z.preprocess(
    (value) =>
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= FILE_UPLOAD_MIN_SIZE_MB &&
      value <= FILE_UPLOAD_MAX_SIZE_MB
        ? value
        : undefined,
    z.number().int().default(FILE_UPLOAD_DEFAULT_SIZE_MB),
  ),
  branchRules: branchRulesSchema,
  defaultNextBlockId: defaultNextBlockIdSchema,
  endForm: endFormSchema,
});

const optionListSchema = z.object({
  options: z
    .array(z.string().min(1).max(120))
    .min(2)
    .max(10)
    .default(defaultBlockCopyByLocale.en.options),
  branchRules: branchRulesSchema,
  defaultNextBlockId: defaultNextBlockIdSchema,
  endForm: endFormSchema,
});

export type AgreementAnswerValue =
  (typeof AGREEMENT_ANSWER_VALUES)[keyof typeof AGREEMENT_ANSWER_VALUES];
export type BranchOperator = z.infer<typeof branchOperatorSchema>;
export type BranchRule = z.infer<typeof branchRuleSchema>;
export type TextBlockConfig = WithOptionalEndForm<
  z.infer<typeof textConfigSchema>
>;
type WithOptionalEndForm<T> = Omit<T, "endForm"> & { endForm?: boolean };
export type ShortTextBlockConfig = WithOptionalEndForm<
  z.infer<typeof shortTextConfigSchema>
>;
export type LongTextBlockConfig = WithOptionalEndForm<
  z.infer<typeof longTextConfigSchema>
>;
export type NumberBlockConfig = WithOptionalEndForm<
  z.infer<typeof numberConfigSchema>
>;
export type LinkBlockConfig = WithOptionalEndForm<
  z.infer<typeof linkConfigSchema>
>;
export type AgreementBlockConfig = WithOptionalEndForm<
  z.infer<typeof agreementConfigSchema>
>;
export type DateBlockConfig = WithOptionalEndForm<
  z.infer<typeof dateConfigSchema>
>;
export type RatingBlockConfig = WithOptionalEndForm<
  z.infer<typeof ratingConfigSchema>
>;
export type FileUploadAccept = (typeof FILE_UPLOAD_ACCEPT_VALUES)[number];
export type FileUploadBlockConfig = WithOptionalEndForm<
  z.infer<typeof fileUploadConfigSchema>
>;
export type ChoiceBlockConfig = WithOptionalEndForm<
  z.infer<typeof optionListSchema>
>;
export type TextAnswerBlockConfig = ShortTextBlockConfig | LongTextBlockConfig;
export type AnswerableBlockConfig =
  | ShortTextBlockConfig
  | LongTextBlockConfig
  | NumberBlockConfig
  | LinkBlockConfig
  | AgreementBlockConfig
  | DateBlockConfig
  | RatingBlockConfig
  | FileUploadBlockConfig
  | ChoiceBlockConfig;
export type BlockConfig = TextBlockConfig | AnswerableBlockConfig;

export type SerializedBlock = Omit<FormBlock, "config"> & {
  config: BlockConfig;
};

export function isQuestionBlock(type: PrismaFormBlockType) {
  return type !== FORM_BLOCK_TYPES.TEXT;
}

export function isTextAnswerBlock(type: PrismaFormBlockType) {
  return (
    type === FORM_BLOCK_TYPES.SHORT_TEXT || type === FORM_BLOCK_TYPES.LONG_TEXT
  );
}

export function isChoiceBlock(type: PrismaFormBlockType) {
  return (
    type === FORM_BLOCK_TYPES.SINGLE_CHOICE ||
    type === FORM_BLOCK_TYPES.MULTIPLE_CHOICE
  );
}

export function isNumericAnswerBlock(type: PrismaFormBlockType) {
  return type === FORM_BLOCK_TYPES.NUMBER || type === FORM_BLOCK_TYPES.RATING;
}

export function getRatingValues(config: RatingBlockConfig) {
  return Array.from(
    { length: config.max - config.min + 1 },
    (_, index) => config.min + index,
  );
}

export function getTextValidationPattern(config: TextAnswerBlockConfig) {
  return config.validationRegex ?? null;
}

export function isAgreementAnswerValue(
  value: string,
): value is AgreementAnswerValue {
  return (
    value === AGREEMENT_ANSWER_VALUES.AGREED ||
    value === AGREEMENT_ANSWER_VALUES.NOT_AGREED
  );
}

const plainDecimalPattern = /^(-?)(\d+)(?:[.,](\d+))?$/;

export function normalizeNumericAnswer(value: string) {
  const match = plainDecimalPattern.exec(value.trim());

  if (!match) {
    return null;
  }

  const [, sign, rawInteger, rawFraction = ""] = match;
  const integer = rawInteger.replace(/^0+(?=\d)/, "");
  const fraction = rawFraction.replace(/0+$/, "");
  const magnitude = fraction ? `${integer}.${fraction}` : integer;

  return magnitude === "0" ? magnitude : `${sign}${magnitude}`;
}

export function parseNumericAnswer(value: string) {
  const normalized = normalizeNumericAnswer(value);

  if (normalized === null) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isValidLinkAnswer(value: string) {
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}

export function isValidDateAnswer(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function getSupportedBranchOperators(
  type: PrismaFormBlockType,
): BranchOperator[] {
  if (type === FORM_BLOCK_TYPES.TEXT) {
    return [];
  }

  if (type === FORM_BLOCK_TYPES.FILE_UPLOAD) {
    return ["is_empty", "is_not_empty"];
  }

  const common: BranchOperator[] = [
    "equals",
    "not_equals",
    "is_empty",
    "is_not_empty",
  ];

  if (
    type === FORM_BLOCK_TYPES.SHORT_TEXT ||
    type === FORM_BLOCK_TYPES.LONG_TEXT ||
    type === FORM_BLOCK_TYPES.LINK
  ) {
    return [...common, "contains"];
  }

  if (type === FORM_BLOCK_TYPES.MULTIPLE_CHOICE) {
    return [...common, "contains_any"];
  }

  if (isNumericAnswerBlock(type) || type === FORM_BLOCK_TYPES.DATE) {
    return [...common, "gt", "gte", "lt", "lte"];
  }

  return common;
}

export function getVisibleBranchOperators(
  type: PrismaFormBlockType,
): BranchOperator[] {
  if (type === FORM_BLOCK_TYPES.TEXT) {
    return [];
  }

  if (
    type === FORM_BLOCK_TYPES.SHORT_TEXT ||
    type === FORM_BLOCK_TYPES.LONG_TEXT ||
    type === FORM_BLOCK_TYPES.LINK
  ) {
    return ["is_empty", "is_not_empty", "contains"];
  }

  if (type === FORM_BLOCK_TYPES.SINGLE_CHOICE) {
    return ["equals", "not_equals", "is_empty", "is_not_empty"];
  }

  if (type === FORM_BLOCK_TYPES.MULTIPLE_CHOICE) {
    return ["contains_any", "is_empty", "is_not_empty"];
  }

  if (isNumericAnswerBlock(type) || type === FORM_BLOCK_TYPES.DATE) {
    return [
      "equals",
      "not_equals",
      "gt",
      "gte",
      "lt",
      "lte",
      "is_empty",
      "is_not_empty",
    ];
  }

  if (type === FORM_BLOCK_TYPES.AGREEMENT) {
    return ["equals", "not_equals"];
  }

  if (type === FORM_BLOCK_TYPES.FILE_UPLOAD) {
    return ["is_empty", "is_not_empty"];
  }

  return ["equals", "not_equals"];
}

export function branchOperatorNeedsValue(operator: BranchOperator) {
  return operator !== "is_empty" && operator !== "is_not_empty";
}

export function parseBlockConfig(
  type: PrismaFormBlockType,
  value: unknown,
): BlockConfig {
  switch (type) {
    case FORM_BLOCK_TYPES.TEXT:
      return textConfigSchema.parse(value ?? {});
    case FORM_BLOCK_TYPES.SHORT_TEXT:
      return shortTextConfigSchema.parse(value ?? {});
    case FORM_BLOCK_TYPES.LONG_TEXT:
      return longTextConfigSchema.parse(value ?? {});
    case FORM_BLOCK_TYPES.SINGLE_CHOICE:
    case FORM_BLOCK_TYPES.MULTIPLE_CHOICE:
      return optionListSchema.parse(value ?? {});
    case FORM_BLOCK_TYPES.NUMBER:
      return numberConfigSchema.parse(value ?? {});
    case FORM_BLOCK_TYPES.LINK:
      return linkConfigSchema.parse(value ?? {});
    case FORM_BLOCK_TYPES.AGREEMENT:
      return agreementConfigSchema.parse(value ?? {});
    case FORM_BLOCK_TYPES.DATE:
      return dateConfigSchema.parse(value ?? {});
    case FORM_BLOCK_TYPES.RATING:
      return ratingConfigSchema.parse(value ?? {});
    case FORM_BLOCK_TYPES.FILE_UPLOAD:
      return fileUploadConfigSchema.parse(value ?? {});
    default:
      return textConfigSchema.parse(value ?? {});
  }
}

export function getDefaultBlockConfig(
  type: PrismaFormBlockType,
  locale: AppLocale = DEFAULT_LOCALE,
): BlockConfig {
  const copy = getDefaultBlockCopy(locale);

  switch (type) {
    case FORM_BLOCK_TYPES.TEXT:
      return textConfigSchema.parse({ body: copy.textBody });
    case FORM_BLOCK_TYPES.SHORT_TEXT:
      return shortTextConfigSchema.parse({
        placeholder: copy.shortPlaceholder,
      });
    case FORM_BLOCK_TYPES.LONG_TEXT:
      return longTextConfigSchema.parse({ placeholder: copy.longPlaceholder });
    case FORM_BLOCK_TYPES.SINGLE_CHOICE:
    case FORM_BLOCK_TYPES.MULTIPLE_CHOICE:
      return optionListSchema.parse({ options: copy.options });
    case FORM_BLOCK_TYPES.NUMBER:
      return numberConfigSchema.parse({ placeholder: copy.numberPlaceholder });
    case FORM_BLOCK_TYPES.LINK:
      return linkConfigSchema.parse({ placeholder: copy.linkPlaceholder });
    case FORM_BLOCK_TYPES.AGREEMENT:
      return agreementConfigSchema.parse({ label: copy.agreementLabel });
    case FORM_BLOCK_TYPES.DATE:
      return dateConfigSchema.parse({});
    case FORM_BLOCK_TYPES.RATING:
      return ratingConfigSchema.parse({});
    case FORM_BLOCK_TYPES.FILE_UPLOAD:
      return fileUploadConfigSchema.parse({});
    default:
      return textConfigSchema.parse({ body: copy.textBody });
  }
}

export function getBranchRules(config: BlockConfig): BranchRule[] {
  return "branchRules" in config ? config.branchRules : [];
}

export function getDefaultNextBlockId(config: BlockConfig) {
  return "defaultNextBlockId" in config ? config.defaultNextBlockId : null;
}

export function getEndForm(config: BlockConfig) {
  return "endForm" in config ? config.endForm : false;
}

export function serializeBlock(block: FormBlock): SerializedBlock {
  return {
    ...block,
    config: parseBlockConfig(block.type, block.config),
  };
}

export function getBlockPreview(
  block: Pick<FormBlock, "type" | "title" | "description" | "config">,
  fallbackLabel?: string,
) {
  const config = parseBlockConfig(block.type, block.config);

  if (block.title.trim()) {
    return block.title;
  }

  if (block.type === FORM_BLOCK_TYPES.TEXT && "body" in config) {
    return config.body;
  }

  if (
    (block.type === FORM_BLOCK_TYPES.SHORT_TEXT ||
      block.type === FORM_BLOCK_TYPES.LONG_TEXT ||
      block.type === FORM_BLOCK_TYPES.NUMBER ||
      block.type === FORM_BLOCK_TYPES.LINK) &&
    "placeholder" in config &&
    config.placeholder.trim()
  ) {
    return config.placeholder;
  }

  if ("options" in config) {
    return config.options.join(" • ");
  }

  if (
    block.type === FORM_BLOCK_TYPES.AGREEMENT &&
    "label" in config &&
    config.label.trim()
  ) {
    return config.label;
  }

  return block.description || fallbackLabel || blockTypeLabels[block.type];
}
