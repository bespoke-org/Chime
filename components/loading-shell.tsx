export function LoadingShell({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <div className="h-4 w-24 animate-pulse rounded-full bg-[var(--line)]" />
      <div className="h-12 w-64 animate-pulse rounded-full bg-[var(--line)]" />
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="h-[420px] animate-pulse rounded-[20px] bg-[var(--surface)] shadow-[var(--shadow-surface)]" />
        <div className="h-[420px] animate-pulse rounded-[20px] bg-[var(--surface)] shadow-[var(--shadow-surface)]" />
      </div>
      <p className="text-sm text-[var(--muted)]">Loading {title}…</p>
    </div>
  );
}
