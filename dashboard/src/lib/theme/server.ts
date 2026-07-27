import { DEFAULT_THEME, normaliseTheme, type Theme } from "./tokens";

/**
 * Reads the stored theme during the server render of the root layout.
 *
 * This is the whole reason the interface never flashes. The tokens are resolved
 * before any HTML is sent, so the first painted frame is already themed. A
 * client-side fetch, or a script that reads localStorage on boot, would both
 * paint the default look first and correct it a moment later, which is exactly
 * the flicker this has to avoid.
 *
 * The fetch is bounded and failure is not an error state: an unreachable API
 * means the dashboard renders in the shipped default theme, which is a working
 * interface, rather than an error page.
 */

const API_URL = (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const API_KEY = process.env.API_KEY ?? process.env.NEXT_PUBLIC_API_KEY ?? "";

/** Long enough for a cold API, short enough that nobody waits on a dead one. */
const TIMEOUT_MS = 2500;

export async function loadTheme(): Promise<Theme> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (API_KEY) headers["x-api-key"] = API_KEY;

    const res = await fetch(`${API_URL}/api/theme`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return DEFAULT_THEME;

    const data = (await res.json()) as { theme?: unknown };
    return normaliseTheme(data?.theme);
  } catch {
    return DEFAULT_THEME;
  }
}
