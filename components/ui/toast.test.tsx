import { describe, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";

import { I18nProvider } from "@/components/i18n-provider";
import { ToastViewport } from "@/components/ui/toast";
import { installTestDom } from "@/test/install-dom";

const messages = { ui: { dismissNotification: "Dismiss" } };

describe("ToastViewport", () => {
  test("pins the viewport to the bottom-right corner", () => {
    const restoreDom = installTestDom();
    const view = render(
      <I18nProvider locale="en" messages={messages}>
        <ToastViewport toasts={[]} onDismiss={() => {}} />
      </I18nProvider>,
    );
    const viewport = view.container.firstElementChild;
    const className = viewport?.className ?? "";

    expect(className).toContain("bottom-6");
    expect(className).toContain("right-6");
    expect(className).not.toContain("top-6");

    cleanup();
    restoreDom();
  });

  test("renders newer toasts below older ones", () => {
    const restoreDom = installTestDom();
    const view = render(
      <I18nProvider locale="en" messages={messages}>
        <ToastViewport
          toasts={[
            { id: "1", message: "First", variant: "success" },
            { id: "2", message: "Second", variant: "success" },
          ]}
          onDismiss={() => {}}
        />
      </I18nProvider>,
    );
    const items = view.container.querySelectorAll('[role="status"]');

    expect(items[0]?.textContent).toContain("First");
    expect(items[1]?.textContent).toContain("Second");

    cleanup();
    restoreDom();
  });
});
