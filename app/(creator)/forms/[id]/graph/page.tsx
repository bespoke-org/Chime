import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FormBuilder } from "@/components/form-builder";
import { requireServerSessionUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { getOwnedFormForBuilder } from "@/lib/forms";
import { getRequestI18n } from "@/lib/i18n-server";
import { resolveTitle, withTitle } from "@/lib/metadata";

async function getEditableForm(id: string) {
  const user = await requireServerSessionUser();

  try {
    return await getOwnedFormForBuilder(user.id, id);
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

export default async function GraphFormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const form = await getEditableForm(id);

  return (
    <FormBuilder initialForm={form} initialMode="graph" immersiveGraphPage />
  );
}
