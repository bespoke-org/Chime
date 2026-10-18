import { describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import YAML from "yaml";

import { I18nProvider } from "@/components/i18n-provider";
import type { AppLocale, TranslationTree } from "@/lib/i18n";
import type { SignInProviderOption } from "@/lib/oidc-auth";
import { installTestDom } from "@/test/install-dom";

let signInCalls: Array<{ provider: string; options: unknown }> = [];

const { mock } = (await import("bun:test")) as unknown as {
  mock: {
    module: (specifier: string, factory: () => Record<string, unknown>) => void;
  };
};

mock.module("next-auth/react", () => ({
  signIn: async (provider: string, options: unknown) => {
    signInCalls.push({ provider, options });
  },
}));

const { ProviderSignInButtons } =
  await import("@/components/auth/provider-sign-in-buttons");

function loadMessages(locale: AppLocale) {
  const file = readFileSync(
    path.join(process.cwd(), "locales", `${locale}.yml`),
    "utf8",
  );
  return YAML.parse(file) as TranslationTree;
}

function renderButtons(locale: AppLocale, providers: SignInProviderOption[]) {
  return render(
    <I18nProvider locale={locale} messages={loadMessages(locale)}>
      <ProviderSignInButtons providers={providers} />
    </I18nProvider>,
  );
}

describe("ProviderSignInButtons", () => {
  test("renders nothing when no provider is enabled", () => {
    const restoreDom = installTestDom();
    const view = renderButtons("en", []);

    expect(view.container.innerHTML).toBe("");

    cleanup();
    restoreDom();
  });

  test("renders one labeled button per provider and starts sign-in", () => {
    const restoreDom = installTestDom();
    signInCalls = [];
    const view = renderButtons("en", [
      { id: "google", label: "Google" },
      { id: "oidc", label: "SGU" },
    ]);

    const buttons = view.getAllByRole("button");
    expect(buttons.length).toBe(2);
    expect(buttons[0]?.textContent).toContain("Continue with Google");
    expect(buttons[1]?.textContent).toContain("Continue with SGU");

    fireEvent.click(buttons[1]!);

    expect(signInCalls.length).toBe(1);
    expect(signInCalls[0]?.provider).toBe("oidc");
    expect(JSON.stringify(signInCalls[0]?.options)).toBe(
      JSON.stringify({ callbackUrl: "/dashboard" }),
    );

    cleanup();
    restoreDom();
  });

  test("uses the Russian label", () => {
    const restoreDom = installTestDom();
    const view = renderButtons("ru", [{ id: "github", label: "GitHub" }]);

    expect(view.getByRole("button").textContent).toContain(
      "Войти через GitHub",
    );

    cleanup();
    restoreDom();
  });
});
