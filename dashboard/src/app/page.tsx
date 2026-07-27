"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  RiInboxArchiveLine,
  RiMailSendLine,
  RiEmotionHappyLine,
  RiTrophyLine,
  RiPlayCircleLine,
  RiRadarLine,
  RiCheckboxCircleFill,
  RiCloseCircleFill,
  RiErrorWarningLine,
  RiArrowRightLine,
  RiTimeLine,
  RiBarChartBoxLine,
  RiRestartLine,
} from "react-icons/ri";
import { api } from "@/lib/api";
import { useLiveData } from "@/lib/live";
import { useTheme } from "@/lib/theme/provider";
import { Counter, Reveal, Stagger, StaggerItem } from "@/lib/theme/motion";
import { SECTION_ITEMS } from "@/lib/theme/tokens";
import type { OutreachLogEntry, PipelineJob, PipelineOperationalStatus, Stats } from "@/lib/types";

/**
 * Column spans as literal class names, because Tailwind reads the source rather
 * than the running program: a template string like `xl:col-span-${n}` produces
 * no CSS at all.
 */
const SPAN_CLASS: Record<number, string> = {
  4: "xl:col-span-4",
  5: "xl:col-span-5",
  7: "xl:col-span-7",
  12: "xl:col-span-12",
};

const SECTION_SPAN: Record<string, number> = Object.fromEntries(SECTION_ITEMS.map((s) => [s.id, s.span]));

/** Same reason as the spans: the tone has to resolve to a class Tailwind saw. */
const TONE_FILL: Record<string, string> = {
  brand: "bg-brand-600",
  cta: "bg-cta-600",
  rose: "bg-rose-600",
  emerald: "bg-emerald-600",
};

