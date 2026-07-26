import type {
  ImportResult,
  ImportRow,
  AnalyticsStats,
  IntegrationStatus,
  Lead,
  OutreachLogEntry,
  PipelineJob,
  PipelineOperationalStatus,
  Settings,
  Stats,
  SuppressionEntry,
  TestResult,
} from "./types";

/**
 * Every call goes through the dashboard's own server, which attaches the API
 * key out of reach of the browser. Nothing here may read NEXT_PUBLIC_API_KEY:
 * Next inlines those into the client bundle, which is how the key used to leak.
 */
const API_BASE = "/api/proxy";

import { announceDataChange } from "./live";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  // Paths are written as /api/... against the server; the proxy re-adds that
  // prefix on the far side, so strip it here rather than at every call site.
  const res = await fetch(`${API_BASE}${path.replace(/^\/api/, "")}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });

  // A session that expired while the tab was open should send the operator to
  // sign in again rather than showing a wall of failed requests.
  if (res.status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, (body as { error?: string }).error ?? `Request failed (${res.status})`);
  }

  // Any successful write changes what every other view is showing. Announcing
  // it here means no call site can forget to, which is how counters drift.
  if (init.method && init.method !== "GET") announceDataChange();

  return body as T;
}

export const api = {
  stats: () => req<Stats>("/api/stats"),
  analytics: (days: number | "all") => req<AnalyticsStats>(`/api/stats/analytics?days=${days}`),

  leads: (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") qs.set(k, String(v));
    }
    return req<{ items: Lead[]; total: number; page: number; pages: number }>(`/api/leads?${qs}`);
  },

  lead: (id: string) => req<{ lead: Lead; history: OutreachLogEntry[] }>(`/api/leads/${id}`),

  updateLead: (id: string, patch: Record<string, unknown>) =>
    req<{ lead: Lead }>(`/api/leads/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),

  approve: (id: string, notes?: string) =>
    req<{
      lead: Lead;
      draft: { draftId: string | null; provider: string; internal: boolean } | null;
      draftError: string | null;
    }>(`/api/leads/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ notes }),
    }),

  reject: (id: string, notes?: string) =>
    req<{ lead: Lead }>(`/api/leads/${id}/reject`, { method: "POST", body: JSON.stringify({ notes }) }),

  send: (id: string) => req<{ lead: Lead }>(`/api/leads/${id}/send`, { method: "POST", body: "{}" }),

  markContacted: (id: string, channel?: "INSTAGRAM_MANUAL" | "WHATSAPP") =>
    req<{ lead: Lead }>(`/api/leads/${id}/mark-contacted`, { method: "POST", body: JSON.stringify({ channel }) }),

  recordResponse: (id: string, status: string, note?: string, estimatedDealValue?: number) =>
    req<{ lead: Lead }>(`/api/leads/${id}/response`, {
      method: "POST",
      body: JSON.stringify({ status, note, estimatedDealValue }),
    }),

  convert: (id: string, dealValue?: number) =>
    req<{ lead: Lead }>(`/api/leads/${id}/convert`, { method: "POST", body: JSON.stringify({ dealValue }) }),

  optOut: (id: string, reason?: string) =>
    req<{ lead: Lead }>(`/api/leads/${id}/opt-out`, { method: "POST", body: JSON.stringify({ reason }) }),

  recheck: (id: string) => req<{ lead: Lead }>(`/api/leads/${id}/recheck`, { method: "POST", body: "{}" }),

  regeneratePitch: (id: string) =>
    req<{
      lead: Lead;
      pitch: { provider: string; model: string; fallbackReason?: string };
    }>(`/api/leads/${id}/regenerate-pitch`, { method: "POST", body: "{}" }),

  runDiscovery: (cities?: string[], categories?: string[]) =>
    req<{ runId: string; found: number; created: number }>(`/api/pipeline/discover`, {
      method: "POST",
      body: JSON.stringify({ cities, categories }),
    }),

  runProcess: () => req<{ processed: number; qualified: number }>(`/api/pipeline/process`, { method: "POST", body: "{}" }),

  runSources: () =>
    req<{ sources: Array<{ source: string; found: number; created: number }>; processing: { qualified: number } }>(
      `/api/pipeline/discover-sources`,
      { method: "POST", body: "{}" },
    ),

  importLeads: (items: ImportRow[], opts: { city?: string; category?: string } = {}) =>
    req<ImportResult>(`/api/pipeline/import`, {
      method: "POST",
      body: JSON.stringify({ items, city: opts.city, category: opts.category, process: true }),
    }),

  completeOnboarding: (complete: boolean) =>
    req<{ onboardedAt: string | null }>(`/api/settings/onboarding`, {
      method: "POST",
      body: JSON.stringify({ complete }),
    }),

  runFull: () =>
    req<{ found: number; created: number; processed: number; qualified: number }>(`/api/pipeline/run`, {
      method: "POST",
      body: "{}",
    }),

  startFullJob: () =>
    req<{ job: PipelineJob }>(`/api/pipeline/jobs/full`, {
      method: "POST",
      body: "{}",
    }),

  startProcessJob: () =>
    req<{ job: PipelineJob }>(`/api/pipeline/jobs/process`, {
      method: "POST",
      body: "{}",
    }),

  resumeDiscoveryJob: (runId: string) =>
    req<{ job: PipelineJob }>(`/api/pipeline/runs/${runId}/resume`, {
      method: "POST",
      body: "{}",
    }),

  pipelineStatus: () => req<PipelineOperationalStatus>(`/api/pipeline/jobs/status`),

  pipelineJob: (id: string) => req<{ job: PipelineJob }>(`/api/pipeline/jobs/${id}`),

  suppression: (page = 1) => req<{ items: SuppressionEntry[]; total: number; pages: number }>(`/api/suppression?page=${page}`),

  addSuppression: (type: string, value: string, reason?: string) =>
    req<{ entry: SuppressionEntry; affectedLeads: number }>(`/api/suppression`, {
      method: "POST",
      body: JSON.stringify({ type, value, reason }),
    }),

  deleteSuppression: (id: string) => req<{ deleted: boolean }>(`/api/suppression/${id}`, { method: "DELETE" }),

  settings: () => req<{ settings: Settings }>(`/api/settings`),

  updateSettings: (patch: Record<string, unknown>) =>
    req<{ settings: Settings }>(`/api/settings`, { method: "PUT", body: JSON.stringify(patch) }),

  integrationStatus: () => req<IntegrationStatus>(`/api/settings/integrations`),

  testAi: () => req<TestResult>(`/api/settings/test-ai`, { method: "POST", body: "{}" }),
  testEmail: () => req<TestResult>(`/api/settings/test-email`, { method: "POST", body: "{}" }),
  testPlaces: () => req<TestResult>(`/api/settings/test-places`, { method: "POST", body: "{}" }),
};

export { ApiError };
