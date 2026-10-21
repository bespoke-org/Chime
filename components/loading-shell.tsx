export function LoadingShell({ label }: { label: string }) {
  return (
    <div className="space-y-6">
      <div className="h-4 w-24 animate-pulse rounded-md bg-[var(--line)]" />
      <div className="h-10 w-64 animate-pulse rounded-md bg-[var(--line)]" />
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="h-[420px] animate-pulse rounded-[10px] border border-[color:var(--line)] bg-[var(--surface-strong)]" />
        <div className="h-[420px] animate-pulse rounded-[10px] border border-[color:var(--line)] bg-[var(--surface-strong)]" />
      </div>
      <p className="text-sm text-[var(--muted)]">{label}</p>
    </div>
  );
}
