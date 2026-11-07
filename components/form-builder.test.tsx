import { describe, expect, test } from "bun:test";
import * as React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";

import { I18nProvider } from "@/components/i18n-provider";
import {
  buildPageSections,
  countBlockCandidates,
  deletePageById,
  movePageToAnchor,
  insertionForGap,
  pageIdAfterDrop,
  pageIdForNewBlock,
  splitPageAfter,
} from "@/components/builder/block-creation";
import { getDefaultBlockConfig } from "@/lib/blocks";
import type { BuilderBlock, BuilderForm } from "@/lib/form-types";
import type { TranslationTree } from "@/lib/i18n";
import type { PageDefinition } from "@/lib/pages";
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
  usePathname: () => window.location.pathname,
}));

// Radix portals do not mount in the test DOM, so the popover here is an
// inline stand-in: the trigger toggles, the content renders in place when
// open. Tests then reach menu items the way a user does.
mock.module("@/components/ui/popover", () => {
  const context = React.createContext<{
    isOpen: boolean;
    toggle: () => void;
  } | null>(null);

  function Popover({
    open,
    onOpenChange,
    children,
  }: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children?: React.ReactNode;
  }) {
    const [uncontrolled, setUncontrolled] = React.useState(false);
    const isOpen = open ?? uncontrolled;

    return (
      <context.Provider
        value={{
          isOpen,
          toggle: () => {
            onOpenChange?.(!isOpen);
            if (open === undefined) {
              setUncontrolled(!isOpen);
            }
          },
        }}
      >
        {children}
      </context.Provider>
    );
  }

  function PopoverTrigger({
    children,
  }: {
    asChild?: boolean;
    children?: React.ReactNode;
  }) {
    const popover = React.useContext(context);

    if (!popover || !React.isValidElement(children)) {
      return null;
    }

    const child = children as React.ReactElement<{
      onClick?: (event: unknown) => void;
    }>;

    return React.cloneElement(child, {
      onClick: (event: unknown) => {
        child.props.onClick?.(event);
        popover.toggle();
      },
    });
  }

  function PopoverContent({
    children,
    ...props
  }: {
    children?: React.ReactNode;
  }) {
    const popover = React.useContext(context);

    return popover?.isOpen ? <div {...props}>{children}</div> : null;
  }

  return { Popover, PopoverTrigger, PopoverContent };
});

const dndCore = await import("@dnd-kit/core");
const RealDndContext = dndCore.DndContext;
type DragEndHandler = NonNullable<
  React.ComponentProps<typeof RealDndContext>["onDragEnd"]
>;
const builderDragHandlers = new Map<string, DragEndHandler>();

// Keep the real DnD provider and sortable tree while exposing completion
// callbacks: jsdom has no layout for pointer collision detection.
mock.module("@dnd-kit/core", () => ({
  ...dndCore,
  DndContext: (props: React.ComponentProps<typeof RealDndContext>) => {
    if (
      props.onDragEnd &&
      React.isValidElement<{ items?: string[] }>(props.children)
    ) {
      for (const id of props.children.props.items ?? []) {
        builderDragHandlers.set(id, props.onDragEnd);
      }
    }
    return <RealDndContext {...props} />;
  },
}));

async function dropBuilderItem(activeId: string, overId: string) {
  const onDragEnd = builderDragHandlers.get(activeId);
  if (!onDragEnd) throw new Error(`No sortable item ${activeId}`);
  await React.act(async () => {
    void onDragEnd({
      active: { id: activeId },
      over: { id: overId },
    } as Parameters<DragEndHandler>[0]);
  });
}

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
    pageId: null,
    ...overrides,
  } as BuilderBlock;
}

function createForm(
  blocks: BuilderBlock[],
  pages?: PageDefinition[],
): BuilderForm {
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
    webhooks: [],
    organizationWebhooks: [],
    digestTimezone: "Europe/Saratov",
    closesAt: null,
    maxResponses: null,
    closedManually: false,
    closedMessage: "",
    notificationsEnabled: false,
    viewerHasNotificationEmail: false,
    slug: "demo-form",
    status: "DRAFT",
    updatedAt: "2026-04-14T12:00:00.000Z",
    responseCount: 0,
    workspace: {
      kind: "personal",
      label: "Personal workspace",
    },
    blocks,
    pages: pages ?? [],
  };
}

