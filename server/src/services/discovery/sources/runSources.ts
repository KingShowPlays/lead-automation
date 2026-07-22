import { getSourcesRuntime } from "../../../config/runtime.js";
import { logger } from "../../../utils/logger.js";
import { upsertIncomingLead, type UpsertOutcome } from "../../pipeline/runPipeline.js";
import { crawlDirectories } from "./directoryCrawler.js";
import type { IncomingLead } from "../../../types.js";

/**
 * Runs the optional, toggle-gated discovery sources (everything except Google
 * Places, which keeps its own path). Each source only ADDS leads through the
 * shared upsert, so enabling one never interferes with the others or with
 * Places. Disabled sources are skipped entirely.
 */

export interface SourceRunStats {
  source: string;
  found: number;
  created: number;
  duplicates: number;
  suppressed: number;
  errors: number;
}

async function upsertBatch(source: string, leads: IncomingLead[]): Promise<SourceRunStats> {
  const stats: SourceRunStats = { source, found: leads.length, created: 0, duplicates: 0, suppressed: 0, errors: 0 };
  for (const lead of leads) {
    try {
      const outcome: UpsertOutcome = await upsertIncomingLead(lead);
      stats[outcome]++;
    } catch (err) {
      stats.errors++;
      logger.error({ err: String(err), source, business: lead.businessName }, "source upsert failed");
    }
  }
  return stats;
}

/** Runs every enabled non-Places source. Safe to call even if none are on. */
export async function runExtraSources(): Promise<SourceRunStats[]> {
  const sources = await getSourcesRuntime();
  const runs: SourceRunStats[] = [];

  if (sources.directory.enabled && sources.directory.urls.length > 0) {
    try {
      const crawl = await crawlDirectories({
        urls: sources.directory.urls,
        defaultCity: sources.directory.defaultCity,
        defaultCategory: sources.directory.defaultCategory,
        maxPerRun: sources.directory.maxPerRun,
      });
      const stats = await upsertBatch("directory", crawl.leads);
      stats.errors += crawl.errors.length;
      runs.push(stats);
      logger.info({ ...stats, pages: crawl.pagesFetched }, "directory source finished");
    } catch (err) {
      logger.error({ err: String(err) }, "directory source failed");
      runs.push({ source: "directory", found: 0, created: 0, duplicates: 0, suppressed: 0, errors: 1 });
    }
  }

  return runs;
}

export interface ImportResult {
  received: number;
  created: number;
  duplicates: number;
  suppressed: number;
  invalid: number;
  errors: Array<{ businessName: string; error: string }>;
}

/**
 * Manual / bulk import. This is the practical answer to lagging sources like
 * Google Places: a person or VA who spots a brand-new business (on Instagram,
 * at a market, via a referral or a CAC lookup) drops it in here and it flows
 * through the same enrich -> score -> pitch -> approval pipeline.
 */
export async function importLeads(
  items: Array<Partial<IncomingLead> & { businessName?: string }>,
  defaults: { city?: string; category?: string } = {},
): Promise<ImportResult> {
  const result: ImportResult = { received: items.length, created: 0, duplicates: 0, suppressed: 0, invalid: 0, errors: [] };

  for (const raw of items) {
    const businessName = raw.businessName?.trim();
    if (!businessName) {
      result.invalid++;
      continue;
    }
    const emailRaw = raw.email?.trim().toLowerCase();
    const email = emailRaw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) ? emailRaw : undefined;
    const lead: IncomingLead = {
      businessName,
      category: raw.category?.trim() || defaults.category || "business",
      city: raw.city?.trim() || defaults.city || "Unknown",
      email,
      phone: raw.phone?.trim() || undefined,
      instagramUsername: raw.instagramUsername?.trim() || undefined,
      websiteUrl: raw.websiteUrl?.trim() || undefined,
      address: raw.address?.trim() || undefined,
      openingSoon: raw.openingSoon ?? false,
      discoverySource: "manual_import",
      sourceUrl: raw.sourceUrl,
    };
    try {
      const outcome = await upsertIncomingLead(lead);
      result[outcome]++;
    } catch (err) {
      result.errors.push({ businessName, error: err instanceof Error ? err.message : String(err) });
    }
  }

  logger.info(result, "manual import complete");
  return result;
}
