import { describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";

import { I18nProvider } from "@/components/i18n-provider";
import { PublicFormRunner } from "@/components/public-form-runner";
import type { SerializedBlock } from "@/lib/blocks";
import { createPublicFormDraft } from "@/lib/public-form-draft";
import type { PublicForm } from "@/lib/form-types";
import { installTestDom } from "@/test/install-dom";

function createBlock(overrides: {
  id: string;
  type:
    | "TEXT"
    | "SHORT_TEXT"
    | "LONG_TEXT"
    | "SINGLE_CHOICE"
    | "MULTIPLE_CHOICE"
    | "AGREEMENT"
    | "NUMBER"
    | "LINK"
    | "DATE";
  position: number;
  title?: string;
  config?: Record<string, unknown>;
}): SerializedBlock {
  const now = new Date("2026-04-15T12:00:00.000Z");

  const config = (() => {
    switch (overrides.type) {
      case "TEXT":
        return { body: "Intro", endForm: false };
      case "SINGLE_CHOICE":
      case "MULTIPLE_CHOICE":
        return {
          options: ["yes", "no"],
          branchRules: [],
          defaultNextBlockId: null,
          endForm: false,
        };
      case "AGREEMENT":
        return {
          label: "I agree",
          branchRules: [],
          defaultNextBlockId: null,
          endForm: false,
        };
      case "NUMBER":
        return {
          placeholder: "42",
          allowFloat: true,
          min: null,
          max: null,
          branchRules: [],
          defaultNextBlockId: null,
          endForm: false,
        };
      case "LINK":
        return {
          placeholder: "https://example.com",
          branchRules: [],
          defaultNextBlockId: null,
          endForm: false,
        };
      case "DATE":
        return {
          branchRules: [],
          defaultNextBlockId: null,
          endForm: false,
        };
      case "SHORT_TEXT":
      case "LONG_TEXT":
        return {
          placeholder: "",
          validationRegex: null,
          branchRules: [],
          defaultNextBlockId: null,
          endForm: false,
        };
    }
  })();

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
    config: overrides.config ?? config,
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
          defaultTextTitle: "Take a breath before the next step.",
          openCalendar: "Open calendar",
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

  test("autofocuses the active short-text input", async () => {
    const restoreDom = installTestDom();
    const view = renderRunner(
      createForm([
        createBlock({
          id: "name",
          type: "SHORT_TEXT",
          position: 0,
          title: "Name",
        }),
      ]),
    );

    await waitFor(() => {
      expect(view.getByRole("textbox") === document.activeElement).toBe(true);
    });

    await cleanupAndRestore(restoreDom);
  });

  test("autofocuses the active date input", async () => {
    const restoreDom = installTestDom();
    const view = renderRunner(
      createForm([
        createBlock({ id: "dob", type: "DATE", position: 0, title: "Date" }),
      ]),
    );

    await waitFor(() => {
      expect(
        view.getByPlaceholderText("YYYY-MM-DD") === document.activeElement,
      ).toBe(true);
    });

    await cleanupAndRestore(restoreDom);
  });

  test("shows visible shortcut hints and responds to digit shortcuts for choice questions", async () => {
    const restoreDom = installTestDom();
    const singleChoiceView = renderRunner(
      createForm([
        createBlock({
          id: "choice",
          type: "SINGLE_CHOICE",
          position: 0,
          title: "Pick one",
        }),
      ]),
    );

    expect(
      singleChoiceView.getByRole("button", { name: /yes 1/i }) !== null,
    ).toBe(true);

    fireEvent.keyDown(window, { key: "2" });

    await waitFor(() => {
      expect(
        singleChoiceView
          .getByRole("button", { name: /no 2/i })
          .getAttribute("aria-pressed"),
      ).toBe("true");
    });

    cleanup();

    const multiChoiceView = renderRunner(
      createForm([
        createBlock({
          id: "multi",
          type: "MULTIPLE_CHOICE",
          position: 0,
          title: "Pick many",
        }),
      ]),
    );

    fireEvent.keyDown(window, { key: "1" });
    await waitFor(() => {
      expect(
        multiChoiceView
          .getByRole("button", { name: /yes 1/i })
          .getAttribute("aria-pressed"),
      ).toBe("true");
    });

    fireEvent.keyDown(window, { key: "1" });
    await waitFor(() => {
      expect(
        multiChoiceView
          .getByRole("button", { name: /yes 1/i })
          .getAttribute("aria-pressed"),
      ).toBe("false");
    });

    cleanup();

    const agreementView = renderRunner(
      createForm([
        createBlock({
          id: "agree",
          type: "AGREEMENT",
          position: 0,
          title: "Agreement",
        }),
      ]),
    );

    fireEvent.keyDown(window, { key: "1" });

    await waitFor(() => {
      expect(
        agreementView
          .getByRole("button", { name: /I agree 1/i })
          .getAttribute("aria-pressed"),
      ).toBe("true");
    });

    fireEvent.keyDown(window, { key: "1" });

    await waitFor(() => {
      expect(
        agreementView
          .getByRole("button", { name: /I agree 1/i })
          .getAttribute("aria-pressed"),
      ).toBe("false");
    });

    await cleanupAndRestore(restoreDom);
  });

  test("pressing Enter on a focused choice control does not toggle to that focused option", async () => {
    const restoreDom = installTestDom();
    const branchingChoice = createBlock({
      id: "choice",
      type: "SINGLE_CHOICE",
      position: 0,
      title: "Pick a path",
    });

    const view = renderRunner(
      createForm([
        branchingChoice,
        createBlock({
          id: "after-choice",
          type: "SHORT_TEXT",
          position: 1,
          title: "After choice",
        }),
      ]),
    );

    fireEvent.click(view.getByRole("button", { name: /yes 1/i }));

    await waitFor(() => {
      expect(
        view
          .getByRole("button", { name: /yes 1/i })
          .getAttribute("aria-pressed"),
      ).toBe("true");
    });

    const noButton = view.getByRole("button", { name: /no 2/i });
    noButton.focus();
    fireEvent.keyDown(noButton, {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      charCode: 13,
      which: 13,
    });

    expect(
      view.getByRole("button", { name: /yes 1/i }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(noButton.getAttribute("aria-pressed")).toBe("false");

    await cleanupAndRestore(restoreDom);
  });
});
