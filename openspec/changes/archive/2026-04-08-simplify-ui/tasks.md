## 1. Shared visual language

- [x] 1.1 Simplify shared background, surface, and metadata styling in `app/globals.css` and `app/layout.tsx` to support a quieter default presentation
- [x] 1.2 Update shared creator-facing support components such as `components/empty-state.tsx` so headings and helper copy stay concise and functional

## 2. Entry surfaces

- [x] 2.1 Rewrite `app/page.tsx` into a direct product entry page with a short description, a primary action, and no promotional showcase sections
- [x] 2.2 Simplify `app/login/page.tsx` so creator authentication is explained with compact, utility-first copy and layout

## 3. Creator surfaces

- [x] 3.1 Simplify `app/(creator)/layout.tsx` header chrome so it keeps only essential identity, navigation, and sign-out context
- [x] 3.2 Simplify `app/(creator)/dashboard/page.tsx` so form creation, form status, and response access are primary while decorative hero treatments and promotional copy are removed
- [x] 3.3 Update `components/form-builder.tsx` so builder headings, helper text, and top-level chrome are editing-focused and consistent with the minimal direction

## 4. Validation

- [x] 4.1 Visually verify the home page, login page, dashboard, builder, responses, and public runner after shared styling changes to confirm workflows still read clearly
- [x] 4.2 Run the project checks needed for a UI-only change and confirm there are no regressions in the touched surfaces