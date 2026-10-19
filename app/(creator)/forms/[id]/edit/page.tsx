import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { FormBuilder } from "@/components/form-builder";
import { requireServerSessionUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { getOwnedFormForBuilder } from "@/lib/forms";
import { resolveTitle, withTitle } from "@/lib/metadata";
import { getRequestI18n } from "@/lib/i18n-server";

// Shared by generateMetadata and the page so the form is loaded once.
const getEditableForm = cache(async (id: string) => {
  const user = await requireServerSessionUser();

  try {
    return await getOwnedFormForBuilder(user.id, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) {
      notFound();
    }

    throw error;
  }
});

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
