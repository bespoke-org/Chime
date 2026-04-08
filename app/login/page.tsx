import { redirect } from "next/navigation";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Card } from "@/components/ui/card";
import { getServerAuthSession } from "@/lib/auth";

export default async function LoginPage() {
  const session = await getServerAuthSession();

  if (session?.user?.id) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl items-center px-6 py-16">
      <Card className="grid w-full overflow-hidden lg:grid-cols-[1.1fr_0.9fr]">
        <div className="bg-[#191611] p-10 text-white lg:p-14">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#b9dfb9]">Lively Forms creator access</p>
          <h1 className="mt-8 font-display text-5xl leading-tight">Sign in to craft the form experience.</h1>
          <p className="mt-6 max-w-md text-sm leading-7 text-white/70">
            Creator auth is used only for owning, editing, publishing, and reviewing forms. Public respondents never
            log in and their submissions stay anonymous.
          </p>
        </div>
        <div className="flex items-center justify-center bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(237,247,237,0.96))] p-10 lg:p-14">
          <div className="w-full max-w-sm space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">Lively Forms login</p>
              <h2 className="mt-3 font-display text-4xl text-[var(--ink)]">Use Google to continue.</h2>
            </div>
            <p className="text-sm leading-7 text-[var(--muted)]">
              Keep auth simple in v0 and stay focused on the form builder and conversational runner.
            </p>
            <GoogleSignInButton />
          </div>
        </div>
      </Card>
    </main>
  );
}
