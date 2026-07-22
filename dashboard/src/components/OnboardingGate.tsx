"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  RiRocket2Line,
  RiMapPin2Line,
  RiRadarLine,
  RiRobot2Line,
  RiMailLine,
  RiCheckLine,
  RiArrowLeftLine,
  RiArrowRightLine,
  RiCloseLine,
  RiAddLine,
  RiSparkling2Fill,
} from "react-icons/ri";
import { api } from "@/lib/api";
import type { Settings } from "@/lib/types";

/**
 * First-run setup. Shows once, until the user finishes or skips. Only the
 * target step is compulsory (a city and a category, both pre-filled). Every
 * provider step is optional and can be skipped, because the tool already runs
 * on templates with manual import. Fully responsive: one column on phones,
 * a sticky footer for navigation, content scrolls inside the card.
 */

const DEFAULT_CITIES = ["Lagos", "Abuja", "Port Harcourt"];
const DEFAULT_CATEGORIES = ["restaurants", "hotels", "salons", "fashion stores", "perfume stores", "shortlets"];

type Draft = {
  cities: string[];
  categories: string[];
  placesKey: string;
  manualImport: boolean;
  directoryEnabled: boolean;
  directoryUrl: string;
  aiProvider: string;
  aiKey: string;
  aiModel: string;
  aiBaseUrl: string;
  emailProvider: string;
  emailFrom: string;
  resendKey: string;
  zohoUser: string;
  zohoPass: string;
};

