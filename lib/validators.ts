import { z } from "zod";

import { parseAvatarPath } from "@/lib/avatar-rules";
import { blockTypeSchema } from "@/lib/blocks";
import { supportedLocales } from "@/lib/i18n";
import { isPublicWebhookUrl } from "@/lib/webhooks";

export const formMetadataSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(600).default(""),
    completionTitle: z.string().trim().max(120).default(""),
    completionMessage: z.string().trim().max(600).default(""),
    completionLinkLabel: z.string().trim().max(80).default(""),
    completionLinkUrl: z.string().trim().max(2048).default(""),
    respondentLocale: z.enum(supportedLocales).nullable().default(null),
    showProgress: z.boolean().default(true),
    allowBackNavigation: z.boolean().default(true),
    webhookUrl: z.string().trim().max(2048).nullable().default(null),
    webhookSecret: z.string().trim().max(200).nullable().default(null),
    closesAt: z
      .string()
      .trim()
      .nullable()
      .default(null)
      .transform((value) => value || null)
      .refine(
        (value) => value === null || !Number.isNaN(new Date(value).getTime()),
        { message: "Use a valid closing date and time." },
      ),
    maxResponses: z
      .union([z.number().int().min(1).max(1_000_000), z.literal(""), z.null()])
      .default(null)
      .transform((value) => (value === "" ? null : value)),
    closedManually: z.boolean().default(false),
    closedMessage: z.string().trim().max(1000).default(""),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(64)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Use lowercase letters, numbers, and hyphens only.",
      ),
  })
  .superRefine((value, context) => {
    const hasLabel = Boolean(value.completionLinkLabel);
    const hasUrl = Boolean(value.completionLinkUrl);

    if (hasLabel !== hasUrl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [hasLabel ? "completionLinkUrl" : "completionLinkLabel"],
        message:
          "Add both a follow-up link label and URL, or leave both empty.",
      });
    }

    if (value.webhookUrl && !isPublicWebhookUrl(value.webhookUrl)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["webhookUrl"],
        message:
          "Use a full http:// or https:// webhook URL that points to a public host.",
      });
    }

    if (!hasUrl) {
      return;
    }

    try {
      const parsedUrl = new URL(value.completionLinkUrl);

      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["completionLinkUrl"],
          message: "Use a full http:// or https:// URL for the follow-up link.",
        });
      }
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["completionLinkUrl"],
        message: "Use a valid follow-up link URL.",
      });
    }
  })
  .transform((value) => ({
    ...value,
    respondentLocale: value.respondentLocale ?? null,
    completionLinkLabel: value.completionLinkLabel || null,
    completionLinkUrl: value.completionLinkUrl || null,
    allowBackNavigation: value.allowBackNavigation,
    webhookUrl: value.webhookUrl || null,
    webhookSecret: value.webhookSecret || null,
    closesAt: value.closesAt ? new Date(value.closesAt) : null,
  }));

export const createBlockSchema = z.object({
  type: blockTypeSchema,
});

export const blockUpdateSchema = z.object({
  title: z.string().max(160).default(""),
  description: z.string().max(280).default(""),
  required: z.boolean().default(false),
  config: z.unknown().default({}),
});

export const reorderBlocksSchema = z.object({
  blockIds: z
    .array(z.string())
    .min(1)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "Block ids must be unique.",
    }),
});

export const publishFormSchema = z.object({
  published: z.boolean(),
});

export const profileSettingsSchema = z
  .object({
    firstName: z.string().trim().max(60).default(""),
    secondName: z.string().trim().max(60).default(""),
    locale: z.enum(supportedLocales).default("en"),
    image: z.string().trim().max(2048).default(""),
    notificationEmail: z
      .string()
      .trim()
      .toLowerCase()
      .max(254)
      .nullable()
      .default("")
      .transform((value) => value || null),
  })
  .superRefine((value, context) => {
    if (
      value.notificationEmail &&
      !z.email().safeParse(value.notificationEmail).success
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["notificationEmail"],
        message: "Use a valid email address for notifications.",
      });
    }

    if (!value.image || parseAvatarPath(value.image)) {
      return;
    }

    try {
      const parsedUrl = new URL(value.image);

      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["image"],
          message: "Use a full http:// or https:// URL for the profile image.",
        });
      }
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["image"],
        message: "Use a valid profile image URL.",
      });
    }
  })
  .transform((value) => ({
    firstName: value.firstName || null,
    secondName: value.secondName || null,
    locale: value.locale,
    image: value.image || null,
    notificationEmail: value.notificationEmail,
  }));
