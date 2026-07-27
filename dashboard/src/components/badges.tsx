import type { LeadMaturity, WebsiteType } from "@/lib/types";

const WEBSITE_TYPE_STYLES: Record<WebsiteType, { label: string; cls: string }> = {
  NO_WEBSITE: { label: "No website", cls: "border-rose-500 bg-rose-500/5 text-rose-600 dark:text-rose-400" },
  BROKEN_WEBSITE: { label: "Broken website", cls: "border-red-500 bg-red-500/5 text-red-600 dark:text-red-400" },
  SHOPIFY: { label: "Shopify", cls: "border-emerald-500 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400" },
  LINK_IN_BIO_ONLY: { label: "Link-in-bio", cls: "border-amber-500 bg-amber-500/5 text-amber-700 dark:text-amber-400" },
  MENU_PLATFORM_ONLY: { label: "Menu platform", cls: "border-orange-500 bg-orange-500/5 text-orange-600 dark:text-orange-400" },
  SOCIAL_MEDIA_ONLY: { label: "Social only", cls: "border-fuchsia-500 bg-fuchsia-500/5 text-fuchsia-600 dark:text-fuchsia-400" },
  CUSTOM_WEBSITE: { label: "Custom website", cls: "border-slate-400 bg-slate-500/5 text-slate-600 dark:text-slate-300" },
  POOR_WEBSITE: { label: "Poor website", cls: "border-yellow-500 bg-yellow-500/5 text-yellow-700 dark:text-yellow-400" },
};

export function WebsiteTypeBadge({ type }: { type: WebsiteType }) {
  const style = WEBSITE_TYPE_STYLES[type] ?? WEBSITE_TYPE_STYLES.CUSTOM_WEBSITE;
  return <span className={`status-badge capitalize ${style.cls}`}>{style.label}</span>;
}

export function ScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 70
      ? "border-emerald-600 bg-emerald-600 text-white"
      : score >= 50
        ? "border-cta-500 bg-cta-500 text-white"
        : "border-slate-500 bg-slate-500 text-white";
  return (
    <span
      className={`inline-flex h-11 min-w-11 shrink-0 items-center justify-center border px-2 font-heading text-sm font-extrabold tabular-nums ${cls}`}
      title={`Lead score: ${score}`}
      aria-label={`Lead score ${score}`}
    >
      {score}
    </span>
  );
}

export function IntelligenceScores({
  priority,
  need,
  reach,
  compact = false,
}: {
  priority?: number;
  need?: number;
  reach?: number;
  compact?: boolean;
}) {
  const resolvedNeed = need ?? 0;
  const resolvedReach = reach ?? 0;
  const resolvedPriority = priority ?? Math.round(resolvedNeed * 0.75 + resolvedReach * 0.25);
  // A band, not a risk level. A priority of sixty is a good lead, so the middle
  // band is the accent rather than the warning colour: orange here read as
  // "something is wrong with this one" when the opposite was true.
  const priorityClass =
    resolvedPriority >= 70
      ? "border-emerald-600 bg-emerald-600 text-white"
      : resolvedPriority >= 50
        ? "border-brand-600 bg-brand-600 text-white"
        : "border-slate-500 bg-slate-600 text-white";
  return (
    <div className={`inline-flex shrink-0 items-stretch border border-slate-300 dark:border-slate-700 ${compact ? "text-[10px]" : "text-xs"}`}>
      <span
        className={`flex min-w-12 flex-col items-center justify-center px-2 py-1.5 font-heading font-extrabold tabular-nums ${priorityClass}`}
        title="Priority blends business need (75%) and contact reach (25%)"
      >
        <span className="text-[8px] uppercase tracking-wider opacity-80">Priority</span>
        <span className={compact ? "text-sm" : "text-base"}>{resolvedPriority}</span>
      </span>
      <span className="flex min-w-11 flex-col items-center justify-center bg-white px-2 py-1 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
        <span className="text-[8px] font-extrabold uppercase tracking-wider text-slate-400">Need</span>
        <strong className="font-heading tabular-nums">{resolvedNeed}</strong>
      </span>
      <span className="flex min-w-11 flex-col items-center justify-center border-l border-slate-300 bg-white px-2 py-1 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
        <span className="text-[8px] font-extrabold uppercase tracking-wider text-slate-400">Reach</span>
        <strong className="font-heading tabular-nums">{resolvedReach}</strong>
      </span>
    </div>
  );
}

export function MaturityBadge({ maturity, newToGoogle = false }: { maturity?: LeadMaturity; newToGoogle?: boolean }) {
  const value = maturity ?? "UNKNOWN";
  const cls =
    value === "NEW"
      ? "border-cyan-500 bg-cyan-500/5 text-cyan-700 dark:text-cyan-400"
      : value === "EMERGING"
        ? "border-violet-500 bg-violet-500/5 text-violet-700 dark:text-violet-400"
        : value === "ESTABLISHED"
          ? "border-slate-400 bg-slate-500/5 text-slate-600 dark:text-slate-300"
          : "border-slate-300 text-slate-400 dark:border-slate-700";
  return (
    <span className={`status-badge ${cls}`}>
      {newToGoogle ? "New to Google" : value === "UNKNOWN" ? "Age unknown" : value.toLowerCase()}
    </span>
  );
}

export function SourceBadge({ source }: { source?: string }) {
  const label = (source || "unknown").replaceAll("_", " ");
  return <span className="status-badge border-slate-400 text-slate-500 capitalize dark:text-slate-300">{label}</span>;
}

export function StagePill({ stage }: { stage: string }) {
  const map: Record<string, string> = {
    PENDING_APPROVAL: "border-brand-500 bg-brand-500/5 text-brand-600 dark:text-brand-400",
    PITCH_READY: "border-brand-500 bg-brand-500/5 text-brand-600 dark:text-brand-400",
    APPROVED: "border-emerald-500 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400",
    REJECTED: "border-rose-500 bg-rose-500/5 text-rose-600 dark:text-rose-400",
    CONTACTED: "border-purple-500 bg-purple-500/5 text-purple-600 dark:text-purple-400",
    QUALIFIED: "border-cyan-500 bg-cyan-500/5 text-cyan-600 dark:text-cyan-400",
    DISQUALIFIED: "border-slate-400 bg-slate-500/5 text-slate-500",
    ARCHIVED: "border-slate-400 bg-slate-500/5 text-slate-500",
    DISCOVERED: "border-cyan-500 bg-cyan-500/5 text-cyan-600 dark:text-cyan-400",
    CHECKED: "border-sky-500 bg-sky-500/5 text-sky-600 dark:text-sky-400",
    ENRICHED: "border-indigo-500 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400",
    SCORED: "border-violet-500 bg-violet-500/5 text-violet-600 dark:text-violet-400",
  };
  return (
    <span className={`status-badge ${map[stage] ?? "border-slate-400 bg-slate-500/5 text-slate-500"}`}>
      <span className="status-dot" />
      {stage.replaceAll("_", " ")}
    </span>
  );
}
