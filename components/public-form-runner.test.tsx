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
    | "DATE"
    | "RATING";
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
      case "RATING":
        return {
          min: 1,
          max: 5,
          minLabel: "Poor",
          maxLabel: "Great",
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
    closedMessage: "",
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
          tooManySubmissions: "Slow down",
          defaultClosedMessage: "Closed by default",
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

// react-dom is loaded before the test DOM exists, so it falls back to its
// legacy change-tracking path: it watches the focused text input and re-reads
// its value on key events instead of listening to input events.
function typeIntoInput(input: HTMLElement, value: string) {
  fireEvent.focusIn(input);
  fireEvent.change(input, { target: { value } });
  fireEvent.keyUp(input, { key: value.slice(-1) });
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

  test("submits a hidden empty honeypot and the start time alongside the answers", async () => {
    const restoreDom = installTestDom();
    const previousFetch = globalThis.fetch;
    const fetchCalls: { url: string; init?: RequestInit }[] = [];

    globalThis.fetch = (async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      fetchCalls.push({ url: String(url), init });

      return {
        ok: true,
        status: 200,
        json: async () => ({ responseId: "r1" }),
      } as Response;
    }) as typeof fetch;

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

    const honeypot = view.getByTestId("runner-honeypot") as HTMLInputElement;
    expect(honeypot.tabIndex).toBe(-1);
    expect(honeypot.getAttribute("autocomplete")).toBe("off");
    expect(honeypot.value).toBe("");
    expect(honeypot.parentElement?.getAttribute("aria-hidden")).toBe("true");
    expect(view.getAllByRole("textbox").length).toBe(1);

    typeIntoInput(view.getByRole("textbox"), "Ada");
    fireEvent.click(view.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(fetchCalls.length).toBe(1);
    });

    const body = JSON.parse(String(fetchCalls[0]?.init?.body)) as {
      answers: Record<string, unknown>;
      website: unknown;
      startedAt: unknown;
    };

    expect(fetchCalls[0]?.url).toBe("/api/public/forms/demo-form/responses");
    expect(body.answers.name).toBe("Ada");
    expect(body.website).toBe("");
    expect(typeof body.startedAt).toBe("number");
    expect((body.startedAt as number) <= Date.now()).toBe(true);

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });

  test("uses the saved draft time as the start time after restoring progress", async () => {
    const restoreDom = installTestDom();
    const previousFetch = globalThis.fetch;
    const fetchCalls: { url: string; init?: RequestInit }[] = [];

    globalThis.fetch = (async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      fetchCalls.push({ url: String(url), init });

      return {
        ok: true,
        status: 200,
        json: async () => ({ responseId: "r1" }),
      } as Response;
    }) as typeof fetch;

    const form = createForm([
      createBlock({
        id: "name",
        type: "SHORT_TEXT",
        position: 0,
        title: "Name",
      }),
    ]);
    const savedAt = Date.now() - 5 * 60 * 1000;

    window.localStorage.setItem(
      `lively-forms-public-runner-draft:${form.id}`,
      JSON.stringify({
        ...createPublicFormDraft(form, {
          answers: { name: "Ada" },
          history: ["name"],
          cursor: 0,
        }),
        savedAt,
      }),
    );

    const view = renderRunner(form);

    await waitFor(() => {
      expect((view.getByRole("textbox") as HTMLInputElement).value).toBe("Ada");
    });

    fireEvent.click(view.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(fetchCalls.length).toBe(1);
    });

    const body = JSON.parse(String(fetchCalls[0]?.init?.body)) as {
      startedAt: unknown;
    };

    expect(body.startedAt).toBe(savedAt);

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });

  test("shows the localized rate-limit message on a 429 response", async () => {
    const restoreDom = installTestDom();
    const previousFetch = globalThis.fetch;

    globalThis.fetch = (async () =>
      ({
        ok: false,
        status: 429,
        json: async () => ({ error: "Too many submissions." }),
      }) as Response) as typeof fetch;

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

    typeIntoInput(view.getByRole("textbox"), "Ada");
    fireEvent.click(view.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(view.queryByText("Slow down") !== null).toBe(true);
    });

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });

  test("shows the form's closed message on a 410 response", async () => {
    const restoreDom = installTestDom();
    const previousFetch = globalThis.fetch;

    globalThis.fetch = (async () =>
      ({
        ok: false,
        status: 410,
        json: async () => ({ error: "Gone." }),
      }) as Response) as typeof fetch;

    const view = renderRunner(
      createForm(
        [
          createBlock({
            id: "name",
            type: "SHORT_TEXT",
            position: 0,
            title: "Name",
          }),
        ],
        { closedMessage: "Applications are closed." },
      ),
    );

    typeIntoInput(view.getByRole("textbox"), "Ada");
    fireEvent.click(view.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(view.queryByText("Applications are closed.") !== null).toBe(true);
    });
    expect(view.queryByText("Gone.")).toBe(null);

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });

  test("falls back to the default closed message on a 410 response", async () => {
    const restoreDom = installTestDom();
    const previousFetch = globalThis.fetch;

    globalThis.fetch = (async () =>
      ({
        ok: false,
        status: 410,
        json: async () => ({ error: "Gone." }),
      }) as Response) as typeof fetch;

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

    typeIntoInput(view.getByRole("textbox"), "Ada");
    fireEvent.click(view.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(view.queryByText("Closed by default") !== null).toBe(true);
    });

    globalThis.fetch = previousFetch;
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
  test("renders rating buttons for the whole scale with the end labels", async () => {
    const restoreDom = installTestDom();
    const view = renderRunner(
      createForm([
        createBlock({
          id: "score",
          type: "RATING",
          position: 0,
          title: "How was it?",
        }),
      ]),
    );

    const pressed = view
      .getAllByRole("button", { pressed: false })
      .filter((button) => button.dataset.runnerChoiceControl === "true");

    expect(JSON.stringify(pressed.map((button) => button.textContent))).toBe(
      JSON.stringify(["1", "2", "3", "4", "5"]),
    );
    expect(view.getByText("Poor") !== null).toBe(true);
    expect(view.getByText("Great") !== null).toBe(true);
    expect(view.queryByRole("button", { name: "0" })).toBe(null);
    expect(view.queryByRole("button", { name: "6" })).toBe(null);

    await cleanupAndRestore(restoreDom);
  });

  test("selects a rating by click or digit key and submits the value", async () => {
    const restoreDom = installTestDom();
    const requests: Array<Record<string, unknown>> = [];
    const previousFetch = globalThis.fetch;

    globalThis.fetch = (async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      requests.push(JSON.parse(String(init?.body)));

      return {
        ok: true,
        status: 200,
        json: async () => ({ responseId: "response-1" }),
      } as Response;
    }) as typeof fetch;

    const view = renderRunner(
      createForm([
        createBlock({
          id: "score",
          type: "RATING",
          position: 0,
          title: "How was it?",
          config: {
            min: 0,
            max: 10,
            minLabel: "",
            maxLabel: "",
            branchRules: [],
            defaultNextBlockId: null,
            endForm: false,
          },
        }),
      ]),
    );

    fireEvent.click(view.getByRole("button", { name: "3" }));
    expect(
      view.getByRole("button", { name: "3" }).getAttribute("aria-pressed"),
    ).toBe("true");

    fireEvent.keyDown(window, { key: "7" });
    await waitFor(() => {
      expect(
        view.getByRole("button", { name: "7" }).getAttribute("aria-pressed"),
      ).toBe("true");
    });
    expect(
      view.getByRole("button", { name: "3" }).getAttribute("aria-pressed"),
    ).toBe("false");

    fireEvent.keyDown(window, { key: "0" });
    await waitFor(() => {
      expect(
        view.getByRole("button", { name: "10" }).getAttribute("aria-pressed"),
      ).toBe("true");
    });
    expect(
      view.getByRole("button", { name: "0" }).getAttribute("aria-pressed"),
    ).toBe("false");

    fireEvent.keyDown(window, { key: "Enter" });

    await waitFor(() => {
      expect(requests.length).toBe(1);
    });
    expect(
      JSON.stringify((requests[0]?.answers as Record<string, unknown>).score),
    ).toBe(JSON.stringify("10"));

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });

  test("the zero key selects 0 when the scale stops before 10 and clicking again clears the rating", async () => {
    const restoreDom = installTestDom();
    const view = renderRunner(
      createForm([
        createBlock({
          id: "score",
          type: "RATING",
          position: 0,
          config: {
            min: 0,
            max: 4,
            minLabel: "",
            maxLabel: "",
            branchRules: [],
            defaultNextBlockId: null,
            endForm: false,
          },
        }),
      ]),
    );

    fireEvent.keyDown(window, { key: "0" });
    await waitFor(() => {
      expect(
        view.getByRole("button", { name: "0" }).getAttribute("aria-pressed"),
      ).toBe("true");
    });

    fireEvent.keyDown(window, { key: "5" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(
      view
        .getAllByRole("button", { pressed: true })
        .map((button) => button.textContent)
        .join(","),
    ).toBe("0");

    fireEvent.click(view.getByRole("button", { name: "0" }));
    await waitFor(() => {
      expect(view.queryAllByRole("button", { pressed: true }).length).toBe(0);
    });

    await cleanupAndRestore(restoreDom);
  });
});
