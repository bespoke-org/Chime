import { describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";

import { I18nProvider } from "@/components/i18n-provider";
import { getDefaultBlockConfig } from "@/lib/blocks";
import type { BuilderBlock, BuilderForm } from "@/lib/form-types";
import { installTestDom } from "@/test/install-dom";

const router = {
  push: () => {},
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
    showProgress: true,
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

function renderBuilder(initialForm: BuilderForm) {
  return render(
    <I18nProvider locale="en" messages={{}}>
      <FormBuilder initialForm={initialForm} />
    </I18nProvider>,
  );
}

describe("FormBuilder unsaved block protection", () => {
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

    cleanup();
    restoreDom();
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

    cleanup();
    restoreDom();
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

    cleanup();
    restoreDom();
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
    cleanup();
    restoreDom();
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
    cleanup();
    restoreDom();
  });
});
