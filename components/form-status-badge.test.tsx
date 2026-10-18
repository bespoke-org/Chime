import { describe, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";

import { FormStatusBadge } from "@/components/form-status-badge";
import { I18nProvider } from "@/components/i18n-provider";
import { installTestDom } from "@/test/install-dom";

const messages = {
  statuses: { draft: "Draft", published: "Published", closed: "Closed" },
};

function renderBadge(props: Parameters<typeof FormStatusBadge>[0]) {
  return render(
    <I18nProvider locale="en" messages={messages}>
      <FormStatusBadge {...props} />
    </I18nProvider>,
  );
}

describe("FormStatusBadge", () => {
  test("shows Closed for a published form that is closed", () => {
    const restoreDom = installTestDom();
    const view = renderBadge({ status: "PUBLISHED", closed: true });

    expect(view.container.textContent).toBe("Closed");

    cleanup();
    restoreDom();
  });

  test("shows Published when the form is open", () => {
    const restoreDom = installTestDom();
    const view = renderBadge({ status: "PUBLISHED", closed: false });

    expect(view.container.textContent).toBe("Published");

    cleanup();
    restoreDom();
  });

  test("keeps Draft for an unpublished form even when closed", () => {
    const restoreDom = installTestDom();
    const view = renderBadge({ status: "DRAFT", closed: true });

    expect(view.container.textContent).toBe("Draft");

    cleanup();
    restoreDom();
  });
});
