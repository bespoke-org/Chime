import { DEFAULT_LOCALE, type AppLocale } from "@/lib/i18n";

export const legacyCompletionDefaults = {
  title: "Thanks for taking the time.",
  message:
    "Your response was submitted anonymously. The creator can review your answers, but they are not linked to a login or account.",
} as const;

export const completionDefaultsByLocale: Record<
  AppLocale,
  { title: string; message: string }
> = {
  en: {
    title: "Thank you",
    message:
      "Your response was submitted anonymously. The creator can review your answers, but they are not linked to a login or account.",
  },
  ru: {
    title: "Спасибо",
    message:
      "Ваш ответ был отправлен анонимно. Создатель формы может просмотреть ответы, но они не связаны с вашим аккаунтом или входом в систему.",
  },
};

export function getLocalizedCompletionDefaults(
  locale: AppLocale = DEFAULT_LOCALE,
) {
  return (
    completionDefaultsByLocale[locale] ??
    completionDefaultsByLocale[DEFAULT_LOCALE]
  );
}

export function isLegacyDefaultCompletionTitle(
  value: string | null | undefined,
) {
  return (value ?? "").trim() === legacyCompletionDefaults.title;
}

export function isLegacyDefaultCompletionMessage(
  value: string | null | undefined,
) {
  return (value ?? "").trim() === legacyCompletionDefaults.message;
}
