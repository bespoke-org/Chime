## Context

Anonymous submissions arrive at `POST /api/public/forms/[slug]/responses`, which parses the payload, replays the branch route on the server, and stores the response. Nothing in that path distinguishes a person from a script. The app runs as one Node process behind Caddy on a single host, with Postgres as the only backing service. The runner already keeps client-side state such as the saved draft, so it can carry a little extra information to the server without changing how answers are collected.

## Goals / Non-Goals

**Goals:**
- Stop bulk submission from a single client without any external service.
- Give bots no signal that they were detected.
- Keep real respondents unaffected in normal use, including slow networks and skewed device clocks.
- Keep every decision unit-testable without a database or a request.

**Non-Goals:**
- A CAPTCHA or any third-party verification service.
- Distributed rate limiting across several app instances.
- Blocking by reputation lists, user agents, or geography.
- Protecting creator-side API routes, which already require a session.

## Decisions

### 1. Rate limit in process memory with a sliding window
A small limiter keeps hit timestamps per key in a `Map`, drops timestamps outside the window on every hit, and prunes idle keys periodically. The route applies two limiters: per client IP across all forms, and per client IP and form slug. The client IP is the first `X-Forwarded-For` entry, then `X-Real-IP`, else `"unknown"`.

**Why:** The deployment is a single process, so a shared store would add infrastructure for no gain. Counting every attempt, not only stored responses, also slows down validation probing.

**Alternatives considered:**
- A Postgres table for counters: rejected because it adds a write per submission and still needs pruning.
- Redis: rejected as new infrastructure for one node.

### 2. Honeypot field outside the answers map
The runner renders a text input in an `aria-hidden`, off-screen container with `tabIndex=-1` and `autoComplete="off"`, and sends its value as the top-level `website` field next to `answers`. The server treats any non-empty value as a trap.

**Why:** Keeping it out of `answers` means `parseSubmissionPayload` and the branch walk do not change, and the field can never collide with a block id.

### 3. Minimum fill time, lenient on missing data
The runner records `Date.now()` when it mounts and sends it as `startedAt`. When a saved draft is restored, the draft's `savedAt` is used instead, since the session started before this page load and a respondent finishing the last step right after restoring must not be trapped. The server drops a submission only when `startedAt` is present, parseable, and less than the minimum fill time before the server's clock. A missing or malformed value, or a value in the future, is not held against the respondent.

**Why:** Device clocks drift and old drafts may lack the field. False positives here would lose a real response silently, which is worse than letting a fast bot through; the honeypot and the rate limit still apply.

### 4. Trapped submissions get a fake success
When the honeypot or fill-time check trips, the route returns `200` with a random `responseId` and stores nothing.

**Why:** An error response tells the sender what to change. A success response costs nothing and ends the interaction.

### 5. Limits are environment configuration, not form settings
`SUBMISSION_RATE_LIMIT`, `SUBMISSION_GLOBAL_RATE_LIMIT`, `SUBMISSION_RATE_WINDOW_SECONDS` and `SUBMISSION_MIN_FILL_SECONDS` are read once with defaults 5, 30, 600 and 3. Invalid values fall back to the defaults.

**Why:** These are operator concerns tied to the host and the proxy, not something creators should tune per form.

## Risks / Trade-offs

- [Respondents behind one NAT share a limit] → Mitigation: the per-form default of 5 per 10 minutes is well above normal use; operators can raise it.
- [Proxy does not set a forwarded IP] → Mitigation: documented; all traffic would then share the `"unknown"` key, which is visible immediately in testing.
- [Memory grows with many distinct keys] → Mitigation: idle keys are pruned every N hits and on every hit for the key itself.
- [A restart resets the counters] → Accepted; the window is short.
- [Password managers or accessibility tools fill the honeypot] → Mitigation: `autoComplete="off"`, `aria-hidden`, `tabIndex=-1` and an off-screen container; the field is named after a value no form asks for.

## Migration Plan

- No schema changes. Deploying the new route and runner together is enough.
- Rollback: revert the route; the extra payload fields from an older runner are ignored by the previous handler.

## Open Questions

- None. If the app ever runs on more than one instance, the limiter needs a shared store, which is out of scope here.
