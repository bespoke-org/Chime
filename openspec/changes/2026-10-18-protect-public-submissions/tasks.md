## 1. Rate limiting

- [x] 1.1 Add a sliding-window rate limiter module with an injectable clock and periodic pruning of idle keys
- [x] 1.2 Add client IP resolution from `X-Forwarded-For` and `X-Real-IP` with an `"unknown"` fallback
- [x] 1.3 Apply a per-IP and a per-IP-and-form limiter in the public responses route and respond with 429 when exceeded
- [x] 1.4 Add unit tests for window boundaries, sliding behavior, independent keys, pruning, and header parsing

## 2. Honeypot and minimum fill time

- [x] 2.1 Render a hidden honeypot input in the public runner and send its value as a top-level payload field next to `answers`
- [x] 2.2 Record the runner start time and send it as `startedAt` with the submission
- [x] 2.3 Add a pure trap decision that drops non-empty honeypots and too-fast submissions while ignoring missing or malformed `startedAt`
- [x] 2.4 Return a fake success for trapped submissions without storing a response
- [x] 2.5 Add unit tests for the trap decision and a runner test proving the honeypot is hidden, empty, and included in the payload

## 3. Configuration and copy

- [x] 3.1 Read `SUBMISSION_RATE_LIMIT`, `SUBMISSION_GLOBAL_RATE_LIMIT`, `SUBMISSION_RATE_WINDOW_SECONDS`, `SUBMISSION_MIN_FILL_SECONDS` with defaults and ignore invalid values
- [x] 3.2 Add localized runner copy for the rate-limit error in `en` and `ru` and show it on a 429 response
- [x] 3.3 Document the variables and the proxy requirement in `docs/deployment.md` and `.env.example`
