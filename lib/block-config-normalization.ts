import type { FormBlockType as PrismaFormBlockType } from "@prisma/client";

import {
  isChoiceBlock,
  parseBlockConfig,
  type BlockConfig,
} from "@/lib/blocks";

function sanitizeOptions(options: string[]) {
  return options
    .map((option) => option.trim())
    .filter(Boolean)
    .slice(0, 10);
}

export function normalizeBlockConfig(
  type: PrismaFormBlockType,
  value: unknown,
): BlockConfig {
  if (isChoiceBlock(type)) {
    const rawOptions =
      typeof value === "object" &&
      value &&
      "options" in value &&
      Array.isArray(value.options)
        ? value.options.filter(
            (option): option is string => typeof option === "string",
          )
        : [];
    const options = sanitizeOptions(rawOptions);
    const branchRules =
      typeof value === "object" &&
      value &&
      "branchRules" in value &&
      Array.isArray(value.branchRules)
        ? value.branchRules
        : undefined;
    const defaultNextBlockId =
      typeof value === "object" &&
      value &&
      "defaultNextBlockId" in value &&
      typeof value.defaultNextBlockId === "string"
        ? value.defaultNextBlockId
        : value &&
            typeof value === "object" &&
            "defaultNextBlockId" in value &&
            value.defaultNextBlockId === null
          ? null
          : undefined;

    return parseBlockConfig(type, {
      options: options.length >= 2 ? options : ["Option 1", "Option 2"],
      branchRules,
      defaultNextBlockId,
    });
  }

  return parseBlockConfig(type, value);
}
