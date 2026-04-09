export const THEME_STORAGE_KEY = "lively-forms-theme-preference";

export const THEME_PREFERENCES = ["light", "dark", "system"] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = "light" | "dark";

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && THEME_PREFERENCES.includes(value as ThemePreference);
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === "system") {
    return systemPrefersDark ? "dark" : "light";
  }

  return preference;
}

export function applyThemePreference(preference: ThemePreference) {
  const resolved = resolveTheme(preference, window.matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;

  root.dataset.themePreference = preference;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
}

export function readStoredThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
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

export const themeInitScript = `(() => {
  const storageKey = ${JSON.stringify(THEME_STORAGE_KEY)};
  const root = document.documentElement;
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  let preference = "system";

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === "light" || stored === "dark" || stored === "system") {
      preference = stored;
    }
  } catch {}

  const resolved = preference === "system" ? (systemDark ? "dark" : "light") : preference;
  root.dataset.themePreference = preference;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
})();`;
