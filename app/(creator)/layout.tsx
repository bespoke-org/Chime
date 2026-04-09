import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { getServerAuthSession } from "@/lib/auth";

export default async function CreatorLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect("/");
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-6 py-8 lg:px-10">
      <header className="mb-8 flex flex-col gap-4 border-b border-[color:var(--line)] pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            aria-label="Go to dashboard"
            className="shrink-0 transition-transform hover:scale-[1.02]"
          >
            <Image src="/sproute.png" alt="Lively Forms" width={48} height={48} priority className="size-12" />
          </Link>
          <Link href="/dashboard" className="font-display text-2xl text-[var(--ink)] transition hover:text-[var(--accent)]">
            Lively Forms
          </Link>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/dashboard" className="text-sm font-medium text-[var(--muted)] transition hover:text-[var(--ink)]">
            Dashboard
          </Link>
          <Link href="/settings" className="text-sm font-medium text-[var(--muted)] transition hover:text-[var(--ink)]">
            Settings
          </Link>
          <SignOutButton />
        </div>
      </header>
      {children}
    </main>
  );
}
