import { notFound } from "next/navigation";

import { FormBuilder } from "@/components/form-builder";
import { getServerAuthSession } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { getOwnedFormForBuilder } from "@/lib/forms";

export default async function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  const { id } = await params;

  let form;

  try {
    form = await getOwnedFormForBuilder(session!.user.id, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) {
      notFound();
    }

    throw error;
  }

  return <FormBuilder initialForm={form} />;
}
