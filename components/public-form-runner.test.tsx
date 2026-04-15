import { describe, expect, test } from "bun:test";
import { cleanup, render, waitFor } from "@testing-library/react";

import { I18nProvider } from "@/components/i18n-provider";
import { PublicFormRunner } from "@/components/public-form-runner";
import type { SerializedBlock } from "@/lib/blocks";
import { createPublicFormDraft } from "@/lib/public-form-draft";
import type { PublicForm } from "@/lib/form-types";
import { installTestDom } from "@/test/install-dom";

function createBlock(overrides: {
  id: string;
  type: "TEXT" | "SHORT_TEXT" | "SINGLE_CHOICE";
  position: number;
  title?: string;
  config?: Record<string, unknown>;
}): SerializedBlock {
  const now = new Date("2026-04-15T12:00:00.000Z");

  return {
    id: overrides.id,
    formId: "form-1",
    type: overrides.type,
    title: overrides.title ?? overrides.id,
    description: "",
    required: false,
    position: overrides.position,
    createdAt: now,
    updatedAt: now,
    config:
      overrides.config ??
      (overrides.type === "TEXT"
        ? { body: "Intro" }
        : overrides.type === "SINGLE_CHOICE"
          ? {
              options: ["yes", "no"],
              branchRules: [],
              defaultNextBlockId: null,
            }
          : {
              placeholder: "",
              validationRegex: null,
              branchRules: [],
              defaultNextBlockId: null,
            }),
  } as SerializedBlock;
}

function createForm(
  blocks: PublicForm["blocks"],
  overrides: Partial<PublicForm> = {},
): PublicForm {
  return {
    id: "form-1",
    title: "Demo form",
    description: "",
    completionTitle: "Thanks",
    completionMessage: "Done",
    completionLinkLabel: null,
    completionLinkUrl: null,
    respondentLocale: null,
    showProgress: false,
    allowBackNavigation: true,
    slug: "demo-form",
    blocks,
    ...overrides,
  };
}

function renderRunner(form: PublicForm) {
  return render(
    <I18nProvider
      locale="en"
      messages={{
        publicRunner: {
          back: "Back",
          continue: "Continue",
          submit: "Submit",
          progressRestored: "Progress restored",
          savedProgressDiscarded: "Saved progress discarded",
        },
      }}
    >
      <PublicFormRunner form={form} />
    </I18nProvider>,
  );
}

async function cleanupAndRestore(restoreDom: () => void) {
  cleanup();
  await new Promise((resolve) => setTimeout(resolve, 0));
  restoreDom();
}

describe("PublicFormRunner", () => {
  test("shows the back button only when the form allows back navigation", async () => {
    const restoreDom = installTestDom();
    const blocks = [
      createBlock({ id: "intro", type: "TEXT", position: 0, title: "Intro" }),
      createBlock({
        id: "name",
        type: "SHORT_TEXT",
        position: 1,
        title: "Name",
      }),
    ];

    const enabledView = renderRunner(createForm(blocks));
    expect(enabledView.getByRole("button", { name: /Back/i }) !== null).toBe(
      true,
    );
    cleanup();

    const disabledView = renderRunner(
      createForm(blocks, { allowBackNavigation: false }),
    );
    expect(disabledView.queryByRole("button", { name: /Back/i }) === null).toBe(
      true,
    );

    await cleanupAndRestore(restoreDom);
  });

  test("restored sessions with back navigation disabled do not expose or trigger back navigation", async () => {
    const restoreDom = installTestDom();
    const form = createForm(
      [
        createBlock({
          id: "name",
          type: "SHORT_TEXT",
          position: 0,
          title: "Name",
        }),
        createBlock({
          id: "notes",
          type: "SHORT_TEXT",
          position: 1,
          title: "Notes",
        }),
      ],
      { allowBackNavigation: false },
    );

    window.localStorage.setItem(
      `lively-forms-public-runner-draft:${form.id}`,
      JSON.stringify(
        createPublicFormDraft(form, {
          answers: { name: "Ada", notes: "Saved" },
          history: ["name", "notes"],
          cursor: 1,
        }),
      ),
    );

    const view = renderRunner(form);

    await waitFor(() => {
      expect(view.getByText("Progress restored") !== null).toBe(true);
    });
    expect(view.queryByRole("button", { name: /Back/i }) === null).toBe(true);

    await cleanupAndRestore(restoreDom);
  });

  test("restored sessions with back navigation enabled still allow going back", async () => {
    const restoreDom = installTestDom();
    const form = createForm([
      createBlock({
        id: "name",
        type: "SHORT_TEXT",
        position: 0,
        title: "Name",
      }),
      createBlock({
        id: "notes",
        type: "SHORT_TEXT",
        position: 1,
        title: "Notes",
      }),
    ]);

    window.localStorage.setItem(
      `lively-forms-public-runner-draft:${form.id}`,
      JSON.stringify(
        createPublicFormDraft(form, {
          answers: { name: "Ada", notes: "Saved" },
          history: ["name", "notes"],
          cursor: 1,
        }),
      ),
    );

    const view = renderRunner(form);

    await waitFor(() => {
      expect(view.getByText("Progress restored") !== null).toBe(true);
    });
    expect(view.getByRole("button", { name: /Back/i }) !== null).toBe(true);

    await cleanupAndRestore(restoreDom);
  });
});
