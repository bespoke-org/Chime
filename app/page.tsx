import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getServerAuthSession } from "@/lib/auth";

export default async function HomePage() {
  const session = await getServerAuthSession();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-6 py-8 lg:px-10 lg:py-10">
      <section className="flex flex-1 items-center py-16 lg:py-24">
        <Card className="w-full p-8 lg:p-10">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">Lively Forms</p>
            <h1 className="mt-4 font-display text-5xl leading-tight text-[var(--ink)] sm:text-6xl">
              Create, publish, and review forms.
            </h1>
            <p className="mt-5 text-base leading-7 text-[var(--muted)] sm:text-lg">
              Lively Forms is a focused tool for building conversational forms, sharing them publicly, and reviewing
              anonymous responses.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {session?.user ? (
                <Link href="/dashboard">
                  <Button size="lg">
                    Open dashboard
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
              ) : (
                <GoogleSignInButton />
              )}
            </div>

            <div className="mt-10 border-t border-black/8 pt-6 text-sm text-[var(--muted)]">
              <p>Core workflow: create a form, publish it, and review responses.</p>
            </div>
          </div>
        </Card>
      </section>
    </main>
  );
}
