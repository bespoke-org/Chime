// Shared by the responses page and its tests, so it has no server imports.

export type FormFunnelCounts = {
  opened: number;
  started: number;
  submitted: number;
};

// Share of visitors who reached a step, as a whole percent. Every step
// counts browsers, so a step cannot exceed the opens; the cap at 100 only
// guards against counts read at different moments. With no recorded visits
// there is no share.
export function getFunnelPercent(count: number, opened: number) {
  if (opened <= 0) {
    return null;
  }

  return Math.min(100, Math.round((count / opened) * 100));
}
