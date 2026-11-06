import { describe, expect, test } from "bun:test";

const { mock } = (await import("bun:test")) as unknown as {
  mock: { module: (specifier: string, factory: () => unknown) => void };
};
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";

import { I18nProvider } from "@/components/i18n-provider";
import { PublicFormRunner } from "@/components/public-form-runner";
import type { SerializedBlock } from "@/lib/blocks";
import {
  createPublicFormDraft,
  getPublicFormDraftStorageKey,
} from "@/lib/public-form-draft";
import type { PublicForm } from "@/lib/form-types";
import { installTestDom } from "@/test/install-dom";

// The test DOM has no animation timeline, so framer-motion transitions never
// complete and AnimatePresence mode="wait" would never mount the next page.
// Render motion elements synchronously, as a finished transition does.
mock.module("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  motion: {
    div: ({ children, ...rest }: Record<string, unknown>) => {
      const dom = { ...rest } as Record<string, unknown>;
      delete dom.initial;
      delete dom.animate;
      delete dom.exit;
      delete dom.transition;
      delete dom.onAnimationComplete;
      delete dom.layout;

      return <div {...dom}>{children as React.ReactNode}</div>;
    },
  },
}));

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
    | "RATING"
    | "FILE_UPLOAD";
  position: number;
  title?: string;
  required?: boolean;
  pageId?: string | null;
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
      case "FILE_UPLOAD":
        return {
          accept: "images",
          maxSizeMb: 1,
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
    required: overrides.required ?? false,
    position: overrides.position,
    pageId: overrides.pageId ?? null,
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
    pages: [],
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
          step: "Step {current} of {total}",
          answerRequired: "Please answer before continuing.",
          tooManySubmissions: "Slow down",
          defaultClosedMessage: "Closed by default",
          progressRestored: "Progress restored",
          savedProgressDiscarded: "Saved progress discarded",
          defaultTextTitle: "Take a breath before the next step.",
          openCalendar: "Open calendar",
          chooseFile: "Choose a file",
          fileHintImages: "Images up to {size} MB",
          fileTooLarge: "The file is larger than {size} MB.",
          fileTypeNotAllowed: "This file type is not accepted here.",
          fileAttached: "File attached",
          fileRemove: "Remove",
          fileUploading: "Uploading",
          fileUploadFailed: "Upload failed",
          fileRequired: "Attach a file before continuing.",
          numberRangeHint: "From {min} to {max}",
          numberMinHint: "No less than {min}",
          numberMaxHint: "No greater than {max}",
        },
        formPages: {
          instanceLabel: "Instance {number} of {count}",
          countMissing: "Answer “{question}” to continue",
          countTooLarge: "Enter at most {max} for “{question}”",
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
  test("a named page shows its name, a repeating one adds the instance label", async () => {
    const restoreDom = installTestDom();
    const blocks = [
      createBlock({
        id: "count",
        type: "NUMBER",
        position: 0,
        pageId: "count-page",
        title: "How many?",
        required: true,
      }),
      createBlock({
        id: "member",
        type: "SHORT_TEXT",
        position: 1,
        pageId: "members-page",
        title: "Member name",
        required: true,
      }),
    ];
    const view = renderRunner(
      createForm(blocks, {
        pages: [
          { id: "count-page", name: "Count" },
          {
            id: "members-page",
            name: "Members",
            repeat: { countBlockId: "count" },
          },
        ],
      }),
    );

    expect(view.getByText("Count") !== null).toBe(true);

    typeIntoInput(view.getByRole("textbox"), "2");
    fireEvent.click(view.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(view.getByText(/Instance 1 of 2/) !== null).toBe(true);
    });
    expect(view.getByText("Members · Instance 1 of 2") !== null).toBe(true);

    await cleanupAndRestore(restoreDom);
  });

  test("shows the number range hint from the block constraints", async () => {
    const restoreDom = installTestDom();
    const view = renderRunner(
      createForm([
        createBlock({
          id: "bounded",
          type: "NUMBER",
          position: 0,
          title: "How many?",
          config: { min: 2, max: 5 },
        }),
      ]),
    );

    expect(view.getByText("From 2 to 5") !== null).toBe(true);

    await cleanupAndRestore(restoreDom);
  });

  test("a number block without constraints shows no hint", async () => {
    const restoreDom = installTestDom();
    const view = renderRunner(
      createForm([
        createBlock({
          id: "free",
          type: "NUMBER",
          position: 0,
          title: "How many?",
        }),
      ]),
    );

    expect(view.queryByText(/From .+ to .+/) === null).toBe(true);

    await cleanupAndRestore(restoreDom);
  });

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
      `chime-public-runner-draft:${form.id}`,
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
      `chime-public-runner-draft:${form.id}`,
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
      `chime-public-runner-draft:${form.id}`,
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
    const previousFetch = globalThis.fetch;
    const requests: Array<Record<string, unknown>> = [];

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

    // Enter advances the page instead of selecting the focused option; the
    // saved answer stays "yes" all the way to the submitted response.
    await waitFor(() => {
      expect(view.getByText("After choice") !== null).toBe(true);
    });

    typeIntoInput(view.getByRole("textbox"), "Done");
    fireEvent.click(view.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(requests.length).toBe(1);
    });

    const answers = requests[0]?.answers as Record<string, unknown>;
    expect(answers.choice).toBe("yes");

    globalThis.fetch = previousFetch;
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

  test("renders a file input with the accept list and rejects an oversized file without a request", async () => {
    const restoreDom = installTestDom();
    const previousFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    }) as typeof fetch;

    const view = renderRunner(
      createForm([
        createBlock({ id: "photo", type: "FILE_UPLOAD", position: 0 }),
      ]),
    );

    const input = view.container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(input !== null).toBe(true);
    expect(input.getAttribute("accept")).toBe(
      "image/jpeg,image/png,image/gif,image/webp,image/heic",
    );
    expect(view.getByText("Images up to 1 MB") !== null).toBe(true);

    const big = new File([new Uint8Array(1024 * 1024 + 1)], "big.png", {
      type: "image/png",
    });
    fireEvent.change(input, { target: { files: [big] } });

    await waitFor(() => {
      expect(view.getByText("The file is larger than 1 MB.") !== null).toBe(
        true,
      );
    });
    expect(fetchCalls).toBe(0);

    const pdf = new File(["x"], "cv.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [pdf] } });

    await waitFor(() => {
      expect(
        view.getByText("This file type is not accepted here.") !== null,
      ).toBe(true);
    });
    expect(fetchCalls).toBe(0);

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });

  test("uploads the file through the presigned URL and submits the upload id", async () => {
    const restoreDom = installTestDom();
    const previousFetch = globalThis.fetch;
    const calls: Array<{ url: string; method?: string; body?: unknown }> = [];

    globalThis.fetch = (async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      const target = String(url);
      calls.push({ url: target, method: init?.method, body: init?.body });

      if (target.endsWith("/uploads")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            uploadId: "up-1",
            url: "https://files.example/chime/forms/f/photo/up-1/me.png?sig",
            method: "PUT",
            headers: { "content-type": "image/png" },
            expiresAt: "2026-10-18T10:10:00.000Z",
          }),
        } as Response;
      }

      if (target.startsWith("https://files.example/")) {
        return { ok: true, status: 200 } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ responseId: "response-1" }),
      } as Response;
    }) as typeof fetch;

    const view = renderRunner(
      createForm([
        createBlock({ id: "photo", type: "FILE_UPLOAD", position: 0 }),
      ]),
    );

    const input = view.container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["png-bytes"], "me.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(view.getByText("me.png") !== null).toBe(true);
    });
    expect(calls.length).toBe(2);
    expect(calls[0].url).toBe("/api/public/forms/demo-form/uploads");
    expect(JSON.stringify(JSON.parse(String(calls[0].body)))).toBe(
      JSON.stringify({
        blockId: "photo",
        filename: "me.png",
        contentType: "image/png",
        size: 9,
      }),
    );
    expect(calls[1].method).toBe("PUT");
    expect(calls[1].body === file).toBe(true);
    expect(view.getByRole("button", { name: "Remove" }) !== null).toBe(true);

    fireEvent.click(view.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(calls.length).toBe(3);
    });
    const submitted = JSON.parse(String(calls[2].body)) as {
      answers: Record<string, unknown>;
    };
    expect(submitted.answers.photo).toBe("up-1");

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });

  test("removing the attached file clears the answer", async () => {
    const restoreDom = installTestDom();
    const previousFetch = globalThis.fetch;

    globalThis.fetch = (async (url: string | URL | Request) => {
      const target = String(url);

      if (target.endsWith("/uploads")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            uploadId: "up-1",
            url: "https://files.example/x",
            headers: {},
          }),
        } as Response;
      }

      return { ok: true, status: 200, json: async () => ({}) } as Response;
    }) as typeof fetch;

    const view = renderRunner(
      createForm([
        createBlock({ id: "photo", type: "FILE_UPLOAD", position: 0 }),
      ]),
    );

    fireEvent.change(
      view.container.querySelector('input[type="file"]') as HTMLInputElement,
      {
        target: {
          files: [new File(["x"], "me.png", { type: "image/png" })],
        },
      },
    );

    await waitFor(() => {
      expect(view.getByText("me.png") !== null).toBe(true);
    });

    fireEvent.click(view.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(view.queryByText("me.png")).toBe(null);
    });
    expect(view.getByText("Choose a file") !== null).toBe(true);

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });

  test("a multi-block page shows every block and submits its answers in one request", async () => {
    const restoreDom = installTestDom();
    const previousFetch = globalThis.fetch;
    const requests: Array<Record<string, unknown>> = [];

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
      createForm(
        [
          createBlock({
            id: "intro",
            type: "TEXT",
            position: 0,
            pageId: "page-1",
          }),
          createBlock({
            id: "name",
            type: "SHORT_TEXT",
            position: 1,
            pageId: "page-1",
          }),
          createBlock({
            id: "notes",
            type: "LONG_TEXT",
            position: 2,
            pageId: "page-1",
          }),
          createBlock({
            id: "after",
            type: "SHORT_TEXT",
            position: 3,
            pageId: "page-2",
          }),
        ],
        { pages: [{ id: "page-1" }, { id: "page-2" }] },
      ),
    );

    expect(view.getByText("intro") !== null).toBe(true);
    expect(view.getAllByRole("textbox").length).toBe(2);
    expect(view.queryByText("after")).toBe(null);

    typeIntoInput(view.getAllByRole("textbox")[0] as HTMLElement, "Ada");
    typeIntoInput(view.getAllByRole("textbox")[1] as HTMLElement, "Notes");

    fireEvent.click(view.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(view.getByText("after") !== null).toBe(true);
    });
    expect(view.getAllByRole("textbox").length).toBe(1);

    typeIntoInput(view.getByRole("textbox"), "Done");
    fireEvent.click(view.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(requests.length).toBe(1);
    });

    const answers = requests[0]?.answers as Record<string, unknown>;
    expect(answers.name).toBe("Ada");
    expect(answers.notes).toBe("Notes");
    expect(answers.after).toBe("Done");

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });

  test("marks every invalid field inline, focuses the first, and clears corrected errors", async () => {
    const restoreDom = installTestDom();
    try {
      const view = renderRunner(
        createForm(
          [
            createBlock({
              id: "name",
              type: "SHORT_TEXT",
              position: 0,
              required: true,
              pageId: "details",
            }),
            createBlock({
              id: "notes",
              type: "LONG_TEXT",
              position: 1,
              required: true,
              pageId: "details",
            }),
            createBlock({
              id: "optional",
              type: "SHORT_TEXT",
              position: 2,
              pageId: "details",
            }),
          ],
          { pages: [{ id: "details" }] },
        ),
      );
      const name = view.getByRole("textbox", { name: "name" });
      const notes = view.getByRole("textbox", { name: "notes" });
      const optional = view.getByRole("textbox", { name: "optional" });
      expect(view.queryAllByRole("alert").length).toBe(0);
      fireEvent.click(view.getByRole("button", { name: "Submit" }));
      expect(view.getAllByRole("alert").length).toBe(2);
      expect(name.getAttribute("aria-invalid")).toBe("true");
      expect(notes.getAttribute("aria-invalid")).toBe("true");
      expect(optional.getAttribute("aria-invalid")).toBe("false");
      expect(view.queryByRole("status")).toBe(null);
      await waitFor(() => expect(document.activeElement).toBe(name));
      expect(
        document.getElementById(name.getAttribute("aria-describedby")!)
          ?.textContent,
      ).toBe("Please answer before continuing.");

      typeIntoInput(name, "Ada");
      expect(name.getAttribute("aria-invalid")).toBe("false");
      expect(name.hasAttribute("aria-describedby")).toBe(false);
      expect(view.getAllByRole("alert").length).toBe(1);
      fireEvent.click(view.getByRole("button", { name: "Submit" }));
      await waitFor(() => expect(document.activeElement).toBe(notes));
      // The delayed initial autofocus must not take focus back from the error.
      await new Promise((resolve) => setTimeout(resolve, 320));
      expect(document.activeElement).toBe(notes);
      typeIntoInput(notes, "Hello");
      expect(view.queryAllByRole("alert").length).toBe(0);
    } finally {
      await cleanupAndRestore(restoreDom);
    }
  });

  for (const type of [
    "SHORT_TEXT",
    "LONG_TEXT",
    "NUMBER",
    "LINK",
    "DATE",
    "SINGLE_CHOICE",
    "MULTIPLE_CHOICE",
    "RATING",
    "AGREEMENT",
    "FILE_UPLOAD",
  ] as const) {
    test(`an empty required ${type} has an inline error linked to its control`, async () => {
      const restoreDom = installTestDom();
      try {
        const view = renderRunner(
          createForm([
            createBlock({ id: "question", type, position: 0, required: true }),
          ]),
        );
        fireEvent.click(view.getByRole("button", { name: "Submit" }));
        const group = view.getByRole("group", { name: "question" });
        const error = view.getByRole("alert");
        expect(group.getAttribute("aria-invalid")).toBe("true");
        expect(group.getAttribute("aria-describedby")).toBe(error.id);
        const control = group.querySelector("input, textarea, button")!;
        expect(control.getAttribute("aria-invalid")).toBe("true");
        expect(control.getAttribute("aria-describedby")).toBe(error.id);
        expect(view.queryByRole("status")).toBe(null);
        await waitFor(() => expect(document.activeElement).toBe(control));
        if (
          ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "RATING", "AGREEMENT"].includes(
            type,
          )
        ) {
          fireEvent.click(control);
          expect(view.queryByRole("alert")).toBe(null);
          expect(control.getAttribute("aria-invalid")).toBe("false");
        }
      } finally {
        await cleanupAndRestore(restoreDom);
      }
    });
  }

  test("format errors remain inline while editing and disappear only for a valid answer", async () => {
    const restoreDom = installTestDom();
    try {
      const view = renderRunner(
        createForm([
          createBlock({
            id: "number",
            type: "NUMBER",
            position: 0,
            required: true,
          }),
        ]),
      );
      const input = view.getByRole("textbox", { name: "number" });
      typeIntoInput(input, "abc");
      fireEvent.click(view.getByRole("button", { name: "Submit" }));
      expect(view.getByRole("alert")).not.toBe(null);
      typeIntoInput(input, "def");
      expect(input.getAttribute("aria-invalid")).toBe("true");
      expect(view.getByRole("alert")).not.toBe(null);
      typeIntoInput(input, "42");
      expect(input.getAttribute("aria-invalid")).toBe("false");
      expect(view.queryByRole("alert")).toBe(null);
      expect(view.queryByRole("status")).toBe(null);
    } finally {
      await cleanupAndRestore(restoreDom);
    }
  });

  test("a page with a required empty block stays on screen with its error", async () => {
    const restoreDom = installTestDom();
    const previousFetch = globalThis.fetch;
    let fetchCalls = 0;

    globalThis.fetch = (async () => {
      fetchCalls += 1;
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    }) as typeof fetch;

    const view = renderRunner(
      createForm(
        [
          createBlock({
            id: "name",
            type: "SHORT_TEXT",
            position: 0,
            required: true,
            pageId: "page-1",
          }),
          createBlock({
            id: "notes",
            type: "SHORT_TEXT",
            position: 1,
            required: true,
            pageId: "page-1",
          }),
          createBlock({
            id: "after",
            type: "SHORT_TEXT",
            position: 2,
            pageId: "page-2",
          }),
        ],
        { pages: [{ id: "page-1" }, { id: "page-2" }] },
      ),
    );

    typeIntoInput(view.getAllByRole("textbox")[0] as HTMLElement, "Ada");

    fireEvent.click(view.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(view.getByText("Please answer before continuing.") !== null).toBe(
        true,
      );
    });
    expect(view.getAllByRole("textbox").length).toBe(2);
    expect(view.queryByText("after")).toBe(null);
    expect(fetchCalls).toBe(0);

    typeIntoInput(view.getAllByRole("textbox")[1] as HTMLElement, "Notes");

    fireEvent.click(view.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(view.getByText("after") !== null).toBe(true);
    });
    expect(fetchCalls).toBe(0);

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });

  test("Shift+Enter preserves long text editing and composing Enter does not advance", async () => {
    const restoreDom = installTestDom();
    try {
      const view = renderRunner(
        createForm([
          createBlock({
            id: "notes",
            type: "LONG_TEXT",
            position: 0,
            required: true,
          }),
          createBlock({ id: "next", type: "SHORT_TEXT", position: 1 }),
        ]),
      );
      const input = view.getByRole("textbox", { name: "notes" });
      typeIntoInput(input, "Hello");
      expect(fireEvent.keyDown(input, { key: "Enter", shiftKey: true })).toBe(
        true,
      );
      expect(
        fireEvent.keyDown(input, { key: "Enter", isComposing: true }),
      ).toBe(true);
      expect(view.getByRole("textbox", { name: "notes" }) !== null).toBe(true);
      expect(view.queryByRole("alert")).toBe(null);
      fireEvent.keyDown(input, { key: "Enter" });
      await waitFor(() =>
        expect(view.queryByRole("textbox", { name: "next" }) !== null).toBe(
          true,
        ),
      );
    } finally {
      await cleanupAndRestore(restoreDom);
    }
  });

  test("Enter keeps focus on the unanswered field instead of cycling between page fields", async () => {
    const restoreDom = installTestDom();
    try {
      const view = renderRunner(
        createForm(
          [
            createBlock({
              id: "team",
              type: "SHORT_TEXT",
              position: 0,
              required: true,
              pageId: "details",
            }),
            createBlock({
              id: "count",
              type: "NUMBER",
              position: 1,
              required: true,
              pageId: "details",
            }),
          ],
          { pages: [{ id: "details" }] },
        ),
      );
      const team = view.getByRole("textbox", { name: "team" });
      const count = view.getByRole("textbox", { name: "count" });
      typeIntoInput(count, "3");
      fireEvent.keyDown(count, { key: "Enter" });
      await waitFor(() =>
        expect(document.activeElement?.getAttribute("aria-labelledby")).toBe(
          "question-team",
        ),
      );
      expect(team.getAttribute("aria-invalid")).toBe("true");
      fireEvent.keyDown(team, { key: "Enter" });
      // Flush the scheduled field-focus callback and initial autofocus retry.
      await new Promise((resolve) => setTimeout(resolve, 350));
      expect(document.activeElement?.getAttribute("aria-labelledby")).toBe(
        "question-team",
      );
      expect(view.getAllByRole("alert").length).toBe(1);
      expect(view.queryByRole("status")).toBe(null);
    } finally {
      await cleanupAndRestore(restoreDom);
    }
  });

  test("Enter advances a valid page from any field and submits the last page", async () => {
    const restoreDom = installTestDom();
    const previousFetch = globalThis.fetch;
    const requests: Array<Record<string, unknown>> = [];

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
      createForm(
        [
          createBlock({
            id: "first",
            type: "SHORT_TEXT",
            position: 0,
            pageId: "page-1",
          }),
          createBlock({
            id: "second",
            type: "SHORT_TEXT",
            position: 1,
            pageId: "page-1",
          }),
          createBlock({
            id: "last",
            type: "SHORT_TEXT",
            position: 2,
            pageId: "page-2",
          }),
        ],
        { pages: [{ id: "page-1" }, { id: "page-2" }] },
      ),
    );

    const [firstField, secondField] = view.getAllByRole(
      "textbox",
    ) as HTMLElement[];

    typeIntoInput(firstField, "Ada");
    typeIntoInput(secondField, "Lovelace");
    fireEvent.keyDown(firstField, { key: "Enter" });

    await waitFor(() => {
      expect(view.getByText("last") !== null).toBe(true);
    });

    const lastField = view.getByRole("textbox");
    typeIntoInput(lastField, "Bye");
    fireEvent.keyDown(lastField, { key: "Enter" });

    await waitFor(() => {
      expect(requests.length).toBe(1);
    });

    const answers = requests[0]?.answers as Record<string, unknown>;
    expect(answers.first).toBe("Ada");
    expect(answers.second).toBe("Lovelace");
    expect(answers.last).toBe("Bye");

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });

  test("progress counts pages of the route", async () => {
    const restoreDom = installTestDom();
    const view = renderRunner(
      createForm(
        [
          createBlock({
            id: "name",
            type: "SHORT_TEXT",
            position: 0,
            pageId: "page-1",
          }),
          createBlock({
            id: "notes",
            type: "SHORT_TEXT",
            position: 1,
            pageId: "page-1",
          }),
          createBlock({
            id: "after",
            type: "SHORT_TEXT",
            position: 2,
            pageId: "page-2",
          }),
        ],
        {
          showProgress: true,
          pages: [{ id: "page-1" }, { id: "page-2" }],
        },
      ),
    );

    expect(view.getByText("Step 1 of 2") !== null).toBe(true);
    expect(view.getByText("50%") !== null).toBe(true);

    typeIntoInput(view.getAllByRole("textbox")[0] as HTMLElement, "Ada");
    typeIntoInput(view.getAllByRole("textbox")[1] as HTMLElement, "Notes");

    fireEvent.click(view.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(view.getByText("Step 2 of 2") !== null).toBe(true);
    });
    expect(view.getByText("100%") !== null).toBe(true);

    await cleanupAndRestore(restoreDom);
  });

  test("a saved draft route of block ids restores onto regrouped pages", async () => {
    const restoreDom = installTestDom();

    const blocks = [
      createBlock({
        id: "name",
        type: "SHORT_TEXT",
        position: 0,
        pageId: "page-1",
      }),
      createBlock({
        id: "notes",
        type: "SHORT_TEXT",
        position: 1,
        pageId: "page-1",
      }),
      createBlock({
        id: "after",
        type: "SHORT_TEXT",
        position: 2,
        pageId: "page-2",
      }),
    ];
    const form = createForm(blocks, {
      showProgress: true,
      pages: [{ id: "page-1" }, { id: "page-2" }],
    });

    // A draft from a session before the regrouping stores block ids: a
    // standalone block's page id equals its block id, and every other block
    // id maps to the page containing it.
    window.localStorage.setItem(
      getPublicFormDraftStorageKey(form.id),
      JSON.stringify(
        createPublicFormDraft(form, {
          answers: { name: "Ada", notes: "Saved" },
          history: ["name", "notes", "after"],
          cursor: 2,
        }),
      ),
    );

    const view = renderRunner(form);

    await waitFor(() => {
      expect(view.getByText("Progress restored") !== null).toBe(true);
    });
    expect(view.getByText("Step 2 of 2") !== null).toBe(true);
    expect((view.getByRole("textbox") as HTMLInputElement).value).toBe("");

    cleanup();

    // A draft saved by this runner stores page ids directly.
    window.localStorage.setItem(
      getPublicFormDraftStorageKey(form.id),
      JSON.stringify(
        createPublicFormDraft(form, {
          answers: { name: "Ada", notes: "Saved" },
          history: ["page-1", "page-2"],
          cursor: 1,
        }),
      ),
    );

    const restoredView = renderRunner(form);

    await waitFor(() => {
      expect(restoredView.getByText("Progress restored") !== null).toBe(true);
    });
    expect(restoredView.getByText("Step 2 of 2") !== null).toBe(true);

    await cleanupAndRestore(restoreDom);
  });

  test("a form of single-block pages advances one block per screen as before", async () => {
    const restoreDom = installTestDom();
    const previousFetch = globalThis.fetch;
    const requests: Array<Record<string, unknown>> = [];

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
          id: "intro",
          type: "TEXT",
          position: 0,
          title: "Welcome",
        }),
        createBlock({
          id: "name",
          type: "SHORT_TEXT",
          position: 1,
        }),
        createBlock({
          id: "notes",
          type: "SHORT_TEXT",
          position: 2,
        }),
      ]),
    );

    expect(view.getByText("Welcome") !== null).toBe(true);
    expect(view.queryAllByRole("textbox").length).toBe(0);

    fireEvent.click(view.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(view.getAllByRole("textbox").length).toBe(1);
    });
    typeIntoInput(view.getByRole("textbox"), "Ada");

    fireEvent.click(view.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(view.getAllByRole("textbox").length).toBe(1);
    });
    expect((view.getByRole("textbox") as HTMLInputElement).value).toBe("");
    typeIntoInput(view.getByRole("textbox"), "Notes");

    fireEvent.click(view.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(requests.length).toBe(1);
    });

    const answers = requests[0]?.answers as Record<string, unknown>;
    expect(answers.name).toBe("Ada");
    expect(answers.notes).toBe("Notes");

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });

  test("unfolds a repeating page by the count and submits the nested answers", async () => {
    const restoreDom = installTestDom();
    const previousFetch = globalThis.fetch;
    const requests: { answers?: Record<string, unknown> }[] = [];

    globalThis.fetch = (async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      requests.push({
        answers: (JSON.parse(String(init?.body)) as { answers: unknown })
          .answers as Record<string, unknown>,
      });

      return {
        ok: true,
        status: 200,
        json: async () => ({ responseId: "r1" }),
      } as Response;
    }) as typeof fetch;

    const form = createForm(
      [
        createBlock({
          id: "count",
          type: "NUMBER",
          position: 0,
          pageId: "count-page",
          title: "How many?",
          required: true,
        }),
        createBlock({
          id: "member",
          type: "SHORT_TEXT",
          position: 1,
          pageId: "members-page",
          title: "Member name",
          required: true,
        }),
        createBlock({
          id: "note",
          type: "LONG_TEXT",
          position: 2,
          pageId: "note-page",
          title: "Notes",
        }),
      ],
      {
        pages: [
          { id: "count-page" },
          { id: "members-page", repeat: { countBlockId: "count" } },
          { id: "note-page" },
        ],
      },
    );

    const view = renderRunner(form);

    typeIntoInput(view.getByRole("textbox"), "2");
    fireEvent.click(view.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(view.getByText("Instance 1 of 2") !== null).toBe(true);
    });
    typeIntoInput(view.getByRole("textbox"), "Ann");
    fireEvent.click(view.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(view.getByText("Instance 2 of 2") !== null).toBe(true);
    });
    typeIntoInput(view.getByRole("textbox"), "Bob");
    fireEvent.click(view.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(view.queryByText(/Instance \d of \d/) === null).toBe(true);
    });
    typeIntoInput(view.getByRole("textbox"), "Thanks");
    fireEvent.click(view.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(requests.length).toBe(1);
    });

    const answers = requests[0]?.answers;
    expect(JSON.stringify(answers?.member)).toBe(
      JSON.stringify(["Ann", "Bob"]),
    );
    expect(answers?.count).toBe("2");
    expect(answers?.note).toBe("Thanks");

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });

  test("a count of zero skips the repeating page", async () => {
    const restoreDom = installTestDom();

    const form = createForm(
      [
        createBlock({
          id: "count",
          type: "NUMBER",
          position: 0,
          pageId: "count-page",
          title: "How many?",
          required: true,
        }),
        createBlock({
          id: "member",
          type: "SHORT_TEXT",
          position: 1,
          pageId: "members-page",
          title: "Member name",
        }),
        createBlock({
          id: "note",
          type: "LONG_TEXT",
          position: 2,
          pageId: "note-page",
          title: "Notes",
        }),
      ],
      {
        pages: [
          { id: "count-page" },
          { id: "members-page", repeat: { countBlockId: "count" } },
          { id: "note-page" },
        ],
      },
    );

    const view = renderRunner(form);

    typeIntoInput(view.getByRole("textbox"), "0");
    fireEvent.click(view.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(view.getByText("Notes") !== null).toBe(true);
    });
    expect(view.queryByText(/Instance \d of \d/) === null).toBe(true);

    await cleanupAndRestore(restoreDom);
  });

  test("keeps the repeating page blocked while the count is unanswered", async () => {
    const restoreDom = installTestDom();

    const form = createForm(
      [
        createBlock({
          id: "count",
          type: "NUMBER",
          position: 0,
          pageId: "count-page",
          title: "How many?",
        }),
        createBlock({
          id: "member",
          type: "SHORT_TEXT",
          position: 1,
          pageId: "members-page",
          title: "Member name",
        }),
      ],
      {
        pages: [
          { id: "count-page" },
          { id: "members-page", repeat: { countBlockId: "count" } },
        ],
      },
    );

    const view = renderRunner(form);

    fireEvent.click(view.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(view.getByText("Answer “How many?” to continue") !== null).toBe(
        true,
      );
    });
    expect(view.getByText("Member name") !== null).toBe(true);

    const forward = view.getByRole("button", {
      name: "Submit",
    }) as HTMLButtonElement;
    expect(forward.disabled).toBe(true);

    await cleanupAndRestore(restoreDom);
  });

  test("a required field of the current instance keeps the step on screen", async () => {
    const restoreDom = installTestDom();
    const previousFetch = globalThis.fetch;
    const requests: unknown[] = [];

    globalThis.fetch = (async () => {
      requests.push({});

      return {
        ok: true,
        status: 200,
        json: async () => ({ responseId: "r1" }),
      } as Response;
    }) as typeof fetch;

    const form = createForm(
      [
        createBlock({
          id: "count",
          type: "NUMBER",
          position: 0,
          pageId: "count-page",
          title: "How many?",
          required: true,
        }),
        createBlock({
          id: "member",
          type: "SHORT_TEXT",
          position: 1,
          pageId: "members-page",
          title: "Member name",
          required: true,
        }),
      ],
      {
        pages: [
          { id: "count-page" },
          { id: "members-page", repeat: { countBlockId: "count" } },
        ],
      },
    );

    const view = renderRunner(form);

    typeIntoInput(view.getByRole("textbox"), "2");
    fireEvent.click(view.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(view.getByText("Instance 1 of 2") !== null).toBe(true);
    });
    typeIntoInput(view.getByRole("textbox"), "Ann");
    fireEvent.click(view.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(view.getByText("Instance 2 of 2") !== null).toBe(true);
    });

    fireEvent.click(view.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(view.getByText("Please answer before continuing.") !== null).toBe(
        true,
      );
    });
    expect(view.getByText("Instance 2 of 2") !== null).toBe(true);
    expect(requests.length).toBe(0);

    expect(view.getByRole("textbox").getAttribute("aria-invalid")).toBe("true");
    expect(view.queryByRole("status")).toBe(null);
    fireEvent.click(view.getByRole("button", { name: /Back/ }));
    await waitFor(() =>
      expect(view.getByText("Instance 1 of 2")).not.toBe(null),
    );
    expect(view.queryByRole("alert")).toBe(null);
    expect((view.getByRole("textbox") as HTMLInputElement).value).toBe("Ann");
    fireEvent.click(view.getByRole("button", { name: "Continue" }));
    await waitFor(() =>
      expect(view.getByText("Instance 2 of 2")).not.toBe(null),
    );
    expect(view.queryByRole("alert")).toBe(null);

    typeIntoInput(view.getByRole("textbox"), "Bob");
    fireEvent.click(view.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(requests.length).toBe(1);
    });

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });
});
