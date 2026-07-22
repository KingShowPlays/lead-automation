"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { RiSaveLine, RiAddLine, RiCloseLine } from "react-icons/ri";
import { api } from "@/lib/api";
import type { Settings } from "@/lib/types";

const WEIGHT_LABELS: Record<string, string> = {
  noWebsite: "No website",
  brokenWebsite: "Broken website",
  socialOrLinkInBioOnly: "Social / link-in-bio only",
  menuPlatformOnly: "Menu platform only",
  poorWebsite: "Poor website",
  shopifyWebsite: "Shopify website",
  publicEmail: "Public email available",
  whatsappAvailable: "WhatsApp available",
  recentlyOpened: "Recently opened / opening soon",
  activeInstagram: "Active Instagram",
  strongVisualBrand: "Strong visual brand",
  customWebsitePenalty: "Existing custom website (penalty)",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [newCity, setNewCity] = useState("");
  const [newCategory, setNewCategory] = useState("");

  useEffect(() => {
    api
      .settings()
      .then((r) => setSettings(r.settings))
      .catch((e: Error) => toast.error(e.message));
  }, []);

  async function save() {
    if (!settings) return;
    setBusy(true);
    try {
      const r = await api.updateSettings({
        cities: settings.cities,
        categories: settings.categories,
        scoreThreshold: settings.scoreThreshold,
        scoringWeights: settings.scoringWeights,
        followUpDays: settings.followUpDays,
        maxContactAttempts: settings.maxContactAttempts,
        dailyEmailCap: settings.dailyEmailCap,
        discoveryEnabled: settings.discoveryEnabled,
        maxResultsPerQuery: settings.maxResultsPerQuery,
      });
      setSettings(r.settings);
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (!settings)
    return <div className="mx-auto mt-10 h-96 max-w-4xl animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />;

  return (
    <div className="mx-auto max-w-4xl">
      <motion.header
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
            Engine{" "}
            <span className="bg-gradient-to-r from-brand-600 to-purple-600 bg-clip-text text-transparent">
              settings
            </span>
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Tune where you hunt, how leads are scored, and outreach guardrails.
          </p>
        </div>
        <button onClick={save} disabled={busy} className="btn-cta">
          <RiSaveLine className="h-4 w-4" /> {busy ? "Saving…" : "Save changes"}
        </button>
      </motion.header>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Targets */}
        <section className="glass-card space-y-5 p-6">
          <h2 className="font-heading text-lg font-bold">Search targets</h2>

          <TagEditor
            label="Cities"
            items={settings.cities}
            newValue={newCity}
            setNewValue={setNewCity}
            onAdd={(v) => setSettings({ ...settings, cities: [...settings.cities, v] })}
            onRemove={(v) => setSettings({ ...settings, cities: settings.cities.filter((c) => c !== v) })}
            placeholder="Add city… (e.g. Enugu)"
          />

          <TagEditor
            label="Business categories"
            items={settings.categories}
            newValue={newCategory}
            setNewValue={setNewCategory}
            onAdd={(v) => setSettings({ ...settings, categories: [...settings.categories, v] })}
            onRemove={(v) => setSettings({ ...settings, categories: settings.categories.filter((c) => c !== v) })}
            placeholder="Add category… (e.g. gyms)"
          />

          <p className="text-xs text-slate-400">
            Each discovery run searches every city × category combination (
            {settings.cities.length * settings.categories.length} queries).
          </p>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand-600"
              checked={settings.discoveryEnabled}
              onChange={(e) => setSettings({ ...settings, discoveryEnabled: e.target.checked })}
            />
            Scheduled daily discovery enabled
          </label>

          <NumberField
            label="Max results per query (≤60)"
            value={settings.maxResultsPerQuery}
            onChange={(v) => setSettings({ ...settings, maxResultsPerQuery: v })}
          />
        </section>

        {/* Guardrails */}
        <section className="glass-card space-y-5 p-6">
          <h2 className="font-heading text-lg font-bold">Outreach guardrails</h2>
          <NumberField
            label="Qualification threshold (score)"
            value={settings.scoreThreshold}
            onChange={(v) => setSettings({ ...settings, scoreThreshold: v })}
          />
          <NumberField
            label="Follow-up after (days)"
            value={settings.followUpDays}
            onChange={(v) => setSettings({ ...settings, followUpDays: v })}
          />
          <NumberField
            label="Max contact attempts per lead"
            value={settings.maxContactAttempts}
            onChange={(v) => setSettings({ ...settings, maxContactAttempts: v })}
          />
          <NumberField
            label="Daily email cap"
            value={settings.dailyEmailCap}
            onChange={(v) => setSettings({ ...settings, dailyEmailCap: v })}
          />
          <p className="text-xs leading-relaxed text-slate-400">
            Keep the cap conservative — steady volume from a warm Gmail account converts better than bursts, and
            protects your sender reputation.
          </p>
        </section>
      </div>

      {/* Scoring weights */}
      <section className="glass-card mt-6 p-6">
        <h2 className="font-heading text-lg font-bold">Scoring weights</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Leads scoring ≥ {settings.scoreThreshold} enter the approval queue.
        </p>
        <div className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {Object.entries(WEIGHT_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
              <input
                type="number"
                className="input !w-24 text-center font-heading font-bold"
                value={settings.scoringWeights[key] ?? 0}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    scoringWeights: { ...settings.scoringWeights, [key]: Number(e.target.value) },
                  })
                }
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function TagEditor({
  label,
  items,
  newValue,
  setNewValue,
  onAdd,
  onRemove,
  placeholder,
}: {
  label: string;
  items: string[];
  newValue: string;
  setNewValue: (v: string) => void;
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  placeholder: string;
}) {
  function add() {
    const v = newValue.trim();
    if (v && !items.some((i) => i.toLowerCase() === v.toLowerCase())) onAdd(v);
    setNewValue("");
  }
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-3 py-1.5 text-xs font-semibold text-brand-700 dark:text-brand-500"
          >
            {item}
            <button onClick={() => onRemove(item)} className="hover:text-rose-500" aria-label={`Remove ${item}`}>
              <RiCloseLine className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2.5 flex gap-2">
        <input
          className="input"
          value={newValue}
          placeholder={placeholder}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
        />
        <button onClick={add} type="button" className="btn-ghost !px-3">
          <RiAddLine className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
      <input
        type="number"
        className="input !w-24 text-center font-heading font-bold"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