function renderBuilder(
  initialForm: BuilderForm,
  initialMode?: "standard" | "graph",
  messages: TranslationTree = {},
) {
  builderDragHandlers.clear();
  return render(
    <I18nProvider locale="en" messages={messages}>
      <FormBuilder initialForm={initialForm} initialMode={initialMode} />
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

  for (const scenario of [
    { label: "the edited question moves", active: "first", over: "second" },
    { label: "another question moves", active: "second", over: "third" },
    {
      label: "the edited question changes pages",
      active: "first",
      over: "third",
    },
    { label: "the page moves", active: "page:page-1", over: "page:page-2" },
  ]) {
    test(`keeps pending edits when ${scenario.label}`, async () => {
      const restoreDom = installTestDom();
      const previousFetch = globalThis.fetch;
      const blocks = [
        createBlock({
          id: "first",
          type: "SHORT_TEXT",
          position: 0,
          title: "First question",
          description: "Original support text",
          pageId: "page-1",
          config: {
            ...getDefaultBlockConfig("SHORT_TEXT"),
            branchRules: [
              {
                operator: "contains",
                value: "original-rule",
                targetBlockId: "third",
              },
            ],
          },
        }),
        createBlock({
          id: "second",
          type: "SHORT_TEXT",
          position: 1,
          title: "Second question",
          pageId: "page-1",
        }),
        createBlock({
          id: "third",
          type: "SHORT_TEXT",
          position: 2,
          title: "Third question",
          pageId: "page-2",
        }),
      ];
      const pages = [{ id: "page-1" }, { id: "page-2" }];
      let finishReorder!: (response: Response) => void;
      const reorderResponse = new Promise<Response>((resolve) => {
        finishReorder = resolve;
      });
      const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
      globalThis.fetch = (async (
        url: string | URL | Request,
        init?: RequestInit,
      ) => {
        calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
        return String(url).endsWith("/reorder")
          ? reorderResponse
          : ({ ok: true, json: async () => ({}) } as Response);
      }) as typeof fetch;
      try {
        const view = renderBuilder(createForm(blocks, pages));
        typeIntoInput(
          view.getByDisplayValue("First question"),
          "Edited question",
        );
        typeIntoInput(
          view.getByDisplayValue("Original support text"),
          "Edited support text",
        );
        typeIntoInput(view.getByDisplayValue("original-rule"), "edited-rule");
        fireEvent.click(
          view.getByRole("checkbox", { name: "builder.requiredToggle" }),
        );
        await dropBuilderItem(scenario.active, scenario.over);
        const expectDraft = () => {
          expect(
            (view.getByDisplayValue("Edited question") as HTMLInputElement)
              .value,
          ).toBe("Edited question");
          expect(
            (
              view.getByDisplayValue(
                "Edited support text",
              ) as HTMLTextAreaElement
            ).value,
          ).toBe("Edited support text");
          expect(
            (view.getByDisplayValue("edited-rule") as HTMLInputElement).value,
          ).toBe("edited-rule");
          expect(
            (
              view.getByRole("checkbox", {
                name: "builder.requiredToggle",
              }) as HTMLInputElement
            ).checked,
          ).toBe(true);
        };
        expectDraft();
        await React.act(async () =>
          finishReorder({
            ok: true,
            json: async () => ({
              form: createForm(
                [
                  { ...blocks[2], position: 0 },
                  { ...blocks[1], position: 1 },
                  { ...blocks[0], position: 2 },
                ],
                pages,
              ),
            }),
          } as Response),
        );
        await waitFor(() =>
          expect(
            view.queryByText(
              scenario.active.startsWith("page:")
                ? "builder.toasts.updatedPageOrder"
                : "builder.toasts.updatedBlockOrder",
            ) !== null,
          ).toBe(true),
        );
        expectDraft();
        // Reordering is structural: pending editor content still requires Save.
        expect(
          calls
            .filter((call) => !call.url.endsWith("/reorder"))
            .every(
              (call) =>
                call.body.title ===
                blocks.find((block) => block.id === scenario.active)?.title,
            ),
        ).toBe(true);
        fireEvent.click(view.getByRole("button", { name: "builder.settings" }));
        expect(
          view.queryByText("builder.unsavedBlockChangesTitle") !== null,
        ).toBe(true);
      } finally {
        globalThis.fetch = previousFetch;
        await cleanupAndRestore(restoreDom);
      }
    });
  }

  test("saves newer content only after a cross-page drop finishes", async () => {
    const restoreDom = installTestDom();
    const previousFetch = globalThis.fetch;
    const first = createBlock({
      id: "first",
      type: "SHORT_TEXT",
      position: 0,
      title: "First question",
      pageId: "page-1",
    });
    const second = createBlock({
      id: "second",
      type: "SHORT_TEXT",
      position: 1,
      title: "Second question",
      pageId: "page-2",
    });
    const pages = [{ id: "page-1" }, { id: "page-2" }];
    let finishMove!: (response: Response) => void;
    let finishReorder!: (response: Response) => void;
    const moveResponse = new Promise<Response>((resolve) => {
      finishMove = resolve;
    });
    const reorderResponse = new Promise<Response>((resolve) => {
      finishReorder = resolve;
    });
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    globalThis.fetch = (async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      const body = JSON.parse(String(init?.body));
      calls.push({ url: String(url), body });
      if (String(url).endsWith("/reorder")) return reorderResponse;
      if (body.pageId) return moveResponse;
      return {
        ok: true,
        json: async () => ({
          block: { ...first, title: body.title, pageId: "page-2", position: 1 },
        }),
      } as Response;
    }) as typeof fetch;
    try {
      const view = renderBuilder(createForm([first, second], pages));
      typeIntoInput(
        view.getByDisplayValue("First question"),
        "Edited question",
      );
      await dropBuilderItem("first", "second");
      fireEvent.click(view.getByRole("button", { name: "builder.saveBlock" }));
      await dropBuilderItem("first", "second");
      expect(calls.length).toBe(1);
      expect(calls[0].body.title).toBe("First question");
      await React.act(async () =>
        finishMove({ ok: true, json: async () => ({}) } as Response),
      );
      await waitFor(() => expect(calls.length).toBe(2));
      expect(calls[1].url).toBe("/api/forms/form-1/blocks/reorder");
      await React.act(async () =>
        finishReorder({
          ok: true,
          json: async () => ({
            form: createForm(
              [
                { ...second, position: 0 },
                { ...first, position: 1, pageId: "page-2" },
              ],
              pages,
            ),
          }),
        } as Response),
      );
      await waitFor(() => expect(calls.length).toBe(3));
      expect(calls[2].body.title).toBe("Edited question");
      expect(calls[2].body.pageId).toBe(undefined);
      expect(
        (view.getByDisplayValue("Edited question") as HTMLInputElement).value,
      ).toBe("Edited question");
      fireEvent.click(view.getByRole("button", { name: "builder.settings" }));
      await waitFor(() =>
        expect(view.queryByText("builder.settingsTitle") !== null).toBe(true),
      );
      expect(view.queryByText("builder.unsavedBlockChangesTitle")).toBe(null);
    } finally {
      globalThis.fetch = previousFetch;
      await cleanupAndRestore(restoreDom);
    }
  });

  test("keeps edited choice options after a failed reorder and saves them on retry", async () => {
    const restoreDom = installTestDom();
    const previousFetch = globalThis.fetch;
    const first = createBlock({
      id: "first",
      type: "SINGLE_CHOICE",
      position: 0,
      title: "Choice",
      config: {
        ...getDefaultBlockConfig("SINGLE_CHOICE"),
        options: ["Yes", "No"],
      },
    });
    const second = createBlock({
      id: "second",
      type: "SHORT_TEXT",
      position: 1,
      title: "Second question",
    });
    const saves: Array<Record<string, unknown>> = [];
    globalThis.fetch = (async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      if (String(url).endsWith("/reorder"))
        return {
          ok: false,
          json: async () => ({ error: "Reorder failed" }),
        } as Response;
      const body = JSON.parse(String(init?.body));
      saves.push(body);
      return {
        ok: true,
        json: async () => ({ block: { ...first, config: body.config } }),
      } as Response;
    }) as typeof fetch;
    try {
      const view = renderBuilder(createForm([first, second]));
      typeIntoInput(view.getByDisplayValue("Yes"), "Maybe");
      await dropBuilderItem("first", "second");
      await waitFor(() =>
        expect(view.queryByText("Reorder failed") !== null).toBe(true),
      );
      expect((view.getByDisplayValue("Maybe") as HTMLInputElement).value).toBe(
        "Maybe",
      );
      fireEvent.click(view.getByRole("button", { name: "builder.saveBlock" }));
      await waitFor(() => expect(saves.length).toBe(1));
      expect((saves[0].config as { options: string[] }).options).toEqual([
        "Maybe",
        "No",
      ]);
      expect((view.getByDisplayValue("Maybe") as HTMLInputElement).value).toBe(
        "Maybe",
      );
    } finally {
      globalThis.fetch = previousFetch;
      await cleanupAndRestore(restoreDom);
    }
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

  test("offers the public link only once the form is published", async () => {
    const restoreDom = installTestDom();
    const firstBlock = createBlock({
      id: "block-1",
      type: "SHORT_TEXT",
      position: 0,
      title: "First question",
    });

    const draftView = renderBuilder(createForm([firstBlock]));

    expect(draftView.queryByText("builder.publicationMenu")).toBe(null);
    expect(draftView.getByText("builder.publish") !== null).toBe(true);
    expect(
      (
        draftView
          .getByText("builder.responses")
          .closest("button") as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    fireEvent.click(
      draftView.getByRole("button", { name: "builder.settings" }),
    );

    await waitFor(() => {
      expect(draftView.getByText("builder.shareDraftHint") !== null).toBe(true);
    });
    expect(draftView.queryByText("builder.openRunner")).toBe(null);
    expect(draftView.queryByText("builder.copyLink")).toBe(null);

    cleanup();

    const publishedView = renderBuilder({
      ...createForm([firstBlock]),
      status: "PUBLISHED",
    });

    expect(publishedView.getByText("builder.publicationMenu") !== null).toBe(
      true,
    );
    expect(publishedView.queryByText("builder.publish")).toBe(null);
    expect(
      (
        publishedView
          .getByText("builder.responses")
          .closest("button") as HTMLButtonElement
      ).disabled,
    ).toBe(false);

    fireEvent.click(
      publishedView.getByRole("button", { name: "builder.settings" }),
    );

    await waitFor(() => {
      expect(publishedView.getByText("builder.openRunner") !== null).toBe(true);
    });
    expect(publishedView.queryByText("builder.shareDraftHint")).toBe(null);

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

  test("adds a digest webhook through its own endpoint and lists it", async () => {
    const restoreDom = installTestDom();
    const firstBlock = createBlock({
      id: "block-1",
      type: "SHORT_TEXT",
      position: 0,
      title: "First question",
    });
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    const previousFetch = globalThis.fetch;
    const savedWebhook = {
      id: "wh-1",
      url: "https://hooks.example.com/chime",
      secret: null,
      enabled: true,
      mode: "DIGEST" as const,
      digestInterval: "DAILY" as const,
      digestTime: "09:00",
      digestWeekday: null,
      lastDigestAt: null,
      createdAt: "2026-10-19T10:00:00.000Z",
    };

    globalThis.fetch = (async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      if (String(url).endsWith("/reusable")) {
        return { ok: true, json: async () => ({ webhooks: [] }) } as Response;
      }

      fetchCalls.push({ url: String(url), init });

      return {
        ok: true,
        json: async () => ({ webhooks: [savedWebhook] }),
      } as Response;
    }) as typeof fetch;

    const view = renderBuilder(createForm([firstBlock]), undefined, {
      builder: {
        saveWebhook: "Save webhook",
        webhookModeDigest: "Send a digest",
        webhookScheduleDaily: "Daily at {time}",
      },
    });

    fireEvent.click(view.getByRole("button", { name: "builder.settings" }));

    await waitFor(() => {
      expect(view.getByText("builder.settingsTitle") !== null).toBe(true);
    });
    expect(view.queryByText("builder.webhookUrl")).toBe(null);

    fireEvent.click(view.getByRole("button", { name: "builder.addWebhook" }));

    const urlInput = await view.findByPlaceholderText(
      "builder.webhookUrlPlaceholder",
    );
    const saveSettings = view.getByRole("button", {
      name: "builder.saveFormSettings",
    }) as HTMLButtonElement;
    // The open webhook editor has its own Save.
    expect(saveSettings.disabled).toBe(true);
    typeIntoInput(urlInput, "https://hooks.example.com/chime");
    fireEvent.click(view.getByRole("radio", { name: /Send a digest/ }));

    // The interval select is rendered once digest mode is chosen; the time
    // input shows the zone the schedule is read in.
    expect(view.getByLabelText("builder.webhookInterval") !== null).toBe(true);
    expect(view.getByText("builder.webhookTimeHelp") !== null).toBe(true);

    fireEvent.click(view.getByRole("button", { name: "Save webhook" }));

    await waitFor(() => {
      expect(fetchCalls.length).toBe(1);
    });

    expect(fetchCalls[0]?.url).toBe("/api/forms/form-1/webhooks");
    expect(fetchCalls[0]?.init?.method).toBe("POST");
    expect(String(fetchCalls[0]?.init?.body)).toBe(
      JSON.stringify({
        url: "https://hooks.example.com/chime",
        secret: null,
        enabled: true,
        mode: "DIGEST",
        digestInterval: "DAILY",
        digestTime: "09:00",
        digestWeekday: null,
      }),
    );

    await waitFor(() => {
      expect(view.getByText("https://hooks.example.com/chime") !== null).toBe(
        true,
      );
    });
    expect(view.getByText("Daily at 09:00") !== null).toBe(true);
    expect(view.queryByRole("button", { name: "Save webhook" })).toBe(null);
    expect(saveSettings.disabled).toBe(false);

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });

  test("copies a webhook of another form into a new one", async () => {
    const restoreDom = installTestDom();
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    const previousFetch = globalThis.fetch;
    const reusable = {
      url: "https://pechkin.example.com/hook",
      secret: "s3cret",
      mode: "DIGEST" as const,
      digestInterval: "WEEKLY" as const,
      digestTime: "18:00",
      digestWeekday: 5,
      formTitle: "Хакатон",
    };

    globalThis.fetch = (async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      fetchCalls.push({ url: String(url), init });

      return {
        ok: true,
        json: async () => ({
          webhooks: String(url).endsWith("/reusable") ? [reusable] : [],
        }),
      } as Response;
    }) as typeof fetch;

    const view = renderBuilder(createForm([]), undefined, {
      builder: { saveWebhook: "Save webhook" },
    });

    fireEvent.click(view.getByRole("button", { name: "builder.settings" }));
    await waitFor(() => {
      expect(view.getByText("builder.settingsTitle") !== null).toBe(true);
    });
    fireEvent.click(view.getByRole("button", { name: "builder.addWebhook" }));

    fireEvent.click(await view.findByRole("button", { name: /Хакатон/ }));
    fireEvent.click(view.getByRole("button", { name: "Save webhook" }));

    await waitFor(() => {
      expect(fetchCalls.length).toBe(2);
    });
    expect(fetchCalls[0]?.url).toBe("/api/forms/form-1/webhooks/reusable");
    expect(fetchCalls[1]?.init?.method).toBe("POST");
    expect(String(fetchCalls[1]?.init?.body)).toBe(
      JSON.stringify({
        url: "https://pechkin.example.com/hook",
        secret: "s3cret",
        enabled: true,
        mode: "DIGEST",
        digestInterval: "WEEKLY",
        digestTime: "18:00",
        digestWeekday: 5,
      }),
    );

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });

  test("lists organization webhooks read-only in form settings", async () => {
    const restoreDom = installTestDom();
    const firstBlock = createBlock({
      id: "block-1",
      type: "SHORT_TEXT",
      position: 0,
      title: "First question",
    });
    const form = {
      ...createForm([firstBlock]),
      organizationWebhooks: [
        {
          id: "wh-org",
          url: "https://org.example.com/hook",
          enabled: true,
          mode: "IMMEDIATE" as const,
          digestInterval: null,
          digestTime: null,
          digestWeekday: null,
        },
      ],
    };

    const view = renderBuilder(form);

    fireEvent.click(view.getByRole("button", { name: "builder.settings" }));

    await waitFor(() => {
      expect(view.getByText("https://org.example.com/hook") !== null).toBe(
        true,
      );
    });
    expect(view.getByText("builder.webhookFromOrganization") !== null).toBe(
      true,
    );
    // The row has no switch, edit or remove action of its own.
    expect(view.queryByRole("button", { name: "builder.editWebhook" })).toBe(
      null,
    );
    expect(view.queryByLabelText("builder.webhookEnabled")).toBe(null);

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

    fireEvent.click(view.getByLabelText(/Allow going back/));
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

    expect(
      (view.getByLabelText(/Allow going back/) as HTMLInputElement).checked,
    ).toBe(false);

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
      expect(
        view.getByRole("button", { name: "builder.exitGraphMode" }) !== null,
      ).toBe(true);
    });
    expect(view.queryByText("builder.blocks")).toBe(null);
    expect(window.location.pathname).toBe("/forms/form-1/graph");

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
    expect(window.location.pathname).toBe("/forms/form-1/edit");

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
      "chime:branching-graph-layout:form-1",
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
      window.localStorage.getItem("chime:branching-graph-layout:form-1"),
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
  test("renames the form from the header and saves the title with the other metadata", async () => {
    const restoreDom = installTestDom();
    const firstBlock = createBlock({
      id: "block-1",
      type: "SHORT_TEXT",
      position: 0,
      title: "First question",
    });
    const form = createForm([firstBlock]);
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    const previousFetch = globalThis.fetch;

    globalThis.fetch = (async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      fetchCalls.push({ url: String(url), init });

      return {
        ok: true,
        json: async () => ({ form: { ...form, title: "Renamed form" } }),
      } as Response;
    }) as typeof fetch;

    const view = renderBuilder(form);

    fireEvent.click(view.getByRole("button", { name: "builder.editTitle" }));
    const titleInput = view.getByLabelText(
      "builder.editTitle",
    ) as HTMLInputElement;
    expect(titleInput.value).toBe("Form title");

    typeIntoInput(titleInput, "Renamed form");
    fireEvent.keyDown(titleInput, { key: "Enter" });

    await waitFor(() => {
      expect(fetchCalls.length).toBe(1);
    });

    expect(fetchCalls[0]?.url).toBe("/api/forms/form-1");
    expect(fetchCalls[0]?.init?.method).toBe("PATCH");
    expect(fetchCalls[0]?.init?.body).toContain('"title":"Renamed form"');
    expect(fetchCalls[0]?.init?.body).toContain('"slug":"demo-form"');
    expect(fetchCalls[0]?.init?.body).toContain('"completionTitle":"Done"');

    await waitFor(() => {
      expect(view.getByRole("heading", { level: 1 }).textContent).toBe(
        "Renamed form",
      );
    });

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });

  test("edits rating labels in the block panel and saves them with the scale", async () => {
    const restoreDom = installTestDom();
    const ratingBlock = createBlock({
      id: "block-1",
      type: "RATING",
      position: 0,
      title: "How was it?",
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
        json: async () => ({ block: ratingBlock }),
      } as Response;
    }) as typeof fetch;

    const view = renderBuilder(createForm([ratingBlock]));

    const minLabelInput = view.getByLabelText(
      "builder.ratingMinLabel",
    ) as HTMLInputElement;
    const maxLabelInput = view.getByLabelText(
      "builder.ratingMaxLabel",
    ) as HTMLInputElement;
    expect(minLabelInput.value).toBe("");
    expect(maxLabelInput.maxLength).toBe(40);
    expect(view.getByLabelText("builder.ratingMin") !== null).toBe(true);
    expect(view.getByLabelText("builder.ratingMax") !== null).toBe(true);

    typeIntoInput(minLabelInput, "Poor");
    typeIntoInput(maxLabelInput, "Great");
    fireEvent.click(view.getByRole("button", { name: "builder.saveBlock" }));

    await waitFor(() => {
      expect(fetchCalls.length).toBe(1);
    });

    expect(fetchCalls[0]?.url).toBe("/api/forms/form-1/blocks/block-1");
    expect(fetchCalls[0]?.init?.method).toBe("PATCH");
    expect(fetchCalls[0]?.init?.body).toContain('"min":1');
    expect(fetchCalls[0]?.init?.body).toContain('"max":5');
    expect(fetchCalls[0]?.init?.body).toContain('"minLabel":"Poor"');
    expect(fetchCalls[0]?.init?.body).toContain('"maxLabel":"Great"');

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });

  test("shows the accepted files and size selects for a file upload block", async () => {
    const restoreDom = installTestDom();
    const fileBlock = createBlock({
      id: "block-1",
      type: "FILE_UPLOAD",
      position: 0,
      title: "Your CV",
    });

    const view = renderBuilder(createForm([fileBlock]));

    expect(view.getByLabelText("builder.fileUploadAccept") !== null).toBe(true);
    expect(view.getByLabelText("builder.fileUploadMaxSize") !== null).toBe(
      true,
    );
    expect(view.getByText("builder.fileUploadHelp") !== null).toBe(true);

    await cleanupAndRestore(restoreDom);
  });

  test("inserts a block right after the chosen graph node", async () => {
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
    const newBlock = createBlock({
      id: "block-3",
      type: "NUMBER",
      position: 2,
      title: "",
    });
    const previousFetch = globalThis.fetch;
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];

    globalThis.fetch = (async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      fetchCalls.push({ url: String(url), init });

      if (String(url).endsWith("/blocks")) {
        return {
          ok: true,
          json: async () => ({ block: newBlock }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({
          form: createForm([
            { ...firstBlock, position: 0 },
            { ...newBlock, position: 1 },
            { ...secondBlock, position: 2 },
          ]),
        }),
      } as Response;
    }) as typeof fetch;

    const view = renderBuilder(createForm([firstBlock, secondBlock]), "graph");

    fireEvent.click(
      await view.findByRole("button", {
        name: "blocks.types.SHORT_TEXT First question",
      }),
    );
    fireEvent.click(
      await view.findByRole("button", { name: "builder.addBlockAfter" }),
    );
    fireEvent.click(view.getByText("blocks.types.NUMBER"));

    await waitFor(() => {
      expect(fetchCalls.length).toBe(2);
    });

    expect(fetchCalls[0]?.url).toBe("/api/forms/form-1/blocks");
    expect(fetchCalls[0]?.init?.method).toBe("POST");
    expect(String(fetchCalls[0]?.init?.body)).toContain('"type":"NUMBER"');
    expect(fetchCalls[1]?.url).toBe("/api/forms/form-1/blocks/reorder");
    expect(String(fetchCalls[1]?.init?.body)).toBe(
      '{"blockIds":["block-1","block-3","block-2"]}',
    );

    await waitFor(() => {
      expect(view.getByText("builder.toasts.addedBlock") !== null).toBe(true);
    });

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });

  test("saves the notification subscription as soon as it is toggled", async () => {
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
        json: async () => ({ enabled: true }),
      } as Response;
    }) as typeof fetch;

    const view = renderBuilder(createForm([firstBlock]), undefined, {
      builder: { notifyOnResponse: "Email me about new responses" },
    });

    fireEvent.click(view.getByRole("button", { name: "builder.settings" }));

    await waitFor(() => {
      expect(view.getByText("builder.settingsTitle") !== null).toBe(true);
    });

    const checkbox = view.getByRole("checkbox", {
      name: /Email me about new responses/,
    }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(fetchCalls.length).toBe(1);
    });

    expect(fetchCalls[0]?.url).toBe("/api/forms/form-1/notifications");
    expect(fetchCalls[0]?.init?.method).toBe("PUT");
    expect(String(fetchCalls[0]?.init?.body)).toBe('{"enabled":true}');

    await waitFor(() => {
      expect(checkbox.checked).toBe(true);
    });

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });

  test("asks to delete the selected block on Backspace outside text fields", async () => {
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
      return { ok: true, json: async () => ({}) } as Response;
    }) as typeof fetch;

    const view = renderBuilder(createForm([firstBlock, secondBlock]));

    fireEvent.keyDown(view.getByDisplayValue("First question"), {
      key: "Backspace",
    });
    expect(view.queryByText("builder.deleteBlockTitle")).toBe(null);

    fireEvent.keyDown(document.body, { key: "Backspace" });

    await waitFor(() => {
      expect(view.getByText("builder.deleteBlockTitle") !== null).toBe(true);
    });

    fireEvent.click(view.getByRole("button", { name: "ui.delete" }));

    await waitFor(() => {
      expect(fetchCalls.length).toBe(1);
    });
    expect(fetchCalls[0]?.url).toBe("/api/forms/form-1/blocks/block-1");
    expect(fetchCalls[0]?.init?.method).toBe("DELETE");

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });

  test("closes the graph panel when the empty canvas is clicked", async () => {
    const restoreDom = installTestDom();
    const firstBlock = createBlock({
      id: "block-1",
      type: "SHORT_TEXT",
      position: 0,
      title: "First question",
    });

    const view = renderBuilder(createForm([firstBlock]), "graph");
    const graphNode = await view.findByRole("button", {
      name: "blocks.types.SHORT_TEXT First question",
    });

    fireEvent.click(graphNode);

    await waitFor(() => {
      expect(view.getByText("Form title") !== null).toBe(true);
    });

    const canvas =
      view.container.querySelector<HTMLElement>(".overscroll-x-none");
    if (!canvas) {
      throw new Error("Graph canvas not found");
    }
    canvas.setPointerCapture = () => {};
    canvas.hasPointerCapture = () => false;
    canvas.releasePointerCapture = () => {};

    fireEvent.pointerDown(canvas, {
      button: 0,
      pointerId: 2,
      clientX: 900,
      clientY: 900,
    });
    fireEvent.pointerUp(canvas, {
      pointerId: 2,
      clientX: 900,
      clientY: 900,
    });

    await waitFor(() => {
      expect(view.queryByText("Form title")).toBe(null);
    });

    await cleanupAndRestore(restoreDom);
  });

  const pageMessages: TranslationTree = {
    formPages: {
      newPage: "New page",
      pageLabel: "Page {number}",
      deletePage: "Delete page",
      deletePageMergeHint: "Its blocks move to the previous page",
      repeatToggle: "Repeat this page",
      repeatCountQuestion: "Count question",
      repeatNoCandidates: "Add a number question on an earlier page",
      repeatActive: 'Repeats by the answer to "{question}"',
      repeatCountMissing: "The count question was deleted",
      repeatCountNotNumber: "The count question must be a number question",
      repeatCountOnPage: "The count question cannot be on this page",
      repeatCountAfterPage: "The count question must come before this page",
      repeatCountRepeats: "The count question cannot be on a repeating page",
    },
  };

  test("renames a page and clears it back to the number label", async () => {
    const restoreDom = installTestDom();
    const firstBlock = createBlock({
      id: "block-1",
      type: "SHORT_TEXT",
      position: 0,
      title: "First question",
    });
    const pages: PageDefinition[] = [{ id: "p1" }];
    const savedPagesBodies: PageDefinition[][] = [];
    const previousFetch = globalThis.fetch;

    globalThis.fetch = (async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      if (
        String(url) === "/api/forms/form-1" &&
        String(init?.method) === "PATCH"
      ) {
        const body = JSON.parse(String(init?.body)) as {
          pages: PageDefinition[];
        };
        savedPagesBodies.push(body.pages);

        return {
          ok: true,
          json: async () => ({ form: createForm([firstBlock], body.pages) }),
        } as Response;
      }

      return { ok: true, json: async () => ({}) } as Response;
    }) as typeof fetch;

    const view = renderBuilder(createForm([firstBlock], pages), undefined, {
      ...pageMessages,
      formPages: {
        ...(pageMessages.formPages as TranslationTree),
        renamePage: "Rename page",
      },
    } as TranslationTree);

    fireEvent.click(view.getByRole("button", { name: "Rename page" }));
    const input = view.getByRole("textbox", {
      name: "Rename page",
    }) as HTMLInputElement;
    typeIntoInput(input, "Contacts");
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(savedPagesBodies.length).toBe(1);
    });
    expect(savedPagesBodies[0]).toEqual([{ id: "p1", name: "Contacts" }]);
    expect(view.getByText("Contacts") !== null).toBe(true);

    fireEvent.click(view.getByRole("button", { name: "Rename page" }));
    const clearInput = view.getByRole("textbox", {
      name: "Rename page",
    }) as HTMLInputElement;
    typeIntoInput(clearInput, "");
    fireEvent.keyDown(clearInput, { key: "Enter" });

    await waitFor(() => {
      expect(savedPagesBodies.length).toBe(2);
    });
    expect(savedPagesBodies[1]).toEqual([{ id: "p1" }]);
    expect(view.getByText("Page 1") !== null).toBe(true);

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });

  test("renders no page headers for a form without a page registry", async () => {
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

    const view = renderBuilder(
      createForm([firstBlock, secondBlock]),
      undefined,
      pageMessages,
    );

    expect(view.queryByText("Page 1")).toBe(null);
    expect(view.queryByText("Page 2")).toBe(null);
    // One insertion point after each block, all inside the single run: the
    // header plus button plus one divider per block gap.
    expect(
      view.getAllByRole("button", { name: "builder.newBlock" }).length,
    ).toBe(3);

    await cleanupAndRestore(restoreDom);
  });

  test("starts a page at an insertion point and materializes the registry", async () => {
    const restoreDom = installTestDom();
    const blocks = [
      createBlock({
        id: "block-1",
        type: "SHORT_TEXT",
        position: 0,
        title: "First question",
      }),
      createBlock({
        id: "block-2",
        type: "SHORT_TEXT",
        position: 1,
        title: "Second question",
      }),
      createBlock({
        id: "block-3",
        type: "SHORT_TEXT",
        position: 2,
        title: "Third question",
      }),
    ];
    const pageIdsByBlock = new Map<string, string | null>();
    let savedPages: PageDefinition[] | null = null as PageDefinition[] | null;
    const previousFetch = globalThis.fetch;

    globalThis.fetch = (async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      const urlValue = String(url);

      if (urlValue.startsWith("/api/forms/form-1/blocks/block-")) {
        const body = JSON.parse(String(init?.body)) as {
          pageId: string | null;
        };
        pageIdsByBlock.set(urlValue.split("/").pop() as string, body.pageId);
        return { ok: true, json: async () => ({}) } as Response;
      }

      if (urlValue === "/api/forms/form-1") {
        const body = JSON.parse(String(init?.body)) as {
          pages: PageDefinition[];
        };
        savedPages = body.pages;

        return {
          ok: true,
          json: async () => ({
            form: createForm(
              blocks.map((block) => ({
                ...block,
                pageId: pageIdsByBlock.get(block.id) ?? null,
              })),
              body.pages,
            ),
          }),
        } as Response;
      }

      return { ok: true, json: async () => ({}) } as Response;
    }) as typeof fetch;

    const view = renderBuilder(createForm(blocks), undefined, pageMessages);

    // The divider plus opens the menu; "New page" sits below the block types.
    fireEvent.click(
      view.getAllByRole("button", { name: "builder.newBlock" })[1],
    );
    fireEvent.click(view.getByRole("button", { name: "New page" }));

    await waitFor(() => {
      expect(view.getByText("Page 1") !== null).toBe(true);
      expect(view.getByText("Page 2") !== null).toBe(true);
    });

    expect(savedPages?.length).toBe(2);
    const firstPageId = pageIdsByBlock.get("block-1");
    const secondPageId = pageIdsByBlock.get("block-2");

    expect(firstPageId).toBe(savedPages?.[0]?.id);
    expect(secondPageId).toBe(savedPages?.[1]?.id);
    expect(pageIdsByBlock.get("block-3")).toBe(secondPageId);
    expect(firstPageId).not.toBe(secondPageId);

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });

  test("merges a deleted page into the previous one", async () => {
    const restoreDom = installTestDom();
    const blocks = [
      createBlock({
        id: "block-1",
        type: "SHORT_TEXT",
        position: 0,
        title: "First question",
        pageId: "page-1",
      }),
      createBlock({
        id: "block-2",
        type: "SHORT_TEXT",
        position: 1,
        title: "Second question",
        pageId: "page-2",
      }),
      createBlock({
        id: "block-3",
        type: "SHORT_TEXT",
        position: 2,
        title: "Third question",
        pageId: "page-2",
      }),
    ];
    const pages: PageDefinition[] = [{ id: "page-1" }, { id: "page-2" }];
    const fetchCalls: Array<{ url: string; body: Record<string, unknown> }> =
      [];
    const previousFetch = globalThis.fetch;

    globalThis.fetch = (async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<
        string,
        unknown
      >;
      fetchCalls.push({ url: String(url), body });

      if (String(url) === "/api/forms/form-1") {
        return {
          ok: true,
          json: async () => ({
            form: createForm(
              blocks.map((block) => ({
                ...block,
                pageId: (body.pages as PageDefinition[])[0]?.id ?? null,
              })),
              body.pages as PageDefinition[],
            ),
          }),
        } as Response;
      }

      return { ok: true, json: async () => ({}) } as Response;
    }) as typeof fetch;

    const view = renderBuilder(
      createForm(blocks, pages),
      undefined,
      pageMessages,
    );

    // The first page is protected while the second one exists.
    const deleteButtons = view.getAllByRole("button", {
      name: "Delete page",
    });

    expect(deleteButtons.length).toBe(1);
    expect(deleteButtons[0].getAttribute("title")).toBe(
      "Its blocks move to the previous page",
    );

    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(view.queryByText("Page 2")).toBe(null);
    });
    expect(view.getByText("Page 1") !== null).toBe(true);

    const blockPatches = fetchCalls.filter((call) =>
      call.url.startsWith("/api/forms/form-1/blocks/block-"),
    );

    expect(blockPatches.length).toBe(2);
    expect(blockPatches.map((call) => call.url).sort()).toEqual([
      "/api/forms/form-1/blocks/block-2",
      "/api/forms/form-1/blocks/block-3",
    ]);
    expect(blockPatches.every((call) => call.body.pageId === "page-1")).toBe(
      true,
    );

    const metadataPatch = fetchCalls.find(
      (call) => call.url === "/api/forms/form-1",
    );

    expect(metadataPatch?.body.pages).toEqual([{ id: "page-1" }]);

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });

  test("keeps the header of a page whose only block is deleted", async () => {
    const restoreDom = installTestDom();
    const blocks = [
      createBlock({
        id: "block-1",
        type: "SHORT_TEXT",
        position: 0,
        title: "First question",
        pageId: "page-1",
      }),
      createBlock({
        id: "block-2",
        type: "SHORT_TEXT",
        position: 1,
        title: "Second question",
        pageId: "page-2",
      }),
    ];
    const pages: PageDefinition[] = [{ id: "page-1" }, { id: "page-2" }];
    const previousFetch = globalThis.fetch;

    globalThis.fetch = (async () =>
      ({ ok: true, json: async () => ({}) }) as Response) as typeof fetch;

    const view = renderBuilder(
      createForm(blocks, pages),
      undefined,
      pageMessages,
    );

    fireEvent.click(view.getByRole("button", { name: "Second question" }));
    fireEvent.keyDown(document.body, { key: "Backspace" });

    await waitFor(() => {
      expect(view.getByText("builder.deleteBlockTitle") !== null).toBe(true);
    });

    fireEvent.click(view.getByRole("button", { name: "ui.delete" }));

    await waitFor(() => {
      expect(view.queryByDisplayValue("Second question")).toBe(null);
    });
    expect(view.getByText("Page 1") !== null).toBe(true);
    expect(view.getByText("Page 2") !== null).toBe(true);

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });

  function repeatForm() {
    const blocks = [
      createBlock({
        id: "block-1",
        type: "NUMBER",
        position: 0,
        title: "How many guests?",
        pageId: "page-1",
      }),
      createBlock({
        id: "block-2",
        type: "SHORT_TEXT",
        position: 1,
        title: "Guest name",
        pageId: "page-2",
      }),
    ];

    return { blocks, pages: [{ id: "page-1" }, { id: "page-2" }] };
  }

  function mockFetchCollector(
    blocks: BuilderBlock[],
    fetchCalls: Array<{ url: string; body: Record<string, unknown> }>,
  ) {
    return (async (url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<
        string,
        unknown
      >;
      fetchCalls.push({ url: String(url), body });

      if (String(url) === "/api/forms/form-1") {
        return {
          ok: true,
          json: async () => ({
            form: createForm(blocks, body.pages as PageDefinition[]),
          }),
        } as Response;
      }

      return { ok: true, json: async () => ({}) } as Response;
    }) as typeof fetch;
  }

  test("sets a repeat from the page header and saves the registry entry", async () => {
    const restoreDom = installTestDom();
    const { blocks, pages } = repeatForm();
    const fetchCalls: Array<{ url: string; body: Record<string, unknown> }> =
      [];
    const previousFetch = globalThis.fetch;

    globalThis.fetch = mockFetchCollector(blocks, fetchCalls);

    const view = renderBuilder(
      createForm(blocks, pages),
      undefined,
      pageMessages,
    );
    const toggles = view.getAllByRole("checkbox", {
      name: "Repeat this page",
    }) as HTMLInputElement[];

    expect(toggles.length).toBe(2);
    expect(toggles[1].checked).toBe(false);

    // Turning the repeat on stores the first offered count question; picking
    // another one from the select replaces it.
    fireEvent.click(toggles[1]);

    const metadataPatches = () =>
      fetchCalls.filter((call) => call.url === "/api/forms/form-1");

    await waitFor(() => {
      expect(metadataPatches().length).toBe(1);
    });
    expect(metadataPatches()[0]?.body.pages).toEqual([
      { id: "page-1" },
      { id: "page-2", repeat: { countBlockId: "block-1" } },
    ]);
    expect(toggles[1].checked).toBe(true);
    expect(
      view.getByText('Repeats by the answer to "How many guests?"') !== null,
    ).toBe(true);

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });

  test("picking another count question from the select saves it", async () => {
    const restoreDom = installTestDom();
    const blocks = [
      createBlock({
        id: "block-1",
        type: "NUMBER",
        position: 0,
        title: "How many guests?",
        pageId: "page-1",
      }),
      createBlock({
        id: "block-2",
        type: "NUMBER",
        position: 1,
        title: "Other count",
        pageId: "page-1",
      }),
      createBlock({
        id: "block-3",
        type: "SHORT_TEXT",
        position: 2,
        title: "Guest name",
        pageId: "page-2",
      }),
    ];
    const pages: PageDefinition[] = [
      { id: "page-1" },
      { id: "page-2", repeat: { countBlockId: "block-1" } },
    ];
    const fetchCalls: Array<{ url: string; body: Record<string, unknown> }> =
      [];
    const previousFetch = globalThis.fetch;

    globalThis.fetch = mockFetchCollector(blocks, fetchCalls);

    const view = renderBuilder(
      createForm(blocks, pages),
      undefined,
      pageMessages,
    );

    const select = view.getByLabelText("Count question") as HTMLSelectElement;
    const optionValues = Array.from(select.options).map(
      (option) => option.value,
    );

    expect(optionValues).toEqual(["block-1", "block-2"]);

    fireEvent.change(select, { target: { value: "block-2" } });

    const metadataPatches = () =>
      fetchCalls.filter((call) => call.url === "/api/forms/form-1");

    await waitFor(() => {
      expect(metadataPatches().length).toBe(1);
    });
    expect(metadataPatches()[0]?.body.pages).toEqual([
      { id: "page-1" },
      { id: "page-2", repeat: { countBlockId: "block-2" } },
    ]);

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });

  test("clearing the repeat saves the registry entry without it", async () => {
    const restoreDom = installTestDom();
    const { blocks } = repeatForm();
    const pages: PageDefinition[] = [
      { id: "page-1" },
      { id: "page-2", repeat: { countBlockId: "block-1" } },
    ];
    const fetchCalls: Array<{ url: string; body: Record<string, unknown> }> =
      [];
    const previousFetch = globalThis.fetch;

    globalThis.fetch = mockFetchCollector(blocks, fetchCalls);

    const view = renderBuilder(
      createForm(blocks, pages),
      undefined,
      pageMessages,
    );
    const toggles = view.getAllByRole("checkbox", {
      name: "Repeat this page",
    }) as HTMLInputElement[];

    expect(toggles[1].checked).toBe(true);

    fireEvent.click(toggles[1]);

    const metadataPatches = () =>
      fetchCalls.filter((call) => call.url === "/api/forms/form-1");

    await waitFor(() => {
      expect(metadataPatches().length).toBe(1);
    });
    expect(metadataPatches()[0]?.body.pages).toEqual([
      { id: "page-1" },
      { id: "page-2" },
    ]);
    await waitFor(() => {
      expect(toggles[1].checked).toBe(false);
    });
    expect(
      view.queryByText('Repeats by the answer to "How many guests?"'),
    ).toBe(null);

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });

  test("the count question select offers only number blocks of earlier pages", async () => {
    const restoreDom = installTestDom();
    const blocks = [
      createBlock({
        id: "block-1",
        type: "NUMBER",
        position: 0,
        title: "How many guests?",
        pageId: "page-1",
      }),
      createBlock({
        id: "block-2",
        type: "SHORT_TEXT",
        position: 1,
        title: "Guest name",
        pageId: "page-1",
      }),
      createBlock({
        id: "block-3",
        type: "NUMBER",
        position: 2,
        title: "Later count",
        pageId: "page-2",
      }),
    ];
    const pages: PageDefinition[] = [
      { id: "page-1" },
      { id: "page-2", repeat: { countBlockId: "block-1" } },
    ];

    const view = renderBuilder(
      createForm(blocks, pages),
      undefined,
      pageMessages,
    );

    const select = view.getByLabelText("Count question") as HTMLSelectElement;
    const optionValues = Array.from(select.options).map(
      (option) => option.value,
    );

    expect(optionValues).toEqual(["block-1"]);
    expect(
      view.queryByText("The count question must come before this page"),
    ).toBe(null);

    await cleanupAndRestore(restoreDom);
  });

  test("warns on the page header when the stored count block is deleted", async () => {
    const restoreDom = installTestDom();
    const { blocks } = repeatForm();
    const pages: PageDefinition[] = [
      { id: "page-1" },
      { id: "page-2", repeat: { countBlockId: "block-1" } },
    ];
    const previousFetch = globalThis.fetch;

    globalThis.fetch = (async () =>
      ({ ok: true, json: async () => ({}) }) as Response) as typeof fetch;

    const view = renderBuilder(
      createForm(blocks, pages),
      undefined,
      pageMessages,
    );

    expect(view.queryByText("The count question was deleted")).toBe(null);

    fireEvent.click(view.getByRole("button", { name: "How many guests?" }));
    fireEvent.keyDown(document.body, { key: "Backspace" });

    await waitFor(() => {
      expect(view.getByText("builder.deleteBlockTitle") !== null).toBe(true);
    });

    fireEvent.click(view.getByRole("button", { name: "ui.delete" }));

    // The stored countBlockId stays in place by design; the header of the
    // repeating page reports that it no longer resolves.
    await waitFor(() => {
      expect(view.getByText("The count question was deleted") !== null).toBe(
        true,
      );
    });
    const toggles = view.getAllByRole("checkbox", {
      name: "Repeat this page",
    }) as HTMLInputElement[];

    expect(toggles[1].checked).toBe(true);
    expect(
      view.getByText("Add a number question on an earlier page") !== null,
    ).toBe(true);

    globalThis.fetch = previousFetch;
    await cleanupAndRestore(restoreDom);
  });

  test("warns on the page header when the count block sits on a later page", async () => {
    const restoreDom = installTestDom();
    const blocks = [
      createBlock({
        id: "block-1",
        type: "SHORT_TEXT",
        position: 0,
        title: "Intro",
        pageId: "page-1",
      }),
      createBlock({
        id: "block-2",
        type: "SHORT_TEXT",
        position: 1,
        title: "Guest name",
        pageId: "page-2",
      }),
      createBlock({
        id: "block-3",
        type: "NUMBER",
        position: 2,
        title: "Too late",
        pageId: "page-3",
      }),
    ];
    const pages: PageDefinition[] = [
      { id: "page-1" },
      { id: "page-2", repeat: { countBlockId: "block-3" } },
      { id: "page-3" },
    ];

    const view = renderBuilder(
      createForm(blocks, pages),
      undefined,
      pageMessages,
    );

    expect(
      view.getByText("The count question must come before this page") !== null,
    ).toBe(true);

    await cleanupAndRestore(restoreDom);
  });
});

