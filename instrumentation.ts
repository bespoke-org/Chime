// Next.js calls register() once per server start. The digest scheduler runs
// here on a timer; a single app instance is assumed (see docs/deployment.md).
// `bun run webhooks:digest` runs the same tick from cron when the app is
// deployed without a long-lived process.

const DIGEST_TICK_MS = 60 * 1000;

const globalState = globalThis as unknown as {
  __livelyFormsDigestTimer?: ReturnType<typeof setInterval>;
};

export async function register() {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.NEXT_PHASE === "phase-production-build" ||
    globalState.__livelyFormsDigestTimer
  ) {
    return;
  }

  const { runDueDigests } = await import("@/lib/webhook-digests");
  let running = false;

  const tick = async () => {
    if (running) {
      return;
    }

    running = true;

    try {
      await runDueDigests();
    } catch (error) {
      console.warn("Digest scheduler tick failed:", error);
    } finally {
      running = false;
    }
  };

  globalState.__livelyFormsDigestTimer = setInterval(() => {
    void tick();
  }, DIGEST_TICK_MS);
  globalState.__livelyFormsDigestTimer.unref?.();
}
