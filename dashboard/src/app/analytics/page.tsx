"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  RiArrowRightLine,
  RiBarChartBoxLine,
  RiContactsBook2Line,
  RiErrorWarningLine,
  RiPulseLine,
  RiRefreshLine,
  RiTimeLine,
  RiTrophyLine,
} from "react-icons/ri";
import { api } from "@/lib/api";
import type { AnalyticsStats } from "@/lib/types";

const WINDOWS = [
  [7, "7 days"],
  [30, "30 days"],
  [90, "90 days"],
  [365, "1 year"],
  ["all", "All time"],
] as const;

export default function AnalyticsPage() {
  const [days, setDays] = useState<number | "all">(30);
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await api.analytics(days));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load analytics");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const derived = useMemo(() => {
    if (!stats) return null;
    const total = Math.max(stats.totals.total, 1);
    const contacted = Math.max(stats.totals.contacted, 1);
    const interested = Math.max(stats.totals.interested, 1);
    return {
      qualificationRate: Math.round((stats.totals.qualified / total) * 100),
      contactableRate: Math.round((stats.totals.contactableAny / total) * 100),
      freshnessRate: Math.round(((stats.totals.newBusinesses + stats.totals.emergingBusinesses) / total) * 100),
      interestRate: Math.round((stats.totals.interested / contacted) * 100),
      closeRate: Math.round((stats.totals.converted / interested) * 100),
    };
  }, [stats]);

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="page-kicker">Decision intelligence</p>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">
            Understand where the strongest opportunities come from, how fresh they are, and where the commercial funnel needs attention.
          </p>
        </div>
        <div className="page-actions">
          <button type="button" onClick={() => void load()} disabled={loading} className="btn-ghost">
            <RiRefreshLine className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <Link href="/leads" className="btn-primary">Work the leads <RiArrowRightLine /></Link>
        </div>
      </header>

      <div className="toolbar justify-between">
        <div>
          <p className="text-sm font-bold">Reporting window</p>
          <p className="text-xs text-slate-500">Lead cohorts use the date each business entered the system.</p>
        </div>
        <div className="segmented-control max-w-full overflow-x-auto" aria-label="Analytics date range">
          {WINDOWS.map(([value, label]) => (
            <button key={value} type="button" aria-pressed={days === value} onClick={() => setDays(value)}>{label}</button>
          ))}
        </div>
      </div>

      {error && (
        <div className="empty-state mt-6 min-h-52">
          <div className="empty-state-icon text-rose-500"><RiErrorWarningLine /></div>
          <h2 className="mt-4 font-heading text-lg font-extrabold">Analytics could not load</h2>
          <p className="mt-2 text-sm text-rose-500">{error}</p>
        </div>
      )}

      {!stats && !error && <AnalyticsSkeleton />}

      {stats && derived && (
        <div className={loading ? "opacity-60" : ""} aria-busy={loading}>
          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <AnalyticsMetric icon={<RiBarChartBoxLine />} label="Qualified opportunities" value={stats.totals.qualified} context={`${derived.qualificationRate}% of this cohort`} href={`/leads?minScore=${stats.qualificationThreshold}`} accent="accent-brand" />
            <AnalyticsMetric icon={<RiPulseLine />} label="Average priority" value={stats.scores.averagePriority} context={`Need ${stats.scores.averageNeed} · reach ${stats.scores.averageReach}`} accent="accent-cta" />
            <AnalyticsMetric icon={<RiTimeLine />} label="New or emerging" value={stats.totals.newBusinesses + stats.totals.emergingBusinesses} context={`${derived.freshnessRate}% of this cohort`} href="/leads?maturity=NEW,EMERGING" accent="accent-purple" />
            <AnalyticsMetric icon={<RiContactsBook2Line />} label="Contactable now" value={stats.totals.contactableAny} context={`${derived.contactableRate}% have a route`} href="/leads?contactable=any" accent="accent-emerald" />
            <AnalyticsMetric icon={<RiTrophyLine />} label="Revenue won" value={`₦${stats.revenue.totalDealValue.toLocaleString()}`} context={`${stats.revenue.convertedDeals} converted deals`} accent="accent-slate" />
          </section>

          <section className="mt-6 grid items-start gap-6 xl:grid-cols-12">
            <div className="panel accent-brand border-t-4 xl:col-span-7">
              <PanelHeading title="Lead quality" description="Need qualifies a lead; reach only changes the order in which you work it." />
              <div className="grid gap-7 md:grid-cols-2">
                <Distribution title="Need score distribution" values={stats.scores.needBuckets} total={stats.totals.total} />
                <Distribution title="Reach score distribution" values={stats.scores.reachBuckets} total={stats.totals.total} tone="emerald" />
              </div>
            </div>
            <div className="panel accent-purple border-t-4 xl:col-span-5">
              <PanelHeading title="Business freshness" description="Review volume and first-seen signals reveal businesses still making early decisions." />
              <Distribution
                values={stats.byMaturity}
                total={stats.totals.total}
                hrefFor={(key) => `/leads?maturity=${encodeURIComponent(key)}`}
                tone="purple"
              />
              <div className="mt-5 grid grid-cols-3 border border-slate-200 text-center dark:border-slate-800">
                <MiniMetric label="New to Google" value={stats.totals.newToGoogle} href="/leads?newToGoogle=true" />
                <MiniMetric label="Opening soon" value={stats.totals.openingSoon} href="/leads?openingSoon=true" />
                <MiniMetric label="Rising activity" value={stats.totals.risingActivity} href="/leads?minRatingVelocity=2" />
              </div>
            </div>
          </section>

          <section className="mt-6 grid items-start gap-6 lg:grid-cols-3">
            <div className="panel accent-emerald border-t-4">
              <PanelHeading title="Contactability" description="Actionable coverage first, then every available outreach channel." />
              <Distribution
                values={{
                  "Contactable now": stats.contactability.any,
                  "Needs research": stats.contactability.none,
                }}
                total={stats.totals.total}
                hrefFor={(key) => `/leads?contactable=${key === "Contactable now" ? "any" : "none"}`}
                tone="emerald"
              />
              <div className="mt-5 grid grid-cols-2 gap-2">
                {(["email", "phone", "whatsapp", "instagram"] as const).map((channel) => (
                  <ChannelMetric
                    key={channel}
                    channel={channel}
                    value={stats.contactability[channel]}
                    total={stats.totals.total}
                  />
                ))}
              </div>
              <p className="mt-2 text-[10px] text-slate-400">Channel coverage can overlap when a lead has more than one contact route.</p>
            </div>
            <div className="panel accent-cta border-t-4">
              <PanelHeading title="Discovery sources" description="Compare the volume contributed by Places, imports, and directories." />
              <Distribution
                values={stats.bySource}
                total={stats.totals.total}
                hrefFor={(key) => `/leads?source=${encodeURIComponent(key)}`}
                tone="cta"
              />
            </div>
            <div className="panel accent-slate border-t-4">
              <PanelHeading title="Website opportunities" description="The sales angle found during website classification." />
              <Distribution
                values={stats.byWebsiteType}
                total={stats.totals.total}
                hrefFor={(key) => `/leads?websiteType=${encodeURIComponent(key)}`}
              />
            </div>
          </section>

          <section className="mt-6 grid items-start gap-6 xl:grid-cols-12">
            <div className="panel accent-brand border-t-4 xl:col-span-4">
              <PanelHeading title="Top cities" description="Where the current lead cohort is concentrated." />
              <Distribution values={stats.byCity} total={stats.totals.total} limit={8} hrefFor={(key) => `/leads?city=${encodeURIComponent(key)}`} />
            </div>
            <div className="panel accent-purple border-t-4 xl:col-span-4">
              <PanelHeading title="Top categories" description="Business segments producing the most opportunities." />
              <Distribution values={stats.byCategory} total={stats.totals.total} limit={8} hrefFor={(key) => `/leads?category=${encodeURIComponent(key)}`} tone="purple" />
            </div>
            <div className="panel accent-emerald border-t-4 xl:col-span-4">
              <PanelHeading title="Commercial outcomes" description="Conversion rates for leads discovered in this reporting window." />
              <FunnelRow label="Tracked leads" value={stats.totals.total} percent={100} />
              <FunnelRow label="Contacted" value={stats.totals.contacted} percent={Math.round((stats.totals.contacted / Math.max(stats.totals.total, 1)) * 100)} />
              <FunnelRow label="Interested" value={stats.totals.interested} percent={derived.interestRate} suffix="of contacted" />
              <FunnelRow label="Converted" value={stats.totals.converted} percent={derived.closeRate} suffix="of interested" />
            </div>
          </section>

          <section className="panel accent-cta mt-6 border-t-4">
            <PanelHeading title="Discovery run efficiency" description="Found, created, duplicate, suppressed, processed, and qualified volume for every run in the selected window." />
            {stats.recentRuns.length === 0 ? (
              <p className="border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400 dark:border-slate-700">No discovery runs in this period.</p>
            ) : (
              <>
                <div className="desktop-table table-shell !mt-0">
                  <table className="data-table min-w-[860px]">
                    <thead><tr><th>Run</th><th>Found</th><th>Created</th><th>Duplicates</th><th>Suppressed</th><th>Processed</th><th>Qualified</th><th>Yield</th></tr></thead>
                    <tbody>
                      {stats.recentRuns.map((run) => {
                        const rate = Math.round((run.totals.qualified / Math.max(run.totals.processed, 1)) * 100);
                        return (
                          <tr key={run._id}>
                            <td><strong>{new Date(run.startedAt).toLocaleDateString("en-NG")}</strong><p className="text-[11px] uppercase text-slate-400">{run.trigger} · {run.status}</p></td>
                            <td>{run.totals.found.toLocaleString()}</td>
                            <td>{run.totals.created.toLocaleString()}</td>
                            <td>{run.totals.duplicates.toLocaleString()}</td>
                            <td>{run.totals.suppressed.toLocaleString()}</td>
                            <td>{run.totals.processed.toLocaleString()}</td>
                            <td>{run.totals.qualified.toLocaleString()}</td>
                            <td className="font-bold">{rate}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mobile-record-list">
                  {stats.recentRuns.map((run) => (
                    <article key={run._id} className="mobile-record">
                      <div className="flex items-center justify-between gap-3">
                        <strong>{new Date(run.startedAt).toLocaleDateString("en-NG")}</strong>
                        <span className="status-badge text-cta-500">{Math.round((run.totals.qualified / Math.max(run.totals.processed, 1)) * 100)}% yield</span>
                      </div>
                      <div className="mobile-record-grid">
                        <RunMetric label="Found" value={run.totals.found} />
                        <RunMetric label="Created" value={run.totals.created} />
                        <RunMetric label="Processed" value={run.totals.processed} />
                        <RunMetric label="Qualified" value={run.totals.qualified} />
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function AnalyticsMetric({ icon, label, value, context, accent, href }: { icon: React.ReactNode; label: string; value: number | string; context: string; accent: string; href?: string }) {
  const card = (
    <div className={`metric-card ${accent} h-full`}>
      <span className="metric-icon text-brand-600">{icon}</span>
      <p className="metric-value break-words">{typeof value === "number" ? value.toLocaleString() : value}</p>
      <p className="metric-label">{label}</p>
      <p className="metric-context">{context}</p>
    </div>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

function PanelHeading({ title, description }: { title: string; description: string }) {
  return <div className="section-heading"><div><h2 className="section-title">{title}</h2><p className="section-description">{description}</p></div></div>;
}

function Distribution({ title, values, total, hrefFor, tone = "brand", limit = 10 }: { title?: string; values: Record<string, number>; total: number; hrefFor?: (key: string) => string; tone?: "brand" | "purple" | "emerald" | "cta"; limit?: number }) {
  const rows = Object.entries(values).sort(([, a], [, b]) => b - a).slice(0, limit);
  const maximum = Math.max(...rows.map(([, value]) => value), 1);
  const colors = { brand: "bg-brand-600", purple: "bg-purple-600", emerald: "bg-emerald-600", cta: "bg-cta-500" };
  return (
    <div>
      {title && <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate-500">{title}</h3>}
      <div className="space-y-3">
        {rows.map(([key, value]) => {
          const body = (
            <>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 truncate font-semibold capitalize">{key.replaceAll("_", " ").toLowerCase()}</span>
                <span className="shrink-0 font-extrabold tabular-nums">{value.toLocaleString()} <span className="font-normal text-slate-400">· {Math.round((value / Math.max(total, 1)) * 100)}%</span></span>
              </div>
              <div className="mt-1.5 h-2 bg-slate-100 dark:bg-slate-800"><div className={`h-full ${colors[tone]}`} style={{ width: `${Math.max((value / maximum) * 100, value ? 2 : 0)}%` }} /></div>
            </>
          );
          return hrefFor ? <Link key={key} href={hrefFor(key)} className="block hover:text-brand-600">{body}</Link> : <div key={key}>{body}</div>;
        })}
        {rows.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No data in this period.</p>}
      </div>
    </div>
  );
}

function MiniMetric({ label, value, href }: { label: string; value: number; href: string }) {
  return <Link href={href} className="min-w-0 border-r border-slate-200 p-3 last:border-r-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"><strong className="block font-heading text-xl tabular-nums">{value}</strong><span className="mt-1 block text-[9px] font-extrabold uppercase tracking-wider text-slate-400">{label}</span></Link>;
}

function ChannelMetric({
  channel,
  value,
  total,
}: {
  channel: "email" | "phone" | "whatsapp" | "instagram";
  value: number;
  total: number;
}) {
  return (
    <Link
      href={`/leads?contactable=${channel}`}
      className="border border-slate-200 p-3 hover:border-brand-500 hover:text-brand-600 dark:border-slate-800"
    >
      <strong className="block font-heading text-lg tabular-nums">{value.toLocaleString()}</strong>
      <span className="mt-1 block text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
        {channel} · {Math.round((value / Math.max(total, 1)) * 100)}%
      </span>
    </Link>
  );
}

function FunnelRow({ label, value, percent, suffix }: { label: string; value: number; percent: number; suffix?: string }) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-end justify-between gap-3 text-sm"><span className="font-semibold">{label}</span><strong className="font-heading tabular-nums">{value.toLocaleString()}</strong></div>
      <div className="mt-1.5 h-2 bg-slate-100 dark:bg-slate-800"><div className="h-full bg-emerald-600" style={{ width: `${Math.min(percent, 100)}%` }} /></div>
      <p className="mt-1 text-[10px] text-slate-400">{percent}% {suffix ?? "of cohort"}</p>
    </div>
  );
}

function RunMetric({ label, value }: { label: string; value: number }) {
  return <div><span className="mobile-record-label">{label}</span><strong className="font-heading tabular-nums">{value.toLocaleString()}</strong></div>;
}

function AnalyticsSkeleton() {
  return <div className="mt-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{[...Array(5)].map((_, index) => <div key={index} className="skeleton-block h-40" />)}</div><div className="mt-6 grid gap-6 lg:grid-cols-2"><div className="skeleton-block h-96" /><div className="skeleton-block h-96" /></div></div>;
}
