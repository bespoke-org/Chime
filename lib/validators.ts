import { FormBlockType } from "@prisma/client";
import { z } from "zod";

export const formMetadataSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(600).default(""),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only."),
});

export const createBlockSchema = z.object({
  type: z.nativeEnum(FormBlockType),
});

export const blockUpdateSchema = z.object({
  title: z.string().max(160).default(""),
  description: z.string().max(280).default(""),
  required: z.boolean().default(false),
  config: z.unknown().default({}),
});

export const reorderBlocksSchema = z.object({
  blockIds: z.array(z.string()).min(1),
});

export const publishFormSchema = z.object({
  published: z.boolean(),
});