export default function OverviewPage() {
  const { theme } = useTheme();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [operations, setOperations] = useState<PipelineOperationalStatus | null>(null);
  const [starting, setStarting] = useState<PipelineJob["type"] | null>(null);
  const previousActiveJob = useRef<string | null>(null);
  const operationsReady = useRef(false);

  const load = useCallback(() => {
    let cancelled = false;
    api
      .stats()
      .then((next) => {
        if (cancelled) return;
        setStats(next);
        setError(null);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useLiveData(load, 20000);

  const loadOperations = useCallback(async () => {
    try {
      const next = await api.pipelineStatus();
      const completedJob =
        operationsReady.current && previousActiveJob.current && !next.activeJob
          ? next.latestJob
          : null;
      previousActiveJob.current = next.activeJob?._id ?? null;
      operationsReady.current = true;
      setOperations(next);
      if (completedJob) {
        if (completedJob.status === "COMPLETED") {
          toast.success(
            `Pipeline finished: ${completedJob.progress.processed.toLocaleString()} processed, ${completedJob.progress.qualified.toLocaleString()} qualified.`,
          );
        } else {
          toast.error(completedJob.error ?? completedJob.progress.message);
        }
        load();
      }
    } catch {
      // The primary dashboard request already reports API connectivity. Keep
      // background polling quiet during a transient restart.
    }
  }, [load]);

  useEffect(() => {
    void loadOperations();
    const timer = window.setInterval(() => void loadOperations(), operations?.activeJob ? 3000 : 12000);
    return () => window.clearInterval(timer);
  }, [loadOperations, operations?.activeJob]);

  function adoptStartedJob(job: PipelineJob): void {
    previousActiveJob.current = job._id;
    operationsReady.current = true;
    setOperations((current) => ({
      activeJob: job,
      latestJob: job,
      discoveredPending: current?.discoveredPending ?? 0,
      pitchPending: current?.pitchPending ?? 0,
      resumableRun: current?.resumableRun ?? null,
    }));
  }

  async function runPipeline() {
    setStarting("FULL");
    try {
      const { job } = await api.startFullJob();
      adoptStartedJob(job);
      toast.success("Full scan started safely in the background.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Pipeline could not start");
    } finally {
      setStarting(null);
    }
  }

  async function processDiscovered() {
    setStarting("PROCESS");
    try {
      const { job } = await api.startProcessJob();
      adoptStartedJob(job);
      toast.success("Existing discovered leads are now being processed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Processing could not start");
    } finally {
      setStarting(null);
    }
  }

  async function resumeDiscovery() {
    if (!operations?.resumableRun) return;
    setStarting("RESUME_DISCOVERY");
    try {
      const { job } = await api.resumeDiscoveryJob(operations.resumableRun.runId);
      adoptStartedJob(job);
      toast.success(`Retrying ${operations.resumableRun.recoverableQueries} failed or incomplete searches.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Discovery could not resume");
    } finally {
      setStarting(null);
    }
  }

  const insights = useMemo(() => {
    if (!stats) return null;
    const total = Math.max(stats.totals.total, 1);
    const contacted = Math.max(stats.totals.contacted, 1);
    const interested = Math.max(stats.totals.interested, 1);
    return {
      approvalShare: Math.round((stats.totals.pendingApproval / total) * 100),
      interestRate: Math.round((stats.totals.interested / contacted) * 100),
      closeRate: Math.round((stats.totals.converted / interested) * 100),
      averageDeal:
        stats.revenue.convertedDeals > 0 ? Math.round(stats.revenue.totalDealValue / stats.revenue.convertedDeals) : 0,
    };
  }, [stats]);

  if (error) {
    return (
      <div className="page-shell">
        <div className="empty-state mt-10">
          <div className="empty-state-icon text-rose-500">
            <RiErrorWarningLine />
          </div>
          <h1 className="mt-4 font-heading text-xl font-bold">The dashboard cannot reach the API</h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-500">{error}</p>
          <p className="mt-3 text-xs text-slate-400">
            Check API_URL and API_KEY on the dashboard service, and confirm the server is running.
          </p>
        </div>
      </div>
    );
  }

  if (!stats || !insights) return <OverviewSkeleton />;
  const pipelineBusy = Boolean(operations?.activeJob || starting);

  const funnel: Array<[string, number, string]> = [
    ["Discovered", stats.byStage.DISCOVERED ?? stats.totals.total, "/leads?stage=DISCOVERED"],
    ["Pending approval", stats.totals.pendingApproval, "/queue"],
    ["Contacted", stats.totals.contacted, "/leads?outreachStatus=CONTACTED"],
    ["Interested", stats.totals.interested, "/leads?outreachStatus=INTERESTED"],
    ["Converted", stats.totals.converted, "/leads?outreachStatus=CONVERTED"],
  ];
  const funnelMax = Math.max(...funnel.map(([, value]) => value), 1);

  const attention = [
    !stats.integrations.googlePlaces
      ? { title: "Discovery source disconnected", detail: "Google Places is not configured.", href: "/settings", tone: "rose" }
      : null,
    !stats.integrations.ai
      ? { title: "AI pitch writer unavailable", detail: "The engine is using template fallback pitches.", href: "/settings", tone: "cta" }
      : null,
    !stats.integrations.email
      ? { title: "Email delivery unavailable", detail: "Approved email leads cannot be dispatched yet.", href: "/settings", tone: "rose" }
      : null,
    stats.totals.pendingApproval > 0
      ? {
          title: `${stats.totals.pendingApproval} lead${stats.totals.pendingApproval === 1 ? "" : "s"} awaiting review`,
          detail: "Approval is the current pipeline bottleneck.",
          href: "/queue",
          tone: "brand",
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; detail: string; href: string; tone: string }>;

  const websiteMix = Object.entries(stats.byWebsiteType)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);

  /**
   * Every headline figure, keyed by the id the theme orders them with. Adding
   * one here and to METRIC_ITEMS is all it takes for it to become arrangeable.
   */
  const metrics: Record<string, React.ReactNode> = {
    pending: (
      <MetricCard
        icon={<RiInboxArchiveLine />}
        label="Awaiting approval"
        value={stats.totals.pendingApproval}
        context={`${insights.approvalShare}% of all tracked leads`}
        href="/queue"
        accent="accent-brand"
        iconClass="text-brand-600"
      />
    ),
    contacted: (
      <MetricCard
        icon={<RiMailSendLine />}
        label="Contacted"
        value={stats.totals.contacted}
        context={`${insights.interestRate}% became interested`}
        href="/leads?outreachStatus=CONTACTED"
        accent="accent-purple"
        iconClass="text-purple-600"
      />
    ),
    interested: (
      <MetricCard
        icon={<RiEmotionHappyLine />}
        label="Interested"
        value={stats.totals.interested}
        context={`${insights.closeRate}% converted to wins`}
        href="/leads?outreachStatus=INTERESTED"
        accent="accent-emerald"
        iconClass="text-emerald-600"
      />
    ),
    revenue: (
      <MetricCard
        icon={<RiTrophyLine />}
        label="Revenue won"
        value={stats.revenue.totalDealValue}
        prefix="₦"
        context={
          stats.revenue.convertedDeals > 0
            ? `₦${insights.averageDeal.toLocaleString()} average deal`
            : "No converted deals recorded yet"
        }
        accent="accent-cta"
        iconClass="text-cta-500"
      />
    ),
  };

  const visibleMetrics = theme.layout.metricOrder.filter(
    (id) => !theme.layout.metricHidden.includes(id) && metrics[id],
  );

  const sections: Record<string, React.ReactNode> = {
    metrics: visibleMetrics.length > 0 && (
      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {visibleMetrics.map((id) => (
          <StaggerItem key={id} className="min-w-0">
            {metrics[id]}
          </StaggerItem>
        ))}
      </Stagger>
    ),

    funnel: (
      <div className="panel accent-brand border-t-4">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Pipeline funnel</h2>
            <p className="section-description">Current volume and drop-off at each commercial stage.</p>
          </div>
          <span className="status-badge text-brand-600">{stats.totals.converted} wins</span>
        </div>
        <div className="space-y-4">
          {funnel.map(([label, value, href], index) => {
            const previous = index === 0 ? value : funnel[index - 1][1];
            const conversion = index === 0 || previous === 0 ? 100 : Math.round((value / previous) * 100);
            return (
              <Link key={label} href={href} className="group block">
                <div className="flex items-end justify-between gap-4 text-sm">
                  <div>
                    <span className="font-semibold text-slate-700 group-hover:text-brand-600 dark:text-slate-200">{label}</span>
                    {index > 0 && <span className="ml-2 text-xs text-slate-400">{conversion}% from prior stage</span>}
                  </div>
                  <span className="font-heading font-extrabold tabular-nums">{value.toLocaleString()}</span>
                </div>
                <div className="mt-2 h-3 border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                  <div
                    className="h-full bg-brand-600 transition-[width] duration-500 ease-theme"
                    style={{ width: `${Math.max((value / funnelMax) * 100, value > 0 ? 2 : 0)}%` }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    ),

    attention: (
      <div className="panel accent-cta border-t-4">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Needs attention</h2>
            <p className="section-description">Operational blockers and the most valuable next actions.</p>
          </div>
          <RiErrorWarningLine className="h-5 w-5 text-cta-500" />
        </div>
        {attention.length === 0 ? (
          <div className="border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm text-emerald-700 dark:text-emerald-400">
            <p className="font-bold">Operations are healthy</p>
            <p className="mt-1 text-xs opacity-80">Providers are configured and the approval queue is clear.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {attention.map((item) => (
              <Link key={item.title} href={item.href} className="flex items-start gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <span className={`mt-1 h-2 w-2 shrink-0 ${TONE_FILL[item.tone] ?? "bg-brand-600"}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{item.title}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">{item.detail}</span>
                </span>
                <RiArrowRightLine className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              </Link>
            ))}
          </div>
        )}
      </div>
    ),

    discovery: (
      <div className="panel accent-purple border-t-4">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Discovery pulse</h2>
            <p className="section-description">New leads created in the most recent runs.</p>
          </div>
          <RiRadarLine className="h-5 w-5 text-purple-600" />
        </div>
        <RunBars runs={stats.recentRuns} />
        <div className="mt-5 divide-y divide-slate-200 border-t border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {stats.recentRuns.slice(0, 4).map((run) => (
            <div key={run._id} className="flex items-center justify-between gap-3 py-3 text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                {new Date(run.startedAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
              </span>
              <span className="font-bold tabular-nums">+{run.totals.created} new</span>
            </div>
          ))}
          {stats.recentRuns.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No discovery runs yet.</p>}
        </div>
      </div>
    ),

    "website-mix": (
      <div className="panel accent-slate border-t-4">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Website opportunity mix</h2>
            <p className="section-description">The strongest website sales angles in the database.</p>
          </div>
        </div>
        <div className="space-y-3">
          {websiteMix.map(([type, count]) => (
            <Link
              key={type}
              href={`/leads?websiteType=${type}`}
              className="flex items-center gap-3 border-b border-slate-200 pb-3 text-sm last:border-0 last:pb-0 dark:border-slate-800"
            >
              <span className="min-w-0 flex-1 capitalize text-slate-600 hover:text-brand-600 dark:text-slate-300">
                {type.replaceAll("_", " ").toLowerCase()}
              </span>
              <span className="font-heading font-extrabold tabular-nums">{count}</span>
              <span className="w-16 text-right text-xs text-slate-400">
                {Math.round((count / Math.max(stats.totals.total, 1)) * 100)}%
              </span>
            </Link>
          ))}
        </div>
      </div>
    ),

    integrations: (
      <div className="panel accent-emerald border-t-4">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Integration health</h2>
            <p className="section-description">Provider readiness for the complete automation loop.</p>
          </div>
        </div>
        <div className="divide-y divide-slate-200 border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          <IntegrationRow ok={stats.integrations.googlePlaces} label="Google Places discovery" />
          <IntegrationRow ok={stats.integrations.ai} label={`AI writer · ${stats.integrations.aiProvider || "none"}`} />
          <IntegrationRow ok={stats.integrations.email} label={`Email · ${stats.integrations.emailProvider || "none"}`} />
          <IntegrationRow ok={stats.integrations.authEnabled} label="API authentication" />
        </div>
        <Link href="/settings" className="btn-ghost mt-4 w-full">
          Configure integrations <RiArrowRightLine className="h-4 w-4" />
        </Link>
      </div>
    ),

    activity: (
      <div className="panel accent-brand border-t-4">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Recent outreach activity</h2>
            <p className="section-description">The latest approval, delivery, response, and conversion events.</p>
          </div>
          <RiTimeLine className="h-5 w-5 text-brand-600" />
        </div>
        {stats.recentActivity.length === 0 ? (
          <div className="empty-state min-h-48">
            <p className="text-sm font-bold">No outreach activity yet</p>
            <p className="mt-1 text-xs text-slate-400">Approve or contact a lead to begin the activity timeline.</p>
          </div>
        ) : (
          <div className="timeline grid gap-x-8 md:grid-cols-2">
            {stats.recentActivity.slice(0, 10).map((activity) => (
              <ActivityItem key={activity._id} activity={activity} />
            ))}
          </div>
        )}
      </div>
    ),
  };

  const visibleSections = theme.layout.sectionOrder.filter(
    (id) => !theme.layout.sectionHidden.includes(id) && sections[id],
  );

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="page-kicker">Live operations</p>
          <h1 className="page-title">Lead engine overview</h1>
          <p className="page-subtitle">
            {stats.totals.total.toLocaleString()} businesses tracked across the discovery, approval, outreach, and conversion pipeline.
          </p>
        </div>
        <div className="page-actions">
          <Link href="/analytics" className="btn-ghost">
            <RiBarChartBoxLine className="h-4 w-4" /> Analytics
          </Link>
          <Link href="/leads" className="btn-ghost">
            View all leads <RiArrowRightLine className="h-4 w-4" />
          </Link>
          {/*
            One button for both kinds of unfinished work, because one job does
            both. Leads that qualified without a message are the more urgent of
            the two: they are not in the approval queue and nothing else is
            looking for them, so without this they are simply lost.
          */}
          {((operations?.discoveredPending ?? 0) > 0 || (operations?.pitchPending ?? 0) > 0) && (
            <button onClick={processDiscovered} disabled={pipelineBusy} className="btn-ghost">
              {starting === "PROCESS" ? (
                <span className="loader-spinner h-4 w-4 border-2 border-slate-400/40 border-t-slate-600" />
              ) : (
                <RiRestartLine className="h-4 w-4" />
              )}
              {(operations?.pitchPending ?? 0) > 0
                ? `Write ${operations?.pitchPending?.toLocaleString()} pending message${operations?.pitchPending === 1 ? "" : "s"}`
                : `Process ${operations?.discoveredPending.toLocaleString()} discovered`}
            </button>
          )}
          {operations?.resumableRun && (
            <button onClick={resumeDiscovery} disabled={pipelineBusy} className="btn-ghost">
              {starting === "RESUME_DISCOVERY" ? (
                <span className="loader-spinner h-4 w-4 border-2 border-slate-400/40 border-t-slate-600" />
              ) : (
                <RiRestartLine className="h-4 w-4" />
              )}
              Resume {operations.resumableRun.recoverableQueries} searches
            </button>
          )}
          <button onClick={runPipeline} disabled={pipelineBusy || !stats.integrations.googlePlaces} className="btn-primary">
            {starting === "FULL" || operations?.activeJob ? (
              <span className="loader-spinner h-4 w-4 border-2 border-white/40 border-t-white" />
            ) : (
              <RiPlayCircleLine className="h-5 w-5" />
            )}
            {operations?.activeJob ? "Running…" : "Run full scan"}
          </button>
        </div>
      </header>

      {operations?.activeJob && <PipelineProgress job={operations.activeJob} />}

      {/*
        A scan that ended badly has to say so on the page, not only in a toast
        that has already gone. Reloading used to show nothing at all, which
        reads as "everything is fine" when it is not.
      */}
      {!operations?.activeJob &&
        (operations?.latestJob?.status === "FAILED" || operations?.latestJob?.status === "PARTIAL") && (
          <section className="panel accent-cta mt-6 border-t-4" role="status">
            <div className="section-heading">
              <div className="min-w-0">
                <h2 className="section-title">
                  {operations.latestJob.status === "FAILED" ? "The last scan did not finish" : "The last scan finished with problems"}
                </h2>
                <p className="section-description break-words">
                  {operations.latestJob.error ?? operations.latestJob.progress.message}
                </p>
              </div>
              <RiErrorWarningLine className="h-5 w-5 shrink-0 text-cta-500" />
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <ProgressValue label="Found" value={operations.latestJob.progress.found} />
              <ProgressValue label="Created" value={operations.latestJob.progress.created} />
              <ProgressValue label="Processed" value={operations.latestJob.progress.processed} />
              <ProgressValue label="Qualified" value={operations.latestJob.progress.qualified} />
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Nothing found so far was lost. Use the actions above to retry the searches that failed, or to finish
              processing the leads that were already found.
            </p>
          </section>
        )}

      <div className="mt-8 grid items-start gap-6 xl:grid-cols-12">
        {visibleSections.map((id) => (
          <Reveal key={id} className={`min-w-0 ${SPAN_CLASS[SECTION_SPAN[id] ?? 12] ?? "xl:col-span-12"}`}>
            {sections[id]}
          </Reveal>
        ))}
      </div>
    </div>
  );
}

