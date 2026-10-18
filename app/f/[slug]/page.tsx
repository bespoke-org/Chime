import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { I18nProvider } from "@/components/i18n-provider";
import { PublicFormClosed } from "@/components/public-form-closed";
import { PublicFormRunner } from "@/components/public-form-runner";
import { getPublicFormBySlug } from "@/lib/forms";
import { resolveAppLocale } from "@/lib/i18n";
import {
  getMessages,
  getRequestI18n,
  getRequestLocale,
} from "@/lib/i18n-server";
import { resolveTitle, withTitle } from "@/lib/metadata";

async function getPublicForm(slug: string) {
  const result = await getPublicFormBySlug(slug);

  if (!result) {
    notFound();
  }

  return result;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { t } = await getRequestI18n();
  const { slug } = await params;
  const { form } = await getPublicForm(slug);

  return withTitle(resolveTitle(form.title, t("meta.untitledForm")));
}

export default async function PublicFormPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { form, availability } = await getPublicForm(slug);
  const requestLocale = await getRequestLocale();
  const locale = resolveAppLocale(requestLocale, form.respondentLocale);
  const messages = await getMessages(locale);

  return (
    <I18nProvider locale={locale} messages={messages}>
      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-6 py-8 lg:px-10 lg:py-10">
        {availability.open ? (
          <PublicFormRunner form={form} />
        ) : (
          <PublicFormClosed title={form.title} message={form.closedMessage} />
        )}
      </main>
    </I18nProvider>
  );
}
