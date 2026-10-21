// Completion texts stored by earlier versions in place of an empty value.
// A form carrying one of them shows the public form's localized default.
const storedDefaultCompletionTitles = new Set([
  "Thanks for taking the time.",
  "Спасибо, что уделили время.",
]);

const storedDefaultCompletionMessages = new Set([
  "Your response was submitted anonymously. The creator can review your answers, but they are not linked to a login or account.",
  "Ваш ответ был отправлен анонимно. Создатель формы может просмотреть ответы, но они не связаны с вашим аккаунтом или входом в систему.",
]);

export function isLegacyDefaultCompletionTitle(
  value: string | null | undefined,
) {
  return storedDefaultCompletionTitles.has((value ?? "").trim());
}

export function isLegacyDefaultCompletionMessage(
  value: string | null | undefined,
) {
  return storedDefaultCompletionMessages.has((value ?? "").trim());
}
