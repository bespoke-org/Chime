import { describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";

import { I18nProvider } from "@/components/i18n-provider";
import { getDefaultBlockConfig } from "@/lib/blocks";
import type { BuilderBlock, BuilderForm } from "@/lib/form-types";
import type { TranslationTree } from "@/lib/i18n";
import { installTestDom } from "@/test/install-dom";

const routerPushCalls: string[] = [];
const router = {
  push: (href: string) => {
    routerPushCalls.push(href);
  },
  refresh: () => {},
};
const { mock } = (await import("bun:test")) as unknown as {
  mock: {
    module: (specifier: string, factory: () => Record<string, unknown>) => void;
  };
};

mock.module("next/navigation", () => ({
  useRouter: () => router,
}));

const { FormBuilder } = await import("@/components/form-builder");

function createBlock(
  overrides: Partial<BuilderBlock> &
    Pick<BuilderBlock, "id" | "type" | "position">,
): BuilderBlock {
  const now = new Date("2026-04-14T12:00:00.000Z");

  return {
    formId: "form-1",
    title: "",
    description: "",
    required: false,
    createdAt: now,
    updatedAt: now,
    config: getDefaultBlockConfig(overrides.type),
    ...overrides,
  } as BuilderBlock;
}

function createForm(blocks: BuilderBlock[]): BuilderForm {
  return {
    id: "form-1",
    title: "Form title",
    description: "",
    completionTitle: "Done",
    completionMessage: "Thanks",
    completionLinkLabel: null,
    completionLinkUrl: null,
    respondentLocale: null,
    showProgress: true,
    allowBackNavigation: true,
    slug: "demo-form",
    status: "DRAFT",
    updatedAt: "2026-04-14T12:00:00.000Z",
    responseCount: 0,
    workspace: {
      kind: "personal",
      label: "Personal workspace",
    },
    blocks,
  };
}

function renderBuilder(
  initialForm: BuilderForm,
  initialMode?: "standard" | "graph",
  messages: TranslationTree = {},
) {
  return render(
    <I18nProvider locale="en" messages={messages}>
      <FormBuilder initialForm={initialForm} initialMode={initialMode} />
    </I18nProvider>,
  );
}

async function cleanupAndRestore(restoreDom: () => void) {
  cleanup();
  await new Promise((resolve) => setTimeout(resolve, 0));
  restoreDom();
}

describe("FormBuilder", () => {
  routerPushCalls.length = 0;

  test("switches blocks immediately when there are no unsaved edits", async () => {
    const restoreDom = installTestDom();
    const firstBlock = createBlock({
      id: "block-1",
      type: "SHORT_TEXT",
      position: 0,
      title: "First question",
    });
    const secondBlock = createBlock({
      id: "block-2",
      type: "SHORT_TEXT",
      position: 1,
      title: "Second question",
    });

    const view = renderBuilder(createForm([firstBlock, secondBlock]));

    fireEvent.click(view.getByRole("button", { name: "Second question" }));

    await waitFor(() => {
      expect(view.getByDisplayValue("Second question") !== null).toBe(true);
    });
    expect(view.queryByText("builder.unsavedBlockChangesTitle")).toBe(null);

    await cleanupAndRestore(restoreDom);
  });

  test("opens form settings immediately when there are no unsaved edits", async () => {
    const restoreDom = installTestDom();
    const firstBlock = createBlock({
      id: "block-1",
      type: "SHORT_TEXT",
      position: 0,
      title: "First question",
    });

    const view = renderBuilder(createForm([firstBlock]));

    fireEvent.click(view.getByRole("button", { name: "builder.settings" }));

    await waitFor(() => {
      expect(view.getByText("builder.settingsTitle") !== null).toBe(true);
    });
    expect(view.queryByText("builder.unsavedBlockChangesTitle")).toBe(null);

    await cleanupAndRestore(restoreDom);
  });

  test("saves a restored respondent locale override from form settings", async () => {
    const restoreDom = installTestDom();
    const firstBlock = createBlock({
      id: "block-1",
      type: "SHORT_TEXT",
      position: 0,
      title: "First question",
    });
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    const previousFetch = globalThis.fetch;

    globalThis.fetch = (async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      fetchCalls.push({ url: String(url), init });

      return {
        ok: true,
        json: async () => ({
          form: {
            ...createForm([firstBlock]),
            respondentLocale: "ru",
            allowBackNavigation: true,
          },
        }),
      } as Response;
    }) as typeof fetch;

    const view = renderBuilder(
      {
        ...createForm([firstBlock]),
        respondentLocale: "ru",
      },
      undefined,
      {
        builder: { saveFormSettings: "Save form settings" },
      },
    );

    fireEvent.click(view.getByRole("button", { name: "builder.settings" }));

    await waitFor(() => {
      expect(view.getByText("builder.settingsTitle") !== null).toBe(true);
    });

    fireEvent.click(view.getByRole("button", { name: "Save form settings" }));

    await waitFor(() => {
      expect(fetchCalls.length).toBe(1);
    });

    expect(fetchCalls[0]?.url).toBe("/api/forms/form-1");
    expect(fetchCalls[0]?.init?.method).toBe("PATCH");
    expect(String(fetchCalls[0]?.init?.body)).toContain(
      '"respondentLocale":"ru"',
    );

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });

  test("saves visitor-language mode from form settings", async () => {
    const restoreDom = installTestDom();
    const firstBlock = createBlock({
      id: "block-1",
      type: "SHORT_TEXT",
      position: 0,
      title: "First question",
    });
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    const previousFetch = globalThis.fetch;

    globalThis.fetch = (async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      fetchCalls.push({ url: String(url), init });

      return {
        ok: true,
        json: async () => ({
          form: createForm([firstBlock]),
        }),
      } as Response;
    }) as typeof fetch;

    const view = renderBuilder(createForm([firstBlock]), undefined, {
      builder: { saveFormSettings: "Save form settings" },
    });

    fireEvent.click(view.getByRole("button", { name: "builder.settings" }));

    await waitFor(() => {
      expect(view.getByText("builder.settingsTitle") !== null).toBe(true);
    });

    fireEvent.click(view.getByRole("button", { name: "Save form settings" }));

    await waitFor(() => {
      expect(fetchCalls.length).toBe(1);
    });

    expect(String(fetchCalls[0]?.init?.body)).toContain(
      '"respondentLocale":null',
    );
    expect(String(fetchCalls[0]?.init?.body)).toContain(
      '"allowBackNavigation":true',
    );

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });

  test("saves allowBackNavigation as enabled by default from form settings", async () => {
    const restoreDom = installTestDom();
    const firstBlock = createBlock({
      id: "block-1",
      type: "SHORT_TEXT",
      position: 0,
      title: "First question",
    });
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    const previousFetch = globalThis.fetch;

    globalThis.fetch = (async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      fetchCalls.push({ url: String(url), init });

      return {
        ok: true,
        json: async () => ({
          form: createForm([firstBlock]),
        }),
      } as Response;
    }) as typeof fetch;

    const view = renderBuilder(createForm([firstBlock]), undefined, {
      builder: { saveFormSettings: "Save form settings" },
    });

    fireEvent.click(view.getByRole("button", { name: "builder.settings" }));

    await waitFor(() => {
      expect(view.getByText("builder.settingsTitle") !== null).toBe(true);
    });

    fireEvent.click(view.getByRole("button", { name: "Save form settings" }));

    await waitFor(() => {
      expect(fetchCalls.length).toBe(1);
    });

    expect(String(fetchCalls[0]?.init?.body)).toContain(
      '"allowBackNavigation":true',
    );

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });

  test("saves a disabled allowBackNavigation value from form settings", async () => {
    const restoreDom = installTestDom();
    const firstBlock = createBlock({
      id: "block-1",
      type: "SHORT_TEXT",
      position: 0,
      title: "First question",
    });
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    const previousFetch = globalThis.fetch;

    globalThis.fetch = (async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      fetchCalls.push({ url: String(url), init });

      return {
        ok: true,
        json: async () => ({
          form: {
            ...createForm([firstBlock]),
            allowBackNavigation: false,
          },
        }),
      } as Response;
    }) as typeof fetch;

    const view = renderBuilder(createForm([firstBlock]), undefined, {
      builder: {
        saveFormSettings: "Save form settings",
        allowBackNavigation: "Allow going back",
      },
    });

    fireEvent.click(view.getByRole("button", { name: "builder.settings" }));

    await waitFor(() => {
      expect(view.getByText("builder.settingsTitle") !== null).toBe(true);
    });

    fireEvent.click(view.getAllByRole("checkbox")[1] as HTMLInputElement);
    fireEvent.click(view.getByRole("button", { name: "Save form settings" }));

    await waitFor(() => {
      expect(fetchCalls.length).toBe(1);
    });

    expect(String(fetchCalls[0]?.init?.body)).toContain(
      '"allowBackNavigation":false',
    );

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });

  test("reopens form settings with a saved disabled allowBackNavigation value", async () => {
    const restoreDom = installTestDom();
    const firstBlock = createBlock({
      id: "block-1",
      type: "SHORT_TEXT",
      position: 0,
      title: "First question",
    });

    const view = renderBuilder(
      {
        ...createForm([firstBlock]),
        allowBackNavigation: false,
      },
      undefined,
      {
        builder: {
          allowBackNavigation: "Allow going back",
        },
      },
    );

    fireEvent.click(view.getByRole("button", { name: "builder.settings" }));

    await waitFor(() => {
      expect(view.getByText("builder.settingsTitle") !== null).toBe(true);
    });

    expect((view.getAllByRole("checkbox")[1] as HTMLInputElement).checked).toBe(
      false,
    );

    await cleanupAndRestore(restoreDom);
  });

  test("lets the creator cancel or discard unsaved changes before opening form settings", async () => {
    const restoreDom = installTestDom();
    const firstBlock = createBlock({
      id: "block-1",
      type: "SHORT_TEXT",
      position: 0,
      title: "First question",
    });

    const view = renderBuilder(createForm([firstBlock]));
    const requiredToggle = view.getAllByRole("checkbox")[0] as HTMLInputElement;
    fireEvent.click(requiredToggle);

    await waitFor(() => {
      expect(requiredToggle.checked).toBe(true);
    });

    fireEvent.click(view.getByRole("button", { name: "builder.settings" }));

    await waitFor(() => {
      expect(view.getByText("builder.unsavedBlockChangesTitle") !== null).toBe(
        true,
      );
    });

    fireEvent.click(
      view.getByRole("button", { name: "builder.backFromUnsavedBlockChanges" }),
    );

    await waitFor(() => {
      expect(view.queryByText("builder.unsavedBlockChangesTitle")).toBe(null);
    });
    expect(requiredToggle.checked).toBe(true);

    fireEvent.click(view.getByRole("button", { name: "builder.settings" }));

    await waitFor(() => {
      expect(view.getByText("builder.unsavedBlockChangesTitle") !== null).toBe(
        true,
      );
    });

    fireEvent.click(
      view.getByRole("button", { name: "builder.cancelBlockChanges" }),
    );

    await waitFor(() => {
      expect(view.getByText("builder.settingsTitle") !== null).toBe(true);
    });

    await cleanupAndRestore(restoreDom);
  });

  test("saves the active block before switching when the creator chooses save changes", async () => {
    const restoreDom = installTestDom();
    const firstBlock = createBlock({
      id: "block-1",
      type: "SHORT_TEXT",
      position: 0,
      title: "First question",
    });
    const secondBlock = createBlock({
      id: "block-2",
      type: "SHORT_TEXT",
      position: 1,
      title: "Second question",
    });
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    const previousFetch = globalThis.fetch;

    globalThis.fetch = (async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      fetchCalls.push({ url: String(url), init });

      return {
        ok: true,
        json: async () => ({
          block: {
            ...firstBlock,
            required: true,
          },
        }),
      } as Response;
    }) as typeof fetch;

    const view = renderBuilder(createForm([firstBlock, secondBlock]));
    const requiredToggle = view.getAllByRole("checkbox")[0] as HTMLInputElement;
    fireEvent.click(requiredToggle);

    await waitFor(() => {
      expect(requiredToggle.checked).toBe(true);
    });

    fireEvent.click(view.getByRole("button", { name: "Second question" }));

    await waitFor(() => {
      expect(view.getByText("builder.unsavedBlockChangesTitle") !== null).toBe(
        true,
      );
    });

    fireEvent.click(
      view.getByRole("button", { name: "builder.saveBlockChanges" }),
    );

    await waitFor(() => {
      expect(fetchCalls.length).toBe(1);
      expect(view.getByDisplayValue("Second question") !== null).toBe(true);
    });

    expect(fetchCalls[0]?.url).toBe("/api/forms/form-1/blocks/block-1");
    expect(fetchCalls[0]?.init?.method).toBe("PATCH");
    expect(fetchCalls[0]?.init?.body).toContain('"required":true');

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });

  test("keeps the unsaved-changes dialog open when saving fails", async () => {
    const restoreDom = installTestDom();
    const firstBlock = createBlock({
      id: "block-1",
      type: "SHORT_TEXT",
      position: 0,
      title: "First question",
    });
    const secondBlock = createBlock({
      id: "block-2",
      type: "SHORT_TEXT",
      position: 1,
      title: "Second question",
    });
    const previousFetch = globalThis.fetch;

    globalThis.fetch = (async () =>
      ({
        ok: false,
        json: async () => ({ error: "Could not save block." }),
      }) as Response) as typeof fetch;

    const view = renderBuilder(createForm([firstBlock, secondBlock]));
    const requiredToggle = view.getAllByRole("checkbox")[0] as HTMLInputElement;
    fireEvent.click(requiredToggle);

    await waitFor(() => {
      expect(requiredToggle.checked).toBe(true);
    });

    fireEvent.click(view.getByRole("button", { name: "Second question" }));

    await waitFor(() => {
      expect(view.getByText("builder.unsavedBlockChangesTitle") !== null).toBe(
        true,
      );
    });

    fireEvent.click(
      view.getByRole("button", { name: "builder.saveBlockChanges" }),
    );

    await waitFor(() => {
      expect(view.getByText("builder.unsavedBlockChangesTitle") !== null).toBe(
        true,
      );
      expect(view.getByText("Could not save block.") !== null).toBe(true);
    });
    expect(view.queryByDisplayValue("Second question")).toBe(null);

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });

  test("opens graph mode and hides the standard builder sidebar", async () => {
    routerPushCalls.length = 0;
    const restoreDom = installTestDom();
    const firstBlock = createBlock({
      id: "block-1",
      type: "SHORT_TEXT",
      position: 0,
      title: "First question",
    });

    const view = renderBuilder(createForm([firstBlock]));

    fireEvent.click(
      view.getByRole("button", { name: "builder.openGraphMode" }),
    );

    await waitFor(() => {
      expect(view.getByText("Form title") !== null).toBe(true);
      expect(
        view.getByRole("button", { name: "builder.exitGraphMode" }) !== null,
      ).toBe(true);
    });
    expect(view.queryByText("builder.blocks")).toBe(null);
    expect(routerPushCalls.at(-1)).toBe("/forms/form-1/graph");

    await cleanupAndRestore(restoreDom);
  });

  test("renders graph mode directly when mounted on the graph route", async () => {
    const restoreDom = installTestDom();
    const firstBlock = createBlock({
      id: "block-1",
      type: "SHORT_TEXT",
      position: 0,
      title: "First question",
    });

    const view = renderBuilder(createForm([firstBlock]), "graph");

    await waitFor(() => {
      expect(
        view.getByRole("button", { name: "builder.exitGraphMode" }) !== null,
      ).toBe(true);
    });
    expect(view.queryByText("builder.blocks")).toBe(null);

    await cleanupAndRestore(restoreDom);
  });

  test("returns to the standard builder layout when graph mode closes", async () => {
    routerPushCalls.length = 0;
    const restoreDom = installTestDom();
    const firstBlock = createBlock({
      id: "block-1",
      type: "SHORT_TEXT",
      position: 0,
      title: "First question",
    });

    const view = renderBuilder(createForm([firstBlock]));

    fireEvent.click(
      view.getByRole("button", { name: "builder.openGraphMode" }),
    );

    await waitFor(() => {
      expect(
        view.getByRole("button", { name: "builder.exitGraphMode" }) !== null,
      ).toBe(true);
    });

    fireEvent.click(
      view.getByRole("button", { name: "builder.exitGraphMode" }),
    );

    await waitFor(() => {
      expect(view.getByText("builder.blocks") !== null).toBe(true);
    });
    expect(routerPushCalls.at(-1)).toBe("/forms/form-1/edit");

    await cleanupAndRestore(restoreDom);
  });

  test("restores a persisted graph layout on first mount", async () => {
    const restoreDom = installTestDom();
    const firstBlock = createBlock({
      id: "block-1",
      type: "SHORT_TEXT",
      position: 0,
      title: "First question",
    });
    const secondBlock = createBlock({
      id: "block-2",
      type: "SHORT_TEXT",
      position: 1,
      title: "Second question",
    });

    window.localStorage.setItem(
      "lively-forms:branching-graph-layout:form-1",
      JSON.stringify({ "block-1": { x: 164, y: 132 } }),
    );

    const view = renderBuilder(createForm([firstBlock, secondBlock]));

    fireEvent.click(
      view.getByRole("button", { name: "builder.openGraphMode" }),
    );

    const restoredGraphNode = await view.findByRole("button", {
      name: "blocks.types.SHORT_TEXT First question",
    });

    await waitFor(() => {
      expect(restoredGraphNode.style.left).toBe("164px");
      expect(restoredGraphNode.style.top).toBe("132px");
    });

    await cleanupAndRestore(restoreDom);
  });

  test("persists dragged graph node positions across remounts", async () => {
    const restoreDom = installTestDom();
    const firstBlock = createBlock({
      id: "block-1",
      type: "SHORT_TEXT",
      position: 0,
      title: "First question",
    });
    const secondBlock = createBlock({
      id: "block-2",
      type: "SHORT_TEXT",
      position: 1,
      title: "Second question",
    });

    const initialForm = createForm([firstBlock, secondBlock]);
    const firstView = renderBuilder(initialForm);

    fireEvent.click(
      firstView.getByRole("button", { name: "builder.openGraphMode" }),
    );

    const graphNode = await firstView.findByRole("button", {
      name: "blocks.types.SHORT_TEXT First question",
    });

    expect(graphNode.style.left).toBe("48px");
    expect(graphNode.style.top).toBe("48px");

    fireEvent.pointerDown(graphNode, {
      button: 0,
      pointerId: 1,
      clientX: 120,
      clientY: 120,
    });
    fireEvent.pointerMove(graphNode, {
      pointerId: 1,
      clientX: 200,
      clientY: 180,
    });
    fireEvent.pointerUp(graphNode, {
      pointerId: 1,
      clientX: 200,
      clientY: 180,
    });

    await waitFor(() => {
      expect(graphNode.style.left).toBe("128px");
      expect(graphNode.style.top).toBe("108px");
    });

    expect(
      window.localStorage.getItem("lively-forms:branching-graph-layout:form-1"),
    ).toContain('"block-1":{"x":128,"y":108}');

    cleanup();

    const secondView = renderBuilder(initialForm);

    fireEvent.click(
      secondView.getByRole("button", { name: "builder.openGraphMode" }),
    );

    const restoredGraphNode = await secondView.findByRole("button", {
      name: "blocks.types.SHORT_TEXT First question",
    });

    await waitFor(() => {
      expect(restoredGraphNode.style.left).toBe("128px");
      expect(restoredGraphNode.style.top).toBe("108px");
    });

    await cleanupAndRestore(restoreDom);
  });

  test("saves branch edits from graph mode through the existing block save flow", async () => {
    const restoreDom = installTestDom();
    const sourceBlock = createBlock({
      id: "block-1",
      type: "SINGLE_CHOICE",
      position: 0,
      title: "Choose one",
      config: {
        ...getDefaultBlockConfig("SINGLE_CHOICE"),
        options: ["Yes", "No"],
      },
    });
    const targetBlock = createBlock({
      id: "block-2",
      type: "SHORT_TEXT",
      position: 1,
      title: "Follow-up",
    });
    const previousFetch = globalThis.fetch;
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];

    globalThis.fetch = (async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      fetchCalls.push({ url: String(url), init });

      return {
        ok: true,
        json: async () => ({
          block: {
            ...sourceBlock,
            config: {
              ...sourceBlock.config,
              branchRules: [
                {
                  operator: "equals",
                  value: "Yes",
                  targetBlockId: "block-2",
                },
              ],
            },
          },
        }),
      } as Response;
    }) as typeof fetch;

    const view = renderBuilder(createForm([sourceBlock, targetBlock]));

    fireEvent.click(
      view.getByRole("button", { name: "builder.openGraphMode" }),
    );

    await waitFor(() => {
      expect(
        view.getByRole("button", { name: "builder.exitGraphMode" }) !== null,
      ).toBe(true);
    });

    fireEvent.click(
      view.getByRole("button", {
        name: "blocks.types.SINGLE_CHOICE Choose one",
      }),
    );

    await waitFor(() => {
      expect(
        view.getByRole("button", { name: "builder.addBranchRule" }) !== null,
      ).toBe(true);
    });

    fireEvent.click(
      view.getByRole("button", { name: "builder.addBranchRule" }),
    );
    fireEvent.click(view.getByRole("button", { name: "builder.saveBlock" }));

    await waitFor(() => {
      expect(fetchCalls.length).toBe(1);
    });

    expect(fetchCalls[0]?.url).toBe("/api/forms/form-1/blocks/block-1");
    expect(fetchCalls[0]?.init?.method).toBe("PATCH");
    expect(fetchCalls[0]?.init?.body).toContain('"targetBlockId":"block-2"');
    expect(fetchCalls[0]?.init?.body).toContain('"operator":"equals"');

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });
});
