"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

export type Theme = "light";
export type ThemeMode = "light";

interface ThemeContextType {
  /** Resolved theme actually applied to the DOM. */
  theme: Theme;
  /** User-selected preference. "system" defers to OS. */
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** Convenience: flips between light and dark, persists explicit choice. */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Always use light mode
  applyTheme("light");

  return (
    <ThemeContext.Provider value={{ theme: "light", mode: "light", setMode: () => {}, toggle: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
