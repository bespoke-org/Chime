import { isQuestionBlock } from "@/lib/blocks";
import { db } from "@/lib/db";
import type {
  SubmissionAnswers,
  SubmissionSnapshotBlock,
} from "@/lib/form-submission";
import { DEFAULT_LOCALE, normalizeLocale, type AppLocale } from "@/lib/i18n";
import {
  isMailerConfigured,
  sendMail,
  type MailMessage,
  type MailResult,
} from "@/lib/mailer";
import { serializeExportAnswer } from "@/lib/response-exports";

type NotificationCopy = {
  subject: string;
  intro: string;
  questionFallback: string;
  openResponse: string;
};

const copyByLocale: Record<AppLocale, NotificationCopy> = {
  en: {
    subject: "New response: {title}",
    intro: "A new response to “{title}” has been received.",
    questionFallback: "Question {number}",
    openResponse: "Open the response",
  },
  ru: {
    subject: "Новый ответ: {title}",
    intro: "Получен новый ответ на форму «{title}».",
    questionFallback: "Вопрос {number}",
    openResponse: "Открыть ответ",
  },
};

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export type ResponseNotificationEmail = {
  subject: string;
  text: string;
  html: string;
};

export type ResponseNotificationInput = {
  form: { id: string; title: string };
  response: { id: string; answers: SubmissionAnswers };
  blocks: SubmissionSnapshotBlock[];
  locale: AppLocale;
  baseUrl: string;
};

// Titles and answers come from the creator and the respondent, so the HTML
// version escapes them. The plain text version carries the same content.
export function buildResponseNotificationEmail(
  input: ResponseNotificationInput,
): ResponseNotificationEmail {
  const copy = copyByLocale[input.locale] ?? copyByLocale[DEFAULT_LOCALE];
  const title = input.form.title.trim() || input.form.id;
  const link = `${input.baseUrl.replace(/\/+$/, "")}/forms/${input.form.id}/responses/${input.response.id}`;

  const entries = input.blocks
    .filter((block) => isQuestionBlock(block.type))
    .map((block, index) => ({
      question:
        block.title.trim() ||
        fill(copy.questionFallback, { number: index + 1 }),
      answer: serializeExportAnswer(
        input.response.answers[block.id],
        block,
        input.locale,
      ),
    }));

  const intro = fill(copy.intro, { title });
  const text = [
    intro,
    "",
    ...entries.flatMap((entry) => [entry.question, entry.answer, ""]),
    `${copy.openResponse}: ${link}`,
  ].join("\n");

  const html = [
    `<p>${escapeHtml(intro)}</p>`,
    ...entries.map(
      (entry) =>
        `<p><strong>${escapeHtml(entry.question)}</strong><br>${escapeHtml(
          entry.answer,
        ).replaceAll("\n", "<br>")}</p>`,
    ),
    `<p><a href="${escapeHtml(link)}">${escapeHtml(copy.openResponse)}</a></p>`,
  ].join("\n");

  return {
    subject: fill(copy.subject, { title }),
    text,
    html,
  };
}

export type ResponseNotificationMailer = {
  isConfigured: () => boolean;
  sendMail: (message: MailMessage) => Promise<MailResult>;
};

const defaultMailer: ResponseNotificationMailer = {
  isConfigured: isMailerConfigured,
  sendMail,
};

let activeMailer: ResponseNotificationMailer = defaultMailer;

// Tests swap the mailer so the notification flow runs without SMTP.
export function setResponseNotificationMailer(
  mailer: ResponseNotificationMailer | null,
) {
  activeMailer = mailer ?? defaultMailer;
}

export function getAppBaseUrl(
  env: Record<string, string | undefined> = process.env,
) {
  return env.NEXTAUTH_URL?.trim() || env.ATPROTO_PUBLIC_URL?.trim() || "";
}

export type NotifyOwnerInput = {
  form: {
    id: string;
    title: string;
    userId: string;
    notifyOnResponse: boolean;
  };
  response: { id: string; answers: SubmissionAnswers };
  snapshot: SubmissionSnapshotBlock[];
};

// Never throws. Nothing is looked up or sent unless the form asks for it and
// the mailer is usable.
export async function notifyOwnerOfResponse(
  input: NotifyOwnerInput,
): Promise<MailResult> {
  if (!input.form.notifyOnResponse) {
    return { ok: false, error: "disabled" };
  }

  try {
    if (!activeMailer.isConfigured()) {
      return { ok: false, error: "not_configured" };
    }

    const owner = await db.user.findUnique({
      where: { id: input.form.userId },
      select: { notificationEmail: true, locale: true },
    });

    if (!owner?.notificationEmail) {
      return { ok: false, error: "no_recipient" };
    }

    const email = buildResponseNotificationEmail({
      form: input.form,
      response: input.response,
      blocks: input.snapshot,
      locale: normalizeLocale(owner.locale),
      baseUrl: getAppBaseUrl(),
    });

    return await activeMailer.sendMail({
      to: owner.notificationEmail,
      ...email,
    });
  } catch (error) {
    console.warn(
      `Response notification failed for form ${input.form.id}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );

    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
