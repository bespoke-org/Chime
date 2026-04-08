export function LoadingShell({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <div className="h-4 w-24 animate-pulse rounded-full bg-black/10" />
      <div className="h-12 w-64 animate-pulse rounded-full bg-black/10" />
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="h-[420px] animate-pulse rounded-[20px] bg-white/70 shadow-[0_22px_60px_rgba(15,23,42,0.08)]" />
        <div className="h-[420px] animate-pulse rounded-[20px] bg-white/70 shadow-[0_22px_60px_rgba(15,23,42,0.08)]" />
      </div>
      <p className="text-sm text-[var(--muted)]">Loading {title}…</p>
    </div>
  );
}
