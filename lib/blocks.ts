import { FormBlockType, type FormBlock } from "@prisma/client";
import { z } from "zod";

export const blockTypeLabels: Record<FormBlockType, string> = {
  TEXT: "Text block",
  SHORT_TEXT: "Short text",
  LONG_TEXT: "Long text",
  SINGLE_CHOICE: "Single choice",
  MULTIPLE_CHOICE: "Multiple choice",
};

const textConfigSchema = z.object({
  body: z.string().max(2400).default("Introduce the next part of your form."),
});

const shortTextConfigSchema = z.object({
  placeholder: z.string().max(120).default("Type your answer here…"),
});

const longTextConfigSchema = z.object({
  placeholder: z.string().max(240).default("Tell us a little more…"),
});

const optionListSchema = z.object({
  options: z.array(z.string().min(1).max(120)).min(2).max(10).default(["Option 1", "Option 2"]),
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

export function getDefaultBlockConfig(type: FormBlockType): BlockConfig {
  switch (type) {
    case FormBlockType.TEXT:
      return textConfigSchema.parse({});
    case FormBlockType.SHORT_TEXT:
      return shortTextConfigSchema.parse({});
    case FormBlockType.LONG_TEXT:
      return longTextConfigSchema.parse({});
    case FormBlockType.SINGLE_CHOICE:
    case FormBlockType.MULTIPLE_CHOICE:
      return optionListSchema.parse({});
    default:
      return textConfigSchema.parse({});
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

export function getBlockPreview(block: Pick<FormBlock, "type" | "title" | "description" | "config">) {
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

  return block.description || blockTypeLabels[block.type];
}
