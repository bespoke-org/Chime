import { notFound } from "next/navigation";

import { PublicFormRunner } from "@/components/public-form-runner";
import { getPublicFormBySlug } from "@/lib/forms";

export default async function PublicFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const form = await getPublicFormBySlug(slug);

  if (!form) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6 py-8 lg:px-10 lg:py-10">
      <PublicFormRunner form={form} />
    </main>
  );
}
