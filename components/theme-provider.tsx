"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import {
  THEME_STORAGE_KEY,
  applyResolvedTheme,
  applyThemePreference,
  persistThemePreference,
  readStoredThemePreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialPreference(): ThemePreference {
  if (typeof window === "undefined") {
    return "system";
  }

  return readStoredThemePreference();
}

function getInitialResolvedTheme(): ResolvedTheme {
  if (typeof window === "undefined") {
    return "light";
  }

  return resolveTheme(readStoredThemePreference(), window.matchMedia("(prefers-color-scheme: dark)").matches);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(getInitialPreference);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(getInitialResolvedTheme);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleSystemChange = (event: MediaQueryListEvent) => {
      const currentPreference = readStoredThemePreference();

      if (currentPreference !== "system") {
        return;
      }

      const nextResolved = applyResolvedTheme(document.documentElement, currentPreference, event.matches);
      setResolvedTheme(nextResolved);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== THEME_STORAGE_KEY) {
        return;
      }

      const next = readStoredThemePreference();
      setPreferenceState(next);
      setResolvedTheme(resolveTheme(next, mediaQuery.matches));
      applyThemePreference(next);
    };

    mediaQuery.addEventListener("change", handleSystemChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    applyThemePreference(preference);
  }, [preference]);

  function setPreference(nextPreference: ThemePreference) {
    setPreferenceState(nextPreference);
    persistThemePreference(nextPreference);
    applyThemePreference(nextPreference);
    setResolvedTheme(resolveTheme(nextPreference, window.matchMedia("(prefers-color-scheme: dark)").matches));
  }

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemePreference() {
  const value = useContext(ThemeContext);

  if (!value) {
    throw new Error("useThemePreference must be used inside ThemeProvider.");
  }

  return value;
}