const STEPS = ["welcome", "targets", "sources", "ai", "email", "done"] as const;
type Step = (typeof STEPS)[number];

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "show" | "hidden">("loading");
  const [step, setStep] = useState<Step>("welcome");
  const [dir, setDir] = useState(1);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    cities: DEFAULT_CITIES,
    categories: DEFAULT_CATEGORIES,
    placesKey: "",
    manualImport: true,
    directoryEnabled: false,
    directoryUrl: "",
    aiProvider: "NONE",
    aiKey: "",
    aiModel: "",
    aiBaseUrl: "",
    emailProvider: "NONE",
    emailFrom: "",
    resendKey: "",
    zohoUser: "",
    zohoPass: "",
  });

  useEffect(() => {
    const ctrl = new AbortController();
    api
      .settings()
      .then((r) => {
        if (ctrl.signal.aborted) return;
        const s: Settings = r.settings;
        if (s.onboardedAt) {
          setState("hidden");
          return;
        }
        setDraft((d) => ({
          ...d,
          cities: s.cities?.length ? s.cities : d.cities,
          categories: s.categories?.length ? s.categories : d.categories,
        }));
        setState("show");
      })
      .catch(() => {
        // If the API can't be reached, don't block the app behind the wizard.
        if (!ctrl.signal.aborted) setState("hidden");
      });
    return () => ctrl.abort();
  }, []);

  if (state === "loading") {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }
  if (state === "hidden") return <>{children}</>;

  const idx = STEPS.indexOf(step);
  const go = (next: Step) => {
    setDir(STEPS.indexOf(next) > idx ? 1 : -1);
    setStep(next);
  };

  const targetsValid = draft.cities.length > 0 && draft.categories.length > 0;

  async function finish(skipProviders = false) {
    setBusy(true);
    try {
      const integrations: Record<string, unknown> = {
        sources: {
          manualImportEnabled: draft.manualImport,
          directory: draft.directoryEnabled
            ? { enabled: true, urls: draft.directoryUrl ? [draft.directoryUrl.trim()] : [] }
            : { enabled: false },
        },
      };
      if (draft.placesKey.trim()) integrations.googlePlacesApiKey = draft.placesKey.trim();
      if (!skipProviders) {
        if (draft.aiProvider !== "NONE") {
          integrations.ai = {
            provider: draft.aiProvider,
            apiKey: draft.aiKey.trim(),
            model: draft.aiModel.trim(),
            baseUrl: draft.aiBaseUrl.trim(),
          };
        }
        if (draft.emailProvider !== "NONE") {
          const email: Record<string, unknown> = { provider: draft.emailProvider, fromAddress: draft.emailFrom.trim() };
          if (draft.emailProvider === "RESEND") email.resend = { apiKey: draft.resendKey.trim() };
          if (draft.emailProvider === "ZOHO") email.zoho = { user: draft.zohoUser.trim(), password: draft.zohoPass.trim() };
          integrations.email = email;
        }
      }
      await api.updateSettings({ cities: draft.cities, categories: draft.categories, integrations });
      await api.completeOnboarding(true);
      toast.success("You're all set. Happy hunting.");
      setState("hidden");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save setup");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 24 }}
        className="glass-card relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden"
      >
        {/* progress bar */}
        <div className="h-1 w-full bg-slate-200/60 dark:bg-slate-800">
          <motion.div
            className="h-full bg-gradient-to-r from-brand-600 via-purple-500 to-cta-500"
            initial={false}
            animate={{ width: `${(idx / (STEPS.length - 1)) * 100}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>

        {step !== "welcome" && step !== "done" && (
          <button
            onClick={() => finish(true)}
            className="absolute right-4 top-4 z-10 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            Skip setup
          </button>
        )}

        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              initial={{ opacity: 0, x: dir * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -40 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              {step === "welcome" && <Welcome />}
              {step === "targets" && <Targets draft={draft} setDraft={setDraft} />}
              {step === "sources" && <Sources draft={draft} setDraft={setDraft} />}
              {step === "ai" && <AiStep draft={draft} setDraft={setDraft} />}
              {step === "email" && <EmailStep draft={draft} setDraft={setDraft} />}
              {step === "done" && <Done draft={draft} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* sticky footer nav */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-200/60 p-4 dark:border-slate-800/60">
          <button
            onClick={() => go(STEPS[Math.max(0, idx - 1)])}
            disabled={idx === 0 || busy}
            className="btn-ghost disabled:opacity-0"
          >
            <RiArrowLeftLine className="h-4 w-4" /> Back
          </button>

          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <span
                key={s}
                className={`h-1.5 rounded-full transition-all ${i === idx ? "w-5 bg-brand-500" : "w-1.5 bg-slate-300 dark:bg-slate-700"}`}
              />
            ))}
          </div>

          {step === "welcome" && (
            <button onClick={() => go("targets")} className="btn-primary">
              Get started <RiArrowRightLine className="h-4 w-4" />
            </button>
          )}
          {step === "targets" && (
            <button onClick={() => go("sources")} disabled={!targetsValid} className="btn-primary" title={targetsValid ? "" : "Add at least one city and category"}>
              Continue <RiArrowRightLine className="h-4 w-4" />
            </button>
          )}
          {step === "sources" && (
            <button onClick={() => go("ai")} className="btn-primary">
              Continue <RiArrowRightLine className="h-4 w-4" />
            </button>
          )}
          {step === "ai" && (
            <button onClick={() => go("email")} className="btn-primary">
              {draft.aiProvider === "NONE" ? "Skip for now" : "Continue"} <RiArrowRightLine className="h-4 w-4" />
            </button>
          )}
          {step === "email" && (
            <button onClick={() => go("done")} className="btn-primary">
              {draft.emailProvider === "NONE" ? "Skip for now" : "Continue"} <RiArrowRightLine className="h-4 w-4" />
            </button>
          )}
          {step === "done" && (
            <button onClick={() => finish(false)} disabled={busy} className="btn-cta">
              {busy ? "Saving…" : "Finish setup"} <RiCheckLine className="h-4 w-4" />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ---------------------------------------------------------------- steps */

function StepHead({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="mb-6">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 to-purple-600 text-xl text-white shadow-lg shadow-brand-500/30">
        {icon}
      </span>
      <h2 className="mt-4 font-heading text-2xl font-extrabold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{sub}</p>
    </div>
  );
}

function Welcome() {
  return (
    <div className="py-4 text-center sm:py-8">
      <motion.span
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
        className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-brand-600 to-purple-600 text-4xl text-white shadow-xl shadow-brand-500/40"
      >
        <RiRocket2Line />
      </motion.span>
      <h1 className="mt-6 font-heading text-3xl font-extrabold tracking-tight">
        Welcome to your{" "}
        <span className="bg-gradient-to-r from-brand-600 to-purple-600 bg-clip-text text-transparent">lead engine</span>
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        In a minute you'll pick where to hunt and how you'll find leads. You can skip the rest and add it later. Nothing
        goes out without your approval.
      </p>
      <div className="mx-auto mt-6 flex max-w-md flex-wrap items-center justify-center gap-2 text-xs">
        {["Discover", "Check the site", "Score", "AI pitch", "You approve", "Send"].map((t, i) => (
          <motion.span
            key={t}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.06 }}
            className="rounded-full border border-slate-200 bg-white/60 px-3 py-1 font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300"
          >
            {t}
          </motion.span>
        ))}
      </div>
    </div>
  );
}

function Targets({ draft, setDraft }: { draft: Draft; setDraft: React.Dispatch<React.SetStateAction<Draft>> }) {
  return (
    <div>
      <StepHead
        icon={<RiMapPin2Line />}
        title="Where should we hunt?"
        sub="These are required. We start with sensible Nigerian defaults, edit them to fit YEAN."
      />
      <TagRow
        label="Cities"
        items={draft.cities}
        onAdd={(v) => setDraft((d) => ({ ...d, cities: [...d.cities, v] }))}
        onRemove={(v) => setDraft((d) => ({ ...d, cities: d.cities.filter((c) => c !== v) }))}
        placeholder="Add a city"
      />
      <div className="h-5" />
      <TagRow
        label="Business categories"
        items={draft.categories}
        onAdd={(v) => setDraft((d) => ({ ...d, categories: [...d.categories, v] }))}
        onRemove={(v) => setDraft((d) => ({ ...d, categories: d.categories.filter((c) => c !== v) }))}
        placeholder="Add a category"
      />
      <p className="mt-4 text-xs text-slate-400">
        Each run looks at every city and category pair ({draft.cities.length * draft.categories.length} combinations).
      </p>
    </div>
  );
}

function Sources({ draft, setDraft }: { draft: Draft; setDraft: React.Dispatch<React.SetStateAction<Draft>> }) {
  return (
    <div>
      <StepHead
        icon={<RiRadarLine />}
        title="How will you find leads?"
        sub="Google Places finds established businesses. Manual import and directories catch the brand-new ones before they hit Google. Pick any mix; you can change this later."
      />
      <div className="space-y-3">
        <SourceCard
          title="Manual and bulk import"
          desc="Paste businesses you spot on Instagram, get by referral, or find via CAC. Always available, and the best way to catch new businesses early."
          on={draft.manualImport}
          onToggle={(v) => setDraft((d) => ({ ...d, manualImport: v }))}
        >
          <p className="text-xs text-slate-400">No setup needed. Use the Import button on the Leads page.</p>
        </SourceCard>

        <SourceCard
          title="Google Places"
          desc="Automated discovery of listed businesses by city and category."
          on={Boolean(draft.placesKey.trim())}
          hideToggle
        >
          <input
            className="input"
            placeholder="Paste your Google Places API key (optional)"
            value={draft.placesKey}
            onChange={(e) => setDraft((d) => ({ ...d, placesKey: e.target.value }))}
            autoComplete="off"
          />
        </SourceCard>

        <SourceCard
          title="Directory crawler"
          desc="Point it at a public business directory or sitemap. We pull the listings and run them through the same checks."
          on={draft.directoryEnabled}
          onToggle={(v) => setDraft((d) => ({ ...d, directoryEnabled: v }))}
        >
          {draft.directoryEnabled && (
            <input
              className="input"
              placeholder="https://a-directory.example/new-businesses"
              value={draft.directoryUrl}
              onChange={(e) => setDraft((d) => ({ ...d, directoryUrl: e.target.value }))}
              autoComplete="off"
            />
          )}
        </SourceCard>
      </div>
    </div>
  );
}

function AiStep({ draft, setDraft }: { draft: Draft; setDraft: React.Dispatch<React.SetStateAction<Draft>> }) {
  return (
    <div>
      <StepHead
        icon={<RiRobot2Line />}
        title="AI pitch writer (optional)"
        sub="Connect a model to write personalised pitches. Skip it and we'll use solid templates instead."
      />
      <label className="label">Provider</label>
      <select
        className="input"
        value={draft.aiProvider}
        onChange={(e) => setDraft((d) => ({ ...d, aiProvider: e.target.value }))}
      >
        <option value="NONE">Off, use templates</option>
        <option value="OPENAI">OpenAI</option>
        <option value="ANTHROPIC">Anthropic</option>
        <option value="NVIDIA">NVIDIA NIM</option>
        <option value="CUSTOM">Custom (OpenAI-compatible)</option>
      </select>
      {draft.aiProvider !== "NONE" && (
        <div className="mt-4 space-y-3">
          <input className="input" placeholder="API key" value={draft.aiKey} autoComplete="off" onChange={(e) => setDraft((d) => ({ ...d, aiKey: e.target.value }))} />
          <input className="input" placeholder="Model (optional, uses a sensible default)" value={draft.aiModel} onChange={(e) => setDraft((d) => ({ ...d, aiModel: e.target.value }))} />
          {draft.aiProvider === "CUSTOM" && (
            <input className="input" placeholder="Base URL, e.g. https://api.groq.com/openai/v1" value={draft.aiBaseUrl} onChange={(e) => setDraft((d) => ({ ...d, aiBaseUrl: e.target.value }))} />
          )}
        </div>
      )}
    </div>
  );
}

function EmailStep({ draft, setDraft }: { draft: Draft; setDraft: React.Dispatch<React.SetStateAction<Draft>> }) {
  return (
    <div>
      <StepHead
        icon={<RiMailLine />}
        title="Email sending (optional)"
        sub="Connect a mailbox to send approved pitches. Skip it and you can still approve and export; add this any time in Settings."
      />
      <label className="label">Provider</label>
      <select
        className="input"
        value={draft.emailProvider}
        onChange={(e) => setDraft((d) => ({ ...d, emailProvider: e.target.value }))}
      >
        <option value="NONE">Off for now</option>
        <option value="RESEND">Resend</option>
        <option value="ZOHO">Zoho / SMTP</option>
        <option value="GMAIL">Gmail (set up later in Settings)</option>
      </select>
      {draft.emailProvider !== "NONE" && draft.emailProvider !== "GMAIL" && (
        <div className="mt-4 space-y-3">
          <input className="input" placeholder="From address, e.g. hello@yourdomain.com" value={draft.emailFrom} onChange={(e) => setDraft((d) => ({ ...d, emailFrom: e.target.value }))} />
          {draft.emailProvider === "RESEND" && (
            <input className="input" placeholder="Resend API key" value={draft.resendKey} autoComplete="off" onChange={(e) => setDraft((d) => ({ ...d, resendKey: e.target.value }))} />
          )}
          {draft.emailProvider === "ZOHO" && (
            <>
              <input className="input" placeholder="SMTP user (your Zoho address)" value={draft.zohoUser} onChange={(e) => setDraft((d) => ({ ...d, zohoUser: e.target.value }))} />
              <input className="input" type="password" placeholder="SMTP password / app password" value={draft.zohoPass} autoComplete="off" onChange={(e) => setDraft((d) => ({ ...d, zohoPass: e.target.value }))} />
            </>
          )}
        </div>
      )}
      {draft.emailProvider === "GMAIL" && (
        <p className="mt-3 text-xs leading-relaxed text-slate-400">
          Gmail needs an OAuth refresh token. We'll skip it here; the Settings page has a step-by-step guide.
        </p>
      )}
    </div>
  );
}

function Done({ draft }: { draft: Draft }) {
  const picks = [
    draft.manualImport && "Manual import",
    draft.placesKey.trim() && "Google Places",
    draft.directoryEnabled && "Directory crawler",
  ].filter(Boolean) as string[];
  return (
    <div className="py-4 text-center sm:py-8">
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 12 }}
        className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-500 text-4xl text-white shadow-xl shadow-emerald-500/40"
      >
        <RiSparkling2Fill />
      </motion.span>
      <h2 className="mt-6 font-heading text-2xl font-extrabold tracking-tight">Ready when you are</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        You're targeting {draft.cities.length} cities and {draft.categories.length} categories, finding leads via{" "}
        {picks.length ? picks.join(", ") : "manual import"}. Click finish and we'll take you to your dashboard.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- bits */

function SourceCard({
  title,
  desc,
  on,
  onToggle,
  hideToggle,
  children,
}: {
  title: string;
  desc: string;
  on: boolean;
  onToggle?: (v: boolean) => void;
  hideToggle?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border p-4 transition-colors ${on ? "border-brand-500/50 bg-brand-500/[0.05]" : "border-slate-200/70 dark:border-slate-700/70"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-heading text-sm font-bold">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{desc}</p>
        </div>
        {!hideToggle && onToggle && (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            onClick={() => onToggle(!on)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-brand-600" : "bg-slate-300 dark:bg-slate-600"}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
          </button>
        )}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

function TagRow({
  label,
  items,
  onAdd,
  onRemove,
  placeholder,
}: {
  label: string;
  items: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  placeholder: string;
}) {
  const [val, setVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  function add() {
    const v = val.trim();
    if (v && !items.some((i) => i.toLowerCase() === v.toLowerCase())) onAdd(v);
    setVal("");
    inputRef.current?.focus();
  }
  return (
    <div>
      <label className="label">{label}</label>
      <div className="mb-2 flex flex-wrap gap-2">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.span
              key={item}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-3 py-1.5 text-xs font-semibold text-brand-700 dark:text-brand-400"
            >
              {item}
              <button onClick={() => onRemove(item)} className="hover:text-rose-500" aria-label={`Remove ${item}`}>
                <RiCloseLine className="h-3.5 w-3.5" />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          className="input"
          value={val}
          placeholder={placeholder}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
        />
        <button onClick={add} type="button" className="btn-ghost !px-3" aria-label={`Add ${label}`}>
          <RiAddLine className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
