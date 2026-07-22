"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import { RiUploadCloud2Line, RiCloseLine, RiCheckLine } from "react-icons/ri";
import { api } from "@/lib/api";
import type { ImportRow } from "@/lib/types";

/**
 * Manual and bulk import. Paste one business per line. We accept a few loose
 * formats so a person or VA can drop in whatever they gathered:
 *   Business Name
 *   Business Name, @instagram
 *   Business Name, email@x.ng
 *   Business Name, https://site.ng, City, category
 * A value that looks like an email, an @handle, or a URL is detected wherever
 * it sits on the line; anything left over past the name is treated as city.
 */
export function parseLine(line: string): ImportRow | null {
  const parts = line
    .split(/[,\t]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const row: ImportRow = { businessName: "" };
  const leftovers: string[] = [];
  for (const p of parts) {
    if (!row.businessName) {
      row.businessName = p;
      continue;
    }
    if (/^https?:\/\//i.test(p) || /^[a-z0-9-]+\.[a-z]{2,}/i.test(p)) {
      row.websiteUrl = /^https?:\/\//i.test(p) ? p : `https://${p}`;
    } else if (/^@/.test(p) || /instagram\.com/i.test(p)) {
      row.instagramUsername = p.replace(/.*instagram\.com\//i, "").replace(/^@/, "").replace(/\/.*$/, "");
    } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p)) {
      row.email = p;
    } else if (/^\+?[\d\s()-]{7,}$/.test(p)) {
      row.phone = p;
    } else {
      leftovers.push(p);
    }
  }
  if (leftovers.length && !row.city) row.city = leftovers[0];
  if (leftovers.length > 1 && !row.category) row.category = leftovers[1];
  return row.businessName ? row : null;
}

export function ImportPanel({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone?: () => void }) {
  const [text, setText] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);

  const rows = text
    .split("\n")
    .map(parseLine)
    .filter((r): r is ImportRow => r !== null);

  async function submit() {
    if (rows.length === 0) {
      toast.error("Add at least one business");
      return;
    }
    setBusy(true);
    try {
      const r = await api.importLeads(rows, { city: city.trim() || undefined, category: category.trim() || undefined });
      toast.success(
        `Imported ${r.created} new lead${r.created === 1 ? "" : "s"}` +
          (r.duplicates ? `, ${r.duplicates} already known` : "") +
          (r.processing?.qualified ? `, ${r.processing.qualified} qualified` : ""),
        { duration: 7000 },
      );
      setText("");
      onDone?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 240, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-card flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-b-none sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200/60 p-5 dark:border-slate-800/60">
              <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
                <RiUploadCloud2Line className="text-brand-600" /> Import leads
              </h2>
              <button onClick={onClose} className="btn-ghost !p-2" aria-label="Close">
                <RiCloseLine className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                One business per line. Add an @handle, an email, a phone, or a website and we'll sort it out. This is the
                fastest way to catch a business you spotted on Instagram before it ever reaches Google.
              </p>
              <textarea
                className="input min-h-40 font-mono text-xs leading-relaxed"
                placeholder={"Crystal Scents, @crystalscents, crystal@scents.ng\nAmara Kitchen, https://amara.ng, Port Harcourt, restaurants\nGlow Haven Beauty, @glowhaven"}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Default city (optional)</label>
                  <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Lagos" />
                </div>
                <div>
                  <label className="label">Default category (optional)</label>
                  <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. fashion stores" />
                </div>
              </div>
              <p className="text-xs font-medium text-slate-400">
                {rows.length} valid {rows.length === 1 ? "line" : "lines"} detected
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200/60 p-4 dark:border-slate-800/60">
              <button onClick={onClose} className="btn-ghost">
                Cancel
              </button>
              <button onClick={submit} disabled={busy || rows.length === 0} className="btn-cta">
                <RiCheckLine className="h-4 w-4" /> {busy ? "Importing…" : `Import ${rows.length || ""}`.trim()}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
