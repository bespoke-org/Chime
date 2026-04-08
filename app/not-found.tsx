import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
      <Card className="w-full px-8 py-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">Not found</p>
        <h1 className="mt-4 font-display text-4xl text-[var(--ink)]">That page or form doesn’t exist.</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-[var(--muted)]">
          If you were expecting a public form, it may still be in draft. If you were editing a creator form, you may
          not have access to it.
        </p>
        <div className="mt-6 flex justify-center">
          <Link href="/">
            <Button>Back home</Button>
          </Link>
        </div>
      </Card>
    </main>
  );
}