function PipelineProgress({ job }: { job: PipelineJob }) {
  const total = Math.max(job.progress.total, 1);
  const percent = Math.min(100, Math.round((job.progress.current / total) * 100));
  const phase =
    job.phase === "DISCOVERY"
      ? "Discovering businesses"
      : job.phase === "PROCESSING"
        ? "Auditing and scoring leads"
        : "Preparing pipeline";

  return (
    <section className="panel accent-purple mt-6 overflow-hidden border-t-4" aria-live="polite">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="loader-spinner h-4 w-4 shrink-0 border-2 border-purple-200 border-t-purple-600" />
            <p className="font-heading text-sm font-extrabold text-slate-800 dark:text-white">{phase}</p>
          </div>
          <p className="mt-1 break-words text-xs text-slate-500 dark:text-slate-400">{job.progress.message}</p>
        </div>
        <p className="shrink-0 font-heading text-2xl font-extrabold tabular-nums text-purple-600">{percent}%</p>
      </div>
      <div className="mt-4 h-3 overflow-hidden border border-purple-200 bg-purple-50 dark:border-purple-900 dark:bg-purple-950/30">
        <div className="h-full bg-purple-600 transition-[width] duration-500" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <ProgressValue label="Found" value={job.progress.found} />
        <ProgressValue label="Created" value={job.progress.created} />
        <ProgressValue label="Processed" value={job.progress.processed} />
        <ProgressValue label="Qualified" value={job.progress.qualified} />
      </div>
      {(job.progress.failedQueries > 0 || job.progress.processingErrors > 0 || job.progress.aiFallbacks > 0) && (
        <p className="mt-3 text-xs font-semibold text-amber-700 dark:text-amber-400">
          {job.progress.failedQueries > 0
            ? `${job.progress.failedQueries} search${job.progress.failedQueries === 1 ? "" : "es"} will remain resumable.`
            : ""}
          {job.progress.failedQueries > 0 && job.progress.processingErrors > 0 ? " " : ""}
          {job.progress.processingErrors > 0
            ? `${job.progress.processingErrors} lead${job.progress.processingErrors === 1 ? "" : "s"} can be processed again.`
            : ""}
          {(job.progress.failedQueries > 0 || job.progress.processingErrors > 0) && job.progress.aiFallbacks > 0
            ? " "
            : ""}
          {job.progress.aiFallbacks > 0
            ? `${job.progress.aiFallbacks} AI pitch${job.progress.aiFallbacks === 1 ? "" : "es"} used the safe template fallback.`
            : ""}
        </p>
      )}
    </section>
  );
}

