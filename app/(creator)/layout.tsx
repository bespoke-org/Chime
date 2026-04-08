import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { getServerAuthSession } from "@/lib/auth";

export default async function CreatorLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-6 py-8 lg:px-10">
      <header className="mb-8 flex flex-col gap-4 rounded-[30px] border border-black/8 bg-white/70 px-6 py-5 backdrop-blur-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--accent)]">Lively Forms</p>
            <p className="text-sm text-[var(--muted)]">Creator workspace</p>
          </Link>
          <div className="hidden h-12 w-px bg-black/8 lg:block" />
          <div className="hidden lg:block">
            <p className="font-display text-2xl text-[var(--ink)]">{session.user.name ?? session.user.email ?? "Creator"}</p>
            <p className="text-sm text-[var(--muted)]">Own forms, publish calmly, review responses.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm font-medium text-[var(--muted)] transition hover:text-[var(--ink)]">
            Dashboard
          </Link>
          <SignOutButton />
        </div>
      </header>
      {children}
    </main>
  );
}
