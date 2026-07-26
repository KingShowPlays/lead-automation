"use client";

import { useEffect, useRef } from "react";

/**
 * Keeping every view current.
 *
 * Only the overview polled, so approving a lead left the queue count, the leads
 * table and the analytics page showing stale numbers until a manual reload.
 * Worse, the staleness was invisible: the figures looked authoritative.
 *
 * Two mechanisms, because polling alone is either too slow to feel live or too
 * chatty to be kind to the API:
 *
 *   every mutation announces itself, and every mounted view refetches at once
 *   a slow poll underneath catches changes made elsewhere, or by the scheduler
 */

const CHANGED = "yean:data-changed";

/**
 * Announce that server data changed. Called for us by the api client after any
 * write, so individual components never have to remember to do it.
 */
export function announceDataChange(scope = "all"): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHANGED, { detail: { scope } }));
}

/**
 * Refetch on mount, whenever anything is written, when the tab regains focus,
 * and on a slow interval underneath.
 *
 * Polling pauses while the tab is hidden and fires once on return, so a
 * dashboard left open overnight makes one request when it is looked at again
 * rather than hundreds while nobody is watching.
 */
export function useLiveData(load: () => void, intervalMs = 20000): void {
  const saved = useRef(load);
  saved.current = load;

  useEffect(() => {
    const run = () => {
      if (!document.hidden) saved.current();
    };

    run();

    const onChanged = () => saved.current();
    const onVisible = () => run();

    window.addEventListener(CHANGED, onChanged);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const id = window.setInterval(run, intervalMs);

    return () => {
      window.removeEventListener(CHANGED, onChanged);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.clearInterval(id);
    };
  }, [intervalMs]);
}
