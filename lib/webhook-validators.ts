import { z } from "zod";

import { DIGEST_INTERVALS, DIGEST_TIME_PATTERN } from "@/lib/digest-schedule";
import { isPublicWebhookUrl } from "@/lib/webhooks";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .default(null)
    .transform((value) => value || null);

export const webhookInputSchema = z
  .object({
    url: z
      .string()
      .trim()
      .min(1, "Enter a webhook URL.")
      .max(2048)
      .refine(isPublicWebhookUrl, {
        message:
          "Use a full http:// or https:// webhook URL that points to a public host.",
      }),
    secret: optionalText(200),
    enabled: z.boolean().default(true),
    mode: z.enum(["IMMEDIATE", "DIGEST"]).default("IMMEDIATE"),
    digestInterval: z.enum(DIGEST_INTERVALS).nullable().default(null),
    digestTime: optionalText(5).refine(
      (value) => value === null || DIGEST_TIME_PATTERN.test(value),
      { message: "Use a time in the HH:MM form." },
    ),
    digestWeekday: z.number().int().min(0).max(6).nullable().default(null),
  })
  .superRefine((value, context) => {
    if (value.mode !== "DIGEST") {
      return;
    }

    if (!value.digestInterval) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["digestInterval"],
        message: "Choose how often the digest is sent.",
      });
      return;
    }

    if (value.digestInterval !== "HOURLY" && !value.digestTime) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["digestTime"],
        message: "Choose the time of day for the digest.",
      });
    }

    if (value.digestInterval === "WEEKLY" && value.digestWeekday === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["digestWeekday"],
        message: "Choose the weekday for the digest.",
      });
    }
  })
  // Fields the chosen mode and interval do not use are cleared, so a stored
  // webhook carries exactly its schedule and nothing stale.
  .transform((value) => {
    if (value.mode !== "DIGEST") {
      return {
        ...value,
        digestInterval: null,
        digestTime: null,
        digestWeekday: null,
      };
    }

    return {
      ...value,
      digestTime: value.digestInterval === "HOURLY" ? null : value.digestTime,
      digestWeekday:
        value.digestInterval === "WEEKLY" ? value.digestWeekday : null,
    };
  });

export type WebhookInput = z.output<typeof webhookInputSchema>;