function ProgressValue({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 border border-slate-200 p-3 dark:border-slate-800">
      <p className="truncate text-slate-400">{label}</p>
      <p className="mt-1 font-heading text-lg font-extrabold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  prefix,
  context,
  href,
  accent,
  iconClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  prefix?: string;
  context: string;
  href?: string;
  accent: string;
  iconClass: string;
}) {
  const content = (
    <div className={`metric-card ${accent} h-full ${href ? "hover:bg-slate-50 dark:hover:bg-slate-800/60" : ""}`}>
      <span className={`metric-icon ${iconClass}`}>{icon}</span>
      <p className="metric-value">
        <Counter value={value} prefix={prefix} />
      </p>
      <p className="metric-label">{label}</p>
      <p className="metric-context">{context}</p>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

function RunBars({ runs }: { runs: Stats["recentRuns"] }) {
  const data = [...runs].slice(0, 8).reverse();
  const max = Math.max(...data.map((run) => run.totals.created), 1);
  if (data.length === 0) return <div className="skeleton-block h-28" />;
  return (
    <div className="flex h-28 items-end gap-2 border-b border-l border-slate-300 px-2 pt-2 dark:border-slate-700" aria-label="Recent discovery run lead creation chart">
      {data.map((run) => (
        <div key={run._id} className="group flex min-w-0 flex-1 flex-col items-center justify-end">
          <span className="mb-1 text-[10px] font-bold tabular-nums opacity-0 group-hover:opacity-100">{run.totals.created}</span>
          <span className="w-full bg-purple-600" style={{ height: `${Math.max((run.totals.created / max) * 100, run.totals.created > 0 ? 6 : 2)}%` }} />
        </div>
      ))}
    </div>
  );
}

function IntegrationRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 p-3 text-sm">
      {ok ? (
        <RiCheckboxCircleFill className="h-5 w-5 shrink-0 text-emerald-500" />
      ) : (
        <RiCloseCircleFill className="h-5 w-5 shrink-0 text-rose-500" />
      )}
      <span className={`min-w-0 flex-1 ${ok ? "font-semibold" : "text-slate-500"}`}>{label}</span>
      <span className={`text-[10px] font-extrabold uppercase tracking-wider ${ok ? "text-emerald-600" : "text-rose-500"}`}>
        {ok ? "Ready" : "Action"}
      </span>
    </div>
  );
}

function ActivityItem({ activity }: { activity: OutreachLogEntry }) {
  const lead = typeof activity.leadId === "object" ? activity.leadId : null;
  const content = (
    <div className="timeline-item">
      <p className="text-sm font-bold capitalize">{activity.action.replaceAll("_", " ").toLowerCase()}</p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        {lead?.businessName ?? "Lead activity"} · {activity.channel}
      </p>
      <p className="mt-1 text-[11px] text-slate-400">{new Date(activity.createdAt).toLocaleString("en-NG")}</p>
    </div>
  );
  return lead?._id ? <Link href={`/leads/${lead._id}`}>{content}</Link> : content;
}

function OverviewSkeleton() {
  return (
    <div className="page-shell">
      <div className="skeleton-block h-28" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="skeleton-block h-40" />
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="skeleton-block h-96" />
        <div className="skeleton-block h-96" />
      </div>
    </div>
  );
}
