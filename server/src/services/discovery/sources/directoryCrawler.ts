import * as cheerio from "cheerio";
import { extractDomain, normalizeUrl } from "../../../utils/url.js";
import type { IncomingLead } from "../../../types.js";

/**
 * Directory / sitemap crawler source.
 *
 * The operator points this at one or more public listing pages or sitemaps
 * that catalogue businesses (a local directory, a marketplace of storefronts,
 * a "new this month" page). We pull candidate outbound business links, then
 * the existing website checker + enrichment classify and score each one, so
 * this coexists with Google Places rather than replacing it.
 *
 * This module is deliberately generic: it does not hardcode any single site,
 * because directory HTML changes and site terms differ. Extraction is pure
 * over the fetched text, which keeps it unit-testable.
 */

const HOST_BLOCKLIST = [
  // Aggregators/platforms that are not the businesses themselves.
  "google.", "facebook.", "instagram.", "twitter.", "x.com", "youtube.", "tiktok.",
  "wikipedia.", "linkedin.", "pinterest.", "wa.me", "whatsapp.", "t.me",
  "gravatar.", "gstatic.", "googleapis.", "cloudflare.", "jsdelivr.", "fontawesome.",
  "w3.org", "schema.org", "apple.com", "microsoft.com",
];

/** Extracts candidate business homepage URLs from a sitemap XML string. */
export function extractSitemapUrls(xml: string): string[] {
  const out: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1].trim());
  return out;
}

/** Extracts candidate outbound business links from a directory HTML page. */
export function extractDirectoryLinks(html: string, pageUrl: string): Array<{ url: string; name?: string }> {
  const $ = cheerio.load(html);
  const pageHost = safeHost(pageUrl);
  const seen = new Set<string>();
  const out: Array<{ url: string; name?: string }> = [];

  $("a[href]").each((_i, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    let abs: string;
    try {
      abs = new URL(href, pageUrl).toString();
    } catch {
      return;
    }
    if (!/^https?:\/\//i.test(abs)) return;
    const host = safeHost(abs);
    if (!host) return;
    // Skip same-directory internal navigation and known non-business hosts.
    if (host === pageHost) return;
    if (HOST_BLOCKLIST.some((b) => host.includes(b))) return;
    const key = host.replace(/^www\./, "");
    if (seen.has(key)) return;
    seen.add(key);
    const name = $(el).text().replace(/\s+/g, " ").trim() || undefined;
    out.push({ url: abs, name: name && name.length <= 80 ? name : undefined });
  });

  return out;
}

function safeHost(u: string): string {
  try {
    return new URL(u).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** Turns a raw domain into a readable business-name guess. */
export function nameFromDomain(url: string): string {
  const domain = extractDomain(url) ?? url;
  const core = domain.replace(/^www\./, "").split(".")[0] ?? domain;
  return core
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export interface DirectoryCrawlOptions {
  urls: string[];
  defaultCity: string;
  defaultCategory: string;
  maxPerRun: number;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface DirectoryCrawlResult {
  leads: IncomingLead[];
  pagesFetched: number;
  errors: Array<{ url: string; error: string }>;
}

/** Fetches each configured URL, extracts candidate businesses, dedupes by domain. */
export async function crawlDirectories(opts: DirectoryCrawlOptions): Promise<DirectoryCrawlResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 15000;
  const result: DirectoryCrawlResult = { leads: [], pagesFetched: 0, errors: [] };
  const seenDomains = new Set<string>();

  for (const rawUrl of opts.urls) {
    const url = normalizeUrl(rawUrl);
    if (!url) {
      result.errors.push({ url: rawUrl, error: "invalid URL" });
      continue;
    }
    try {
      const res = await fetchImpl(url, {
        redirect: "follow",
        headers: { "User-Agent": "YEANLeadBot/1.0 (+https://yean.tech/bot)", Accept: "text/html,application/xml" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        result.errors.push({ url, error: `HTTP ${res.status}` });
        continue;
      }
      result.pagesFetched++;
      const body = await res.text();
      const contentType = res.headers.get("content-type") ?? "";
      const isXml = contentType.includes("xml") || body.trimStart().startsWith("<?xml") || body.includes("<urlset");

      const candidates: Array<{ url: string; name?: string }> = isXml
        ? extractSitemapUrls(body).map((u) => ({ url: u }))
        : extractDirectoryLinks(body, url);

      for (const c of candidates) {
        if (result.leads.length >= opts.maxPerRun) break;
        const host = safeHost(c.url).replace(/^www\./, "");
        if (!host || seenDomains.has(host)) continue;
        seenDomains.add(host);
        result.leads.push({
          businessName: c.name || nameFromDomain(c.url),
          category: opts.defaultCategory || "business",
          city: opts.defaultCity || "Unknown",
          websiteUrl: c.url,
          discoverySource: "directory",
          sourceUrl: url,
        });
      }
      if (result.leads.length >= opts.maxPerRun) break;
    } catch (err) {
      result.errors.push({ url, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return result;
}
