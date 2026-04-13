import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicFormRunner } from "@/components/public-form-runner";
import { getPublicFormBySlug } from "@/lib/forms";
import { getRequestI18n } from "@/lib/i18n-server";
import { resolveTitle, withTitle } from "@/lib/metadata";

async function getPublicForm(slug: string) {
  const form = await getPublicFormBySlug(slug);

  if (!form) {
    notFound();
  }

  return form;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { t } = await getRequestI18n();
  const { slug } = await params;
  const form = await getPublicForm(slug);

  return withTitle(resolveTitle(form.title, t("meta.untitledForm")));
}

export default async function PublicFormPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const form = await getPublicForm(slug);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-6 py-8 lg:px-10 lg:py-10">
      <PublicFormRunner form={form} />
    </main>
  );
}
