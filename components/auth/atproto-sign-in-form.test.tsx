import { describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import YAML from "yaml";

import { AtprotoSignInForm } from "@/components/auth/atproto-sign-in-form";
import { I18nProvider } from "@/components/i18n-provider";
import type { TranslationTree } from "@/lib/i18n";
import { installTestDom } from "@/test/install-dom";

function loadMessages() {
  const file = readFileSync(
    path.join(process.cwd(), "locales", "en.yml"),
    "utf8",
  );
  return YAML.parse(file) as TranslationTree;
}

describe("AtprotoSignInForm", () => {
  test("starts as a button and reveals the handle field when pressed", () => {
    const restoreDom = installTestDom();

    try {
      const view = render(
        <I18nProvider locale="en" messages={loadMessages()}>
          <AtprotoSignInForm />
        </I18nProvider>,
      );

      expect(view.queryByRole("textbox")).toBe(null);
      fireEvent.click(view.getByRole("button"));

      expect(view.getByRole("textbox").getAttribute("name")).toBe("identifier");
      expect(view.getByRole("button").textContent).toContain(
        "Continue with ATProto",
      );
    } finally {
      cleanup();
      restoreDom();
    }
  });
});