describe("builder page structure helpers", () => {
  function idFactory() {
    let counter = 0;

    return () => {
      counter += 1;
      return `fresh-page-${counter}`;
    };
  }

  function blocksWithPages(
    entries: Array<[id: string, pageId: string | null]>,
  ) {
    return entries.map(([id, pageId], index) =>
      createBlock({
        id,
        type: "SHORT_TEXT",
        position: index,
        pageId,
      }),
    );
  }

  test("a form without a registry is one headerless run of blocks", () => {
    const blocks = blocksWithPages([
      ["b1", null],
      ["b2", null],
    ]);

    expect(buildPageSections(blocks, [])).toEqual([
      { id: "b1", definition: null, blocks },
    ]);
  });

  test("pages group by pageId and empty registry pages keep their place", () => {
    const blocks = blocksWithPages([
      ["b1", "p1"],
      ["b2", "p1"],
      ["b3", "p3"],
    ]);
    const pages = [{ id: "p1" }, { id: "p2" }, { id: "p3" }];
    const sections = buildPageSections(blocks, pages);

    expect(sections.map((section) => section.id)).toEqual(["p1", "p2", "p3"]);
    expect(sections[0]?.blocks.map((block) => block.id)).toEqual(["b1", "b2"]);
    expect(sections[1]?.blocks).toEqual([]);
    expect(sections[2]?.blocks.map((block) => block.id)).toEqual(["b3"]);
  });

  test("splitting a form without pages makes the first page cover the blocks above", () => {
    const blocks = blocksWithPages([
      ["b1", null],
      ["b2", null],
      ["b3", null],
    ]);
    const result = splitPageAfter({
      blocks,
      pages: [],
      afterBlockId: "b1",
      createPageId: idFactory(),
    });

    expect(result?.pages).toEqual([
      { id: "fresh-page-1" },
      { id: "fresh-page-2" },
    ]);
    expect(result?.blocks.map((block) => block.pageId)).toEqual([
      "fresh-page-1",
      "fresh-page-2",
      "fresh-page-2",
    ]);
  });

  test("splitting inside a page moves only the blocks below the break", () => {
    const blocks = blocksWithPages([
      ["b1", "p1"],
      ["b2", "p1"],
      ["b3", "p1"],
      ["b4", "p2"],
    ]);
    const result = splitPageAfter({
      blocks,
      pages: [{ id: "p1" }, { id: "p2" }],
      afterBlockId: "b2",
      createPageId: idFactory(),
    });

    expect(result?.pages).toEqual([
      { id: "p1" },
      { id: "fresh-page-1" },
      { id: "p2" },
    ]);
    expect(result?.blocks.map((block) => block.pageId)).toEqual([
      "p1",
      "p1",
      "fresh-page-1",
      "p2",
    ]);
  });

  test("splitting at the end of a page starts an empty page", () => {
    const blocks = blocksWithPages([
      ["b1", "p1"],
      ["b2", "p2"],
    ]);
    const result = splitPageAfter({
      blocks,
      pages: [{ id: "p1" }, { id: "p2" }],
      afterBlockId: "b2",
      createPageId: idFactory(),
    });

    expect(result?.pages).toEqual([
      { id: "p1" },
      { id: "p2" },
      { id: "fresh-page-1" },
    ]);
    expect(
      buildPageSections(result?.blocks ?? [], result?.pages ?? []).map(
        (section) => [section.id, section.blocks.length],
      ),
    ).toEqual([
      ["p1", 1],
      ["p2", 1],
      ["fresh-page-1", 0],
    ]);
  });

  test("deleting a page merges its blocks into the previous one", () => {
    const blocks = blocksWithPages([
      ["b1", "p1"],
      ["b2", "p2"],
      ["b3", "p2"],
    ]);
    const result = deletePageById({
      blocks,
      pages: [{ id: "p1" }, { id: "p2" }],
      pageId: "p2",
    });

    expect(result?.pages).toEqual([{ id: "p1" }]);
    expect(result?.blocks.map((block) => block.pageId)).toEqual([
      "p1",
      "p1",
      "p1",
    ]);
  });

  test("the first page is protected while later pages exist", () => {
    const blocks = blocksWithPages([
      ["b1", "p1"],
      ["b2", "p2"],
    ]);

    expect(
      deletePageById({
        blocks,
        pages: [{ id: "p1" }, { id: "p2" }],
        pageId: "p1",
      }),
    ).toBe(null);
  });

  test("deleting the only page clears the registry", () => {
    const blocks = blocksWithPages([
      ["b1", "p1"],
      ["b2", "p1"],
    ]);
    const result = deletePageById({
      blocks,
      pages: [{ id: "p1" }],
      pageId: "p1",
    });

    expect(result?.pages).toEqual([]);
    expect(result?.blocks.map((block) => block.pageId)).toEqual(["p1", "p1"]);
  });

  test("moving a page down places it after the target with its blocks", () => {
    const blocks = blocksWithPages([
      ["b1", "p1"],
      ["b2", "p2"],
      ["b3", "p2"],
      ["b4", "p3"],
    ]);
    const result = movePageToAnchor({
      blocks,
      pages: [{ id: "p1" }, { id: "p2" }, { id: "p3" }],
      draggedPageId: "p1",
      targetPageId: "p2",
    });

    expect(result?.pages.map((page) => page.id)).toEqual(["p2", "p1", "p3"]);
    expect(
      result?.blocks.map((block) => [block.id, block.pageId, block.position]),
    ).toEqual([
      ["b2", "p2", 0],
      ["b3", "p2", 1],
      ["b1", "p1", 2],
      ["b4", "p3", 3],
    ]);
  });

  test("moving a page up places it before the target", () => {
    const blocks = blocksWithPages([
      ["b1", "p1"],
      ["b2", "p2"],
      ["b3", "p3"],
    ]);
    const result = movePageToAnchor({
      blocks,
      pages: [{ id: "p1" }, { id: "p2" }, { id: "p3" }],
      draggedPageId: "p3",
      targetPageId: "p1",
    });

    expect(result?.pages.map((page) => page.id)).toEqual(["p3", "p1", "p2"]);
    expect(result?.blocks.map((block) => block.id)).toEqual(["b3", "b1", "b2"]);
  });

  test("a moved page keeps its repeat settings", () => {
    const blocks = blocksWithPages([
      ["b1", "p1"],
      ["b2", "p2"],
      ["b3", "p2"],
    ]);
    const result = movePageToAnchor({
      blocks,
      pages: [{ id: "p1" }, { id: "p2", repeat: { countBlockId: "b1" } }],
      draggedPageId: "p2",
      targetPageId: "p1",
    });

    expect(result?.pages).toEqual([
      { id: "p2", repeat: { countBlockId: "b1" } },
      { id: "p1" },
    ]);
  });

  test("moving past an empty page preserves its position in the registry", () => {
    const result = movePageToAnchor({
      blocks: blocksWithPages([
        ["b1", "p1"],
        ["b2", "p2"],
      ]),
      pages: [{ id: "p1" }, { id: "empty" }, { id: "p2" }],
      draggedPageId: "p1",
      targetPageId: "empty",
    });
    expect(result?.pages.map((page) => page.id)).toEqual(["empty", "p1", "p2"]);
    expect(
      buildPageSections(result!.blocks, result!.pages).map(
        (section) => section.id,
      ),
    ).toEqual(["empty", "p1", "p2"]);
  });

  test("moving a page leaves standalone blocks outside the registry", () => {
    const result = movePageToAnchor({
      blocks: blocksWithPages([
        ["b1", "p1"],
        ["standalone", null],
        ["b2", "p2"],
      ]),
      pages: [{ id: "p1" }, { id: "p2" }],
      draggedPageId: "p2",
      targetPageId: "p1",
    });
    expect(result?.pages.map((page) => page.id)).toEqual(["p2", "p1"]);
    expect(result?.blocks.map((block) => [block.id, block.pageId])).toEqual([
      ["b2", "p2"],
      ["b1", "p1"],
      ["standalone", null],
    ]);
  });

  test("an unknown or coinciding page does not move", () => {
    const blocks = blocksWithPages([
      ["b1", "p1"],
      ["b2", "p2"],
    ]);
    const pages = [{ id: "p1" }, { id: "p2" }];

    expect(
      movePageToAnchor({
        blocks,
        pages,
        draggedPageId: "p1",
        targetPageId: "gone",
      }),
    ).toBe(null);
    expect(
      movePageToAnchor({
        blocks,
        pages,
        draggedPageId: "p1",
        targetPageId: "p1",
      }),
    ).toBe(null);
  });

  test("a drop onto another page returns that page, a drop inside keeps it", () => {
    const blocks = blocksWithPages([
      ["b1", "p1"],
      ["b2", "p2"],
      ["b3", "p2"],
    ]);
    const pages = [{ id: "p1" }, { id: "p2" }];

    expect(
      pageIdAfterDrop({
        blocks,
        pages,
        draggedBlockId: "b1",
        overBlockId: "b3",
      }),
    ).toBe("p2");
    expect(
      pageIdAfterDrop({
        blocks,
        pages,
        draggedBlockId: "b2",
        overBlockId: "b3",
      }),
    ).toBe(undefined);
    expect(
      pageIdAfterDrop({
        blocks,
        pages: [],
        draggedBlockId: "b1",
        overBlockId: "b2",
      }),
    ).toBe(undefined);
  });

  test("a new block lands on the page of its anchor", () => {
    const blocks = blocksWithPages([
      ["b1", "p1"],
      ["b2", "p2"],
      ["b3", "p2"],
    ]);
    const pages = [{ id: "p1" }, { id: "p2" }];

    expect(pageIdForNewBlock({ blocks, pages, afterBlockId: "b1" })).toBe("p1");
    expect(pageIdForNewBlock({ blocks, pages, afterBlockId: null })).toBe("p2");
    expect(pageIdForNewBlock({ blocks, pages: [], afterBlockId: null })).toBe(
      null,
    );
  });

  test("a new block lands on a trailing empty page when appending", () => {
    const blocks = blocksWithPages([
      ["b1", "p1"],
      ["b2", "p2"],
    ]);
    const pages = [{ id: "p1" }, { id: "p2" }, { id: "p3" }];

    expect(pageIdForNewBlock({ blocks, pages, afterBlockId: null })).toBe("p3");
  });

  test("a gap maps to the block that follows it, across empty pages", () => {
    const blocks = blocksWithPages([
      ["b1", "p1"],
      ["b2", "p1"],
      ["b3", "p3"],
    ]);
    const sections = buildPageSections(blocks, [
      { id: "p1" },
      { id: "p2" },
      { id: "p3" },
    ]);

    expect(sections.map((section) => section.id)).toEqual(["p1", "p2", "p3"]);
    expect(insertionForGap(sections, 0, 1)).toEqual({
      kind: "before",
      blockId: "b2",
    });
    expect(insertionForGap(sections, 0, 2)).toEqual({
      kind: "before",
      blockId: "b3",
    });
    expect(insertionForGap(sections, 2, 1)).toEqual({ kind: "end" });
    expect(insertionForGap(sections, 9, 0)).toEqual({ kind: "end" });
  });

  test("sections carry the repeat of their registry entries", () => {
    const blocks = blocksWithPages([
      ["b1", "p1"],
      ["b2", "p2"],
    ]);
    const sections = buildPageSections(blocks, [
      { id: "p1" },
      { id: "p2", repeat: { countBlockId: "b1" } },
    ]);

    expect(sections[0]?.definition).toEqual({ id: "p1" });
    expect(sections[1]?.definition).toEqual({
      id: "p2",
      repeat: { countBlockId: "b1" },
    });
  });

  test("splitting a page preserves the repeat of the pages around it", () => {
    const blocks = blocksWithPages([
      ["b1", "p1"],
      ["b2", "p1"],
      ["b3", "p2"],
    ]);
    const result = splitPageAfter({
      blocks,
      pages: [
        { id: "p1", repeat: { countBlockId: "b9" } },
        { id: "p2", repeat: { countBlockId: "b1" } },
      ],
      afterBlockId: "b1",
      createPageId: idFactory(),
    });

    expect(result?.pages).toEqual([
      { id: "p1", repeat: { countBlockId: "b9" } },
      { id: "fresh-page-1" },
      { id: "p2", repeat: { countBlockId: "b1" } },
    ]);
    expect(result?.blocks.map((block) => block.pageId)).toEqual([
      "p1",
      "fresh-page-1",
      "p2",
    ]);
  });

  test("deleting a page keeps the previous page's repeat and drops its own", () => {
    const blocks = blocksWithPages([
      ["b1", "p1"],
      ["b2", "p2"],
      ["b3", "p3"],
    ]);
    const result = deletePageById({
      blocks,
      pages: [
        { id: "p1", repeat: { countBlockId: "b0" } },
        { id: "p2", repeat: { countBlockId: "b1" } },
        { id: "p3" },
      ],
      pageId: "p2",
    });

    expect(result?.pages).toEqual([
      { id: "p1", repeat: { countBlockId: "b0" } },
      { id: "p3" },
    ]);
    expect(result?.blocks.map((block) => block.pageId)).toEqual([
      "p1",
      "p1",
      "p3",
    ]);
  });

  test("materializing a headerless run keeps the repeat of registry pages", () => {
    const blocks = blocksWithPages([
      ["b1", null],
      ["b2", "p2"],
      ["b3", null],
    ]);
    const result = splitPageAfter({
      blocks,
      pages: [{ id: "p2", repeat: { countBlockId: "b1" } }],
      afterBlockId: "b1",
      createPageId: idFactory(),
    });

    expect(result?.pages).toEqual([
      { id: "fresh-page-1" },
      { id: "p2", repeat: { countBlockId: "b1" } },
      { id: "fresh-page-2" },
      { id: "fresh-page-3" },
    ]);
    expect(result?.blocks.map((block) => block.pageId)).toEqual([
      "fresh-page-1",
      "p2",
      "fresh-page-2",
    ]);
  });

  test("repeat candidates are number blocks of earlier non-repeating pages", () => {
    const blocks = [
      createBlock({
        id: "n1",
        type: "NUMBER",
        position: 0,
        title: "How many?",
        pageId: "p1",
      }),
      createBlock({
        id: "s1",
        type: "SHORT_TEXT",
        position: 1,
        title: "Name",
        pageId: "p1",
      }),
      createBlock({
        id: "n2",
        type: "NUMBER",
        position: 2,
        title: "Count of a repeating page",
        pageId: "p2",
      }),
      createBlock({
        id: "n3",
        type: "NUMBER",
        position: 3,
        title: "",
        pageId: "p3",
      }),
      createBlock({
        id: "s2",
        type: "SHORT_TEXT",
        position: 4,
        title: "Detail",
        pageId: "p4",
      }),
    ];
    const sections = buildPageSections(blocks, [
      { id: "p1" },
      { id: "p2", repeat: { countBlockId: "n1" } },
      { id: "p3" },
      { id: "p4" },
    ]);

    expect(countBlockCandidates(sections, 1)).toEqual([
      { id: "n1", title: "How many?" },
    ]);
    expect(countBlockCandidates(sections, 2)).toEqual([
      { id: "n1", title: "How many?" },
    ]);
    // The number block of the repeating page p2 is not a candidate for p4.
    expect(countBlockCandidates(sections, 3)).toEqual([
      { id: "n1", title: "How many?" },
      { id: "n3", title: "Question 4" },
    ]);
    expect(countBlockCandidates(sections, 0)).toEqual([]);
  });
});
