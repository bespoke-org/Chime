## 1. Lock behavior with tests

- [x] 1.1 Add focused regression tests around the first `lib/forms.ts` behavior slice selected for extraction
- [x] 1.2 Add or strengthen tests around the next builder seam selected for extraction
- [x] 1.3 Add or strengthen tests around the next public runner seam selected for extraction

## 2. Reduce `lib/forms.ts` responsibility spread

- [x] 2.1 Extract a cohesive response/review or submission helper module out of `lib/forms.ts`
- [x] 2.2 Update existing callers to use the new helper module without changing behavior
- [x] 2.3 Remove obsolete duplication or inline logic from `lib/forms.ts`

## 3. Reduce builder complexity

- [x] 3.1 Extract the first focused builder seam into a smaller helper, hook, or component boundary
- [x] 3.2 Keep builder state and mutation behavior covered by tests while simplifying the parent surfaces
- [x] 3.3 Remove obsolete duplication or inline logic from the builder files

## 4. Reduce runner complexity

- [x] 4.1 Extract the first focused runner seam into a smaller helper, hook, or component boundary
- [x] 4.2 Keep runner route, validation, and submission behavior covered by tests while simplifying the parent surface
- [x] 4.3 Remove obsolete duplication or inline logic from the runner file

## 5. Verify stability

- [x] 5.1 Run targeted tests for the extracted seams
- [x] 5.2 Run format, lint, and typecheck
- [x] 5.3 Run a production build before finalizing the change