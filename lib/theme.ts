export const THEME_STORAGE_KEY = "lively-forms-theme-preference";

export const THEME_PREFERENCES = ["light", "dark", "system"] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = "light" | "dark";

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && THEME_PREFERENCES.includes(value as ThemePreference);
}

export function normalizeThemePreference(value: unknown): ThemePreference {
  return isThemePreference(value) ? value : "system";
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === "system") {
    return systemPrefersDark ? "dark" : "light";
  }

  return preference;
}

export function applyResolvedTheme(root: HTMLElement, preference: ThemePreference, systemPrefersDark: boolean) {
  const resolved = resolveTheme(preference, systemPrefersDark);

  root.dataset.themePreference = preference;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;

  return resolved;
}

export function applyThemePreference(preference: ThemePreference) {
  return applyResolvedTheme(document.documentElement, preference, window.matchMedia("(prefers-color-scheme: dark)").matches);
}

export function readStoredThemePreference(): ThemePreference {
  try {
    return normalizeThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

export function persistThemePreference(preference: ThemePreference) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // ignore persistence failures
  }
}

export function createThemeInitScript() {
  return `(() => {
    const storageKey = ${JSON.stringify(THEME_STORAGE_KEY)};
    const validPreferences = ${JSON.stringify(THEME_PREFERENCES)};
    const root = document.documentElement;
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    let preference = "system";

    try {
      const stored = window.localStorage.getItem(storageKey);
      if (validPreferences.includes(stored)) {
        preference = stored;
      }
    } catch {}

    const resolved = preference === "system" ? (systemDark ? "dark" : "light") : preference;
    root.dataset.themePreference = preference;
    root.dataset.theme = resolved;
    root.style.colorScheme = resolved;
  })();`;
}

export const themeInitScript = createThemeInitScript();
