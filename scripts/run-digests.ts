// Sends every digest webhook whose slot has passed, once. Run it from cron
// when the app is not kept running as one long-lived process, for example
// every minute: `bun run webhooks:digest`.
import { runDueDigests } from "../lib/webhook-digests";

const summary = await runDueDigests();

console.log(
  `Checked ${summary.checked} digest webhooks: sent ${summary.sent}, empty ${summary.empty}, failed ${summary.failed}, dropped ${summary.dropped}.`,
);
process.exit(0);
