import { describe, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import YAML from "yaml";

import { I18nProvider } from "@/components/i18n-provider";
import { PublicFormClosed } from "@/components/public-form-closed";
import type { AppLocale, TranslationTree } from "@/lib/i18n";
import { installTestDom } from "@/test/install-dom";

function loadMessages(locale: AppLocale) {
  const file = readFileSync(
    path.join(process.cwd(), "locales", `${locale}.yml`),
    "utf8",
  );
  return YAML.parse(file) as TranslationTree;
}

function renderClosed(locale: AppLocale, message: string) {
  return render(
    <I18nProvider locale={locale} messages={loadMessages(locale)}>
      <PublicFormClosed title="Demo form" message={message} />
    </I18nProvider>,
  );
}

describe("PublicFormClosed", () => {
  test("renders the title and the custom message", () => {
    const restoreDom = installTestDom();
    const view = renderClosed("en", "  Applications are closed.  ");

    expect(view.getByRole("heading").textContent).toBe("Demo form");
    expect(view.queryByText("Applications are closed.") !== null).toBe(true);
    expect(view.queryByText("Form closed") !== null).toBe(true);

    cleanup();
    restoreDom();
  });

  test("falls back to the localized default message in English", () => {
    const restoreDom = installTestDom();
    const view = renderClosed("en", "");

    expect(
      view.queryByText("This form is no longer accepting responses.") !== null,
    ).toBe(true);

    cleanup();
    restoreDom();
  });

  test("falls back to the localized default message in Russian", () => {
    const restoreDom = installTestDom();
    const view = renderClosed("ru", "   ");

    expect(view.queryByText("Форма закрыта") !== null).toBe(true);
    expect(
      view.queryByText("Эта форма больше не принимает ответы.") !== null,
    ).toBe(true);

    cleanup();
    restoreDom();
  });
});
