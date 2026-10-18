import { getAppBaseUrl } from "@/lib/app-url";
import { isQuestionBlock } from "@/lib/blocks";
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
import { listNotificationRecipients } from "@/lib/notification-subscriptions";
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
        { baseUrl: input.baseUrl, formId: input.form.id },
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

export { getAppBaseUrl };

export type NotifySubscribersInput = {
  form: { id: string; title: string };
  response: { id: string; answers: SubmissionAnswers };
  snapshot: SubmissionSnapshotBlock[];
};

export type NotifySubscribersResult = {
  recipients: number;
  sent: number;
};

function warnFailure(formId: string, detail: string) {
  console.warn(`Response notification failed for form ${formId}: ${detail}`);
}

// Never throws. Nothing is looked up unless the mailer is usable; each
// subscriber gets their own email in their own language, and one failure does
// not stop the others.
export async function notifyResponseSubscribers(
  input: NotifySubscribersInput,
): Promise<NotifySubscribersResult> {
  try {
    if (!activeMailer.isConfigured()) {
      return { recipients: 0, sent: 0 };
    }

    const recipients = await listNotificationRecipients(input.form.id);
    const baseUrl = getAppBaseUrl();

    const outcomes = await Promise.allSettled(
      recipients.map(async (recipient) => {
        const email = buildResponseNotificationEmail({
          form: input.form,
          response: input.response,
          blocks: input.snapshot,
          locale: normalizeLocale(recipient.locale),
          baseUrl,
        });
        const result = await activeMailer.sendMail({
          to: recipient.notificationEmail,
          ...email,
        });

        if (!result.ok) {
          throw new Error(result.error ?? "send failed");
        }
      }),
    );

    let sent = 0;
    outcomes.forEach((outcome, index) => {
      if (outcome.status === "fulfilled") {
        sent += 1;
        return;
      }

      const domain = recipients[index].notificationEmail.split("@")[1] ?? "";
      const reason =
        outcome.reason instanceof Error
          ? outcome.reason.message
          : String(outcome.reason);
      warnFailure(input.form.id, `${domain}: ${reason}`);
    });

    return { recipients: recipients.length, sent };
  } catch (error) {
    warnFailure(
      input.form.id,
      error instanceof Error ? error.message : String(error),
    );

    return { recipients: 0, sent: 0 };
  }
}
