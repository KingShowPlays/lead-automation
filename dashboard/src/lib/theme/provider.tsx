"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { DEFAULT_THEME, normaliseTheme, themeToAttributes, themeToCss, type Theme } from "./tokens";

/**
 * Holds the live theme and applies it to the document.
 *
 * The applying is deliberately not React's job. Re-rendering the tree on every
 * slider drag would be slow and, worse, would unmount and remount elements mid
 * animation, which is precisely how a theme editor ends up flickering. Instead
 * the tokens are written straight into one <style> element and a handful of
 * attributes on <html>. The browser recalculates styles and repaints; no
 * component re-renders, nothing remounts, and dragging a radius slider is
 * smooth at sixty frames a second.
 *
 * React state here exists only for the parts of the interface that genuinely
 * are structural: section ordering, visibility and the brand text.
 */

export const THEME_STYLE_ID = "yean-theme-tokens";

interface ThemeContextValue {
  theme: Theme;
  /** Applies immediately to the document. Does not persist. */
  preview: (next: Theme) => void;
  /** Applies and writes to the server. */
  save: (next: Theme) => Promise<void>;
  /** Drops local edits and returns to whatever was last persisted. */
  revert: () => void;
  saved: Theme;
  dirty: boolean;
  saving: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Layout effects run before the browser paints, which is what a theme change
 * needs. On the server there is no paint and React warns about the hook, so it
 * falls back there. Nothing is lost: the server already rendered the tokens
 * into the document head.
 */
const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Writes tokens to the document without touching the React tree. */
function paint(theme: Theme): void {
  if (typeof document === "undefined") return;

  let style = document.getElementById(THEME_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = THEME_STYLE_ID;
    document.head.appendChild(style);
  }
  const css = themeToCss(theme);
  if (style.textContent !== css) style.textContent = css;

  const root = document.documentElement;
  for (const [name, value] of Object.entries(themeToAttributes(theme))) {
    if (root.getAttribute(name) !== value) root.setAttribute(name, value);
  }

  applyMode(theme.mode);
}

/**
 * Keeps the `dark` class in step with the chosen mode. Tailwind's dark variants
 * key off that class, so it has to track the mode even though the custom
 * properties are already scoped by it.
 */
function applyMode(mode: Theme["mode"]): void {
  const root = document.documentElement;
  const dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

export function ThemeProvider({ initial, children }: { initial: Theme; children: React.ReactNode }) {
  const [saved, setSaved] = useState<Theme>(initial);
  const [theme, setTheme] = useState<Theme>(initial);
  const [saving, setSaving] = useState(false);
  const painted = useRef<string>("");

  // Runs before the browser paints, so nothing is ever shown mid-change.
  useBeforePaint(() => {
    const key = JSON.stringify(theme);
    if (painted.current === key) return;
    painted.current = key;
    paint(theme);
  }, [theme]);

  // Following the system preference means following it as it changes.
  useEffect(() => {
    if (theme.mode !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyMode("system");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [theme.mode]);

  const preview = useCallback((next: Theme) => setTheme(normaliseTheme(next)), []);

  const save = useCallback(async (next: Theme) => {
    const clean = normaliseTheme(next);
    setTheme(clean);
    setSaving(true);
    try {
      await api.saveTheme(clean);
      setSaved(clean);
    } finally {
      setSaving(false);
    }
  }, []);

  const revert = useCallback(() => setTheme(saved), [saved]);

  const dirty = useMemo(() => JSON.stringify(theme) !== JSON.stringify(saved), [theme, saved]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, saved, preview, save, revert, dirty, saving }),
    [theme, saved, preview, save, revert, dirty, saving],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Rendering outside the provider should degrade to the shipped look rather
    // than throw, so a stray component can never take the dashboard down.
    return {
      theme: DEFAULT_THEME,
      saved: DEFAULT_THEME,
      preview: () => undefined,
      save: async () => undefined,
      revert: () => undefined,
      dirty: false,
      saving: false,
    };
  }
  return ctx;
}
