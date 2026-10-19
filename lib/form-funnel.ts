// Shared by the responses page and its tests, so it has no server imports.

export type FormFunnelCounts = {
  opened: number;
  started: number;
  submitted: number;
};

// Share of visitors who reached a step, as a whole percent. Responses
// submitted before visits were tracked can outnumber the visits, so the
// share is capped at 100; with no recorded visits there is no share.
export function getFunnelPercent(count: number, opened: number) {
  if (opened <= 0) {
    return null;
  }

  return Math.min(100, Math.round((count / opened) * 100));
}
