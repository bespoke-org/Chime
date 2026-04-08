import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getServerAuthSession } from "@/lib/auth";

export default async function HomePage() {
  const session = await getServerAuthSession();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10 lg:px-10">
      <header className="flex items-center justify-between rounded-full border border-black/8 bg-white/60 px-5 py-3 backdrop-blur-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--accent)]">Lively Forms</p>
          <p className="text-xs text-[var(--muted)]">Conversational forms with a softer, brighter rhythm.</p>
        </div>
        <Link href={session?.user ? "/dashboard" : "/login"}>
          <Button variant="secondary" size="sm">
            {session?.user ? "Open dashboard" : "Creator login"}
          </Button>
        </Link>
      </header>

      <section className="grid flex-1 items-center gap-8 py-12 lg:grid-cols-[1.25fr_0.9fr] lg:py-20">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)] backdrop-blur-sm">
            <Sparkles className="size-3.5" />
            Lively Forms v0
          </div>
          <div className="space-y-5">
            <h1 className="max-w-4xl font-display text-6xl leading-none text-[var(--ink)] md:text-7xl">
              Build forms that feel like a calm conversation.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-[var(--muted)]">
              Create linear, elegant flows with focused screens, anonymous public submissions, and a polished
              creator workflow made for shipping quickly.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href={session?.user ? "/dashboard" : "/login"}>
              <Button size="lg">
                {session?.user ? "Go to dashboard" : "Start with Google"}
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <a href="#surfaces">
              <Button variant="secondary" size="lg">
                See product surfaces
              </Button>
            </a>
          </div>
        </div>

        <Card className="overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(235,247,235,0.94))] p-6">
          <div className="rounded-[24px] border border-black/8 bg-[#171411] p-6 text-white shadow-[0_24px_70px_rgba(23,20,17,0.26)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b9dfb9]">Respondent experience</p>
            <div className="mt-8 space-y-6">
              <div className="h-1.5 rounded-full bg-white/10">
                <div className="h-full w-1/2 rounded-full bg-[#9fd7a4]" />
              </div>
              <div className="space-y-4">
                <p className="text-sm uppercase tracking-[0.3em] text-white/45">Step 2 of 4</p>
                <h2 className="font-display text-4xl leading-tight">What should we call you?</h2>
                <p className="max-w-sm text-sm leading-7 text-white/70">
                  Every step gets the full stage — large type, clean focus, and motion that keeps the flow moving.
                </p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-white/55">Type your answer here…</div>
              <div className="flex items-center justify-between">
                <Button variant="secondary" className="border border-white/12 bg-white/8 text-white hover:bg-white/14">
                  Back
                </Button>
                <Button className="bg-[#9fd7a4] text-[#122012] hover:bg-[#b8e4bb]">Continue</Button>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section id="surfaces" className="grid gap-6 pb-8 md:grid-cols-3">
        {[
          ["Creator dashboard", "Start new forms, manage drafts, and jump straight into editing without extra ceremony."],
          ["Block builder", "A master-detail editor keeps structure simple while the public runner gets the design spotlight."],
          ["Response review", "Read each submission in form order and keep the conversational context intact."],
        ].map(([title, description]) => (
          <Card key={title} className="p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[var(--accent)]">Surface</p>
            <h3 className="mt-4 font-display text-3xl">{title}</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{description}</p>
          </Card>
        ))}
      </section>
    </main>
  );
}
