import { FormBlockType, type FormBlock } from "@prisma/client";
import { z } from "zod";

import { DEFAULT_LOCALE, type AppLocale } from "@/lib/i18n";

export const blockTypeLabels: Record<FormBlockType, string> = {
  TEXT: "Text block",
  SHORT_TEXT: "Short text",
  LONG_TEXT: "Long text",
  SINGLE_CHOICE: "Single choice",
  MULTIPLE_CHOICE: "Multiple choice",
};

export const blockTypeTranslationKeys: Record<FormBlockType, string> = {
  TEXT: "blocks.types.TEXT",
  SHORT_TEXT: "blocks.types.SHORT_TEXT",
  LONG_TEXT: "blocks.types.LONG_TEXT",
  SINGLE_CHOICE: "blocks.types.SINGLE_CHOICE",
  MULTIPLE_CHOICE: "blocks.types.MULTIPLE_CHOICE",
};

const defaultBlockCopyByLocale: Record<AppLocale, { textBody: string; shortPlaceholder: string; longPlaceholder: string; options: [string, string] }> = {
  en: {
    textBody: "Introduce the next part of your form.",
    shortPlaceholder: "Type your answer here…",
    longPlaceholder: "Tell us a little more…",
    options: ["Option 1", "Option 2"],
  },
  ru: {
    textBody: "Подготовьте человека к следующей части формы.",
    shortPlaceholder: "Введите ответ…",
    longPlaceholder: "Расскажите немного подробнее…",
    options: ["Вариант 1", "Вариант 2"],
  },
};

function getDefaultBlockCopy(locale: AppLocale = DEFAULT_LOCALE) {
  return defaultBlockCopyByLocale[locale] ?? defaultBlockCopyByLocale[DEFAULT_LOCALE];
}

const textConfigSchema = z.object({
  body: z.string().max(2400).default(defaultBlockCopyByLocale.en.textBody),
});

const shortTextConfigSchema = z.object({
  placeholder: z.string().max(120).default(defaultBlockCopyByLocale.en.shortPlaceholder),
});

const longTextConfigSchema = z.object({
  placeholder: z.string().max(240).default(defaultBlockCopyByLocale.en.longPlaceholder),
});

const optionListSchema = z.object({
  options: z.array(z.string().min(1).max(120)).min(2).max(10).default(defaultBlockCopyByLocale.en.options),
});

export type TextBlockConfig = z.infer<typeof textConfigSchema>;
export type ShortTextBlockConfig = z.infer<typeof shortTextConfigSchema>;
export type LongTextBlockConfig = z.infer<typeof longTextConfigSchema>;
export type ChoiceBlockConfig = z.infer<typeof optionListSchema>;
export type BlockConfig =
  | TextBlockConfig
  | ShortTextBlockConfig
  | LongTextBlockConfig
  | ChoiceBlockConfig;

export type SerializedBlock = Omit<FormBlock, "config"> & {
  config: BlockConfig;
};

export function isQuestionBlock(type: FormBlockType) {
  return type !== FormBlockType.TEXT;
}

export function getDefaultBlockConfig(type: FormBlockType, locale: AppLocale = DEFAULT_LOCALE): BlockConfig {
  const copy = getDefaultBlockCopy(locale);

  switch (type) {
    case FormBlockType.TEXT:
      return textConfigSchema.parse({ body: copy.textBody });
    case FormBlockType.SHORT_TEXT:
      return shortTextConfigSchema.parse({ placeholder: copy.shortPlaceholder });
    case FormBlockType.LONG_TEXT:
      return longTextConfigSchema.parse({ placeholder: copy.longPlaceholder });
    case FormBlockType.SINGLE_CHOICE:
    case FormBlockType.MULTIPLE_CHOICE:
      return optionListSchema.parse({ options: copy.options });
    default:
      return textConfigSchema.parse({ body: copy.textBody });
  }
}

export function parseBlockConfig(type: FormBlockType, value: unknown): BlockConfig {
  switch (type) {
    case FormBlockType.TEXT:
      return textConfigSchema.parse(value ?? {});
    case FormBlockType.SHORT_TEXT:
      return shortTextConfigSchema.parse(value ?? {});
    case FormBlockType.LONG_TEXT:
      return longTextConfigSchema.parse(value ?? {});
    case FormBlockType.SINGLE_CHOICE:
    case FormBlockType.MULTIPLE_CHOICE:
      return optionListSchema.parse(value ?? {});
    default:
      return textConfigSchema.parse(value ?? {});
  }
}

export function serializeBlock(block: FormBlock): SerializedBlock {
  return {
    ...block,
    config: parseBlockConfig(block.type, block.config),
  };
}

export function getBlockPreview(block: Pick<FormBlock, "type" | "title" | "description" | "config">, fallbackLabel?: string) {
  const config = parseBlockConfig(block.type, block.config);

  if (block.title.trim()) {
    return block.title;
  }

  if (block.type === FormBlockType.TEXT && "body" in config) {
    return config.body;
  }

  if ("placeholder" in config && config.placeholder.trim()) {
    return config.placeholder;
  }

  if ("options" in config) {
    return config.options.join(" • ");
  }

  return block.description || fallbackLabel || blockTypeLabels[block.type];
}
