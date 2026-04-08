"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
          <Card className="w-full px-8 py-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">Something broke</p>
            <h1 className="mt-4 font-display text-4xl text-[var(--ink)]">The forms hit an unexpected error.</h1>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-[var(--muted)]">
              Try the action again. If it keeps happening, check your environment variables, Google OAuth setup, and
              local Postgres container.
            </p>
            <div className="mt-6 flex justify-center">
              <Button onClick={() => reset()}>Try again</Button>
            </div>
          </Card>
        </main>
      </body>
    </html>
  );
}
