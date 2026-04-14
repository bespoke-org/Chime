## 1. Draft persistence foundation

- [x] 1.1 Add a public runner draft helper module for storage keys, payload parsing, fingerprint generation, and safe localStorage read/write/remove operations
- [x] 1.2 Add restore validation that replays saved route history against the current form blocks and rejects stale or corrupted drafts

## 2. Public runner integration

- [x] 2.1 Integrate restore-on-load logic into `components/public-form-runner.tsx` so valid drafts repopulate answers, history, and cursor before interaction begins
- [x] 2.2 Add debounced draft persistence for answer and route changes, plus cleanup on successful submission or stale-draft discard
- [x] 2.3 Add localized public runner feedback for restored progress and discarded saved drafts

## 3. Verification

- [x] 3.1 Verify refresh and close/reopen flows restore the same in-progress answers and visited step in the same browser
- [x] 3.2 Verify branched-path restoration, stale-form invalidation, storage-failure fallback, and post-submit draft cleanup behavior
