import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FormBuilder } from "@/components/form-builder";
import { getServerAuthSession } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { getOwnedFormForBuilder } from "@/lib/forms";
import { resolveTitle, withTitle } from "@/lib/metadata";
import { getRequestI18n } from "@/lib/i18n-server";

async function getEditableForm(id: string) {
  const session = await getServerAuthSession();

  try {
    return await getOwnedFormForBuilder(session!.user.id, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { t } = await getRequestI18n();
  const { id } = await params;
  const form = await getEditableForm(id);

  return withTitle(resolveTitle(form.title, t("meta.untitledForm")));
}

export default async function EditFormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const form = await getEditableForm(id);

  return <FormBuilder initialForm={form} />;
}
