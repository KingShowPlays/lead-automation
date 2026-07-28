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

  /*
   * Fetch again when the parameters change, not only on the interval.
   *
   * The effect below is keyed on the interval alone, so a view that changed
   * what it was asking for, a different channel in the approval queue, a
   * different window on analytics, kept the new callback in the ref and never
   * called it. The change then appeared whenever the next poll happened to come
   * round: up to twenty seconds of a filter looking like it had been ignored.
   *
   * Callers must pass a callback whose identity only changes when the request
   * does, which is what useCallback with the parameters as dependencies gives.
   */
  useEffect(() => {
    if (!document.hidden) load();
  }, [load]);

  useEffect(() => {
    const run = () => {
      if (!document.hidden) saved.current();
    };


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
