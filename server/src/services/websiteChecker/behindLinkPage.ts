import * as cheerio from "cheerio";
import { extractDomain, isParkingHost, isSocialUrl, linkInBioPlatformOf, menuPlatformOf, normalizeUrl } from "../../utils/url.js";
import { normalizeBusinessName } from "../../utils/text.js";

/**
 * Finds the business's own website when it is hiding one level down.
 *
 * A lot of Nigerian businesses put a Linktree or a Bumpa page in their Google
 * listing and their Instagram bio, and the real site sits inside it as one link
 * among "WhatsApp us", "Our menu", "Shop now". Judging the Linktree itself gets
 * the lead badly wrong: we pitch "you have no website" to somebody who does,
 * which is the fastest way to lose the reply.
 *
 * So when the listed URL turns out to be a link page, we open it, look at where
 * it points, and try to identify a link that is the business's own domain. The
 * caller then re-checks that URL and classifies on the real site instead.
 */

/**
 * Hosts that are never somebody's own website. Payment links and storefront
 * builders are deliberately here: paying Paystack to host a page is exactly the
 * problem we sell against, so finding one must not count as "they have a site".
 */
const NOT_OWN_SITE = [
  "wa.me", "api.whatsapp.com", "chat.whatsapp.com", "t.me", "m.me",
  "instagram.com", "facebook.com", "fb.com", "twitter.com", "x.com", "tiktok.com",
  "youtube.com", "youtu.be", "snapchat.com", "threads.net", "pinterest.com",
  "linkedin.com", "google.com", "goo.gl", "maps.app.goo.gl", "forms.gle",
  "paystack.com", "paystack.shop", "flutterwave.com", "selar.co", "selar.com",
  "bumpa.shop", "mybumpa.com", "shopify.com", "myshopify.com", "etsy.com",
  "jumia.com.ng", "konga.com", "amazon.com", "ebay.com",
  "calendly.com", "linktr.ee", "beacons.ai", "bio.link", "taplink.cc",
  "mailchi.mp", "eepurl.com", "bit.ly", "tinyurl.com", "cutt.ly", "rebrand.ly",
  "spotify.com", "apple.com", "play.google.com", "apps.apple.com",
];

function isNotOwnSite(url: string): boolean {
  const domain = extractDomain(url);
  if (!domain) return true;
  if (NOT_OWN_SITE.some((h) => domain === h || domain.endsWith(`.${h}`))) return true;
  return isSocialUrl(url) || isParkingHost(url) || Boolean(linkInBioPlatformOf(url)) || Boolean(menuPlatformOf(url));
}

/** Tokens from the business name, long enough to be meaningful in a domain. */
function nameTokens(businessName: string): string[] {
  return normalizeBusinessName(businessName)
    .split(/\s+/)
    .filter((t) => t.length >= 4);
}

/**
 * How much a domain looks like it belongs to this business. A domain containing
 * a distinctive word from the name is the single most reliable signal available
 * without asking the owner.
 */
function affinity(url: string, businessName: string): number {
  const domain = extractDomain(url);
  if (!domain) return 0;
  const bare = domain.replace(/\.(com|net|org|ng|com\.ng|org\.ng|co|io|shop|store|africa)$/i, "").replace(/[^a-z0-9]/g, "");
  let score = 0;
  for (const token of nameTokens(businessName)) {
    if (bare.includes(token.replace(/[^a-z0-9]/g, ""))) score += 10;
  }
  // A Nigerian business on a Nigerian TLD is very likely to be its own site.
  if (/\.(com\.ng|ng)$/i.test(domain)) score += 3;
  if (/\.com$/i.test(domain)) score += 1;
  return score;
}

export interface HiddenSite {
  url: string;
  /** Why we believe this is theirs, for the provenance trail. */
  reason: string;
}

/**
 * Picks the most likely own-website link out of a link page's HTML.
 * Returns null when nothing in there looks like a real website, which is the
 * common and correct outcome for a pure "DM us on WhatsApp" page.
 */
export function findOwnSiteInHtml(html: string, pageUrl: string, businessName: string): HiddenSite | null {
  const $ = cheerio.load(html);
  const pageDomain = extractDomain(pageUrl);
  const seen = new Set<string>();
  const candidates: Array<{ url: string; score: number; text: string }> = [];

  $("a[href]").each((_, el) => {
    const raw = $(el).attr("href");
    if (!raw || /^(mailto:|tel:|javascript:|#)/i.test(raw)) return;
    let abs: string | null;
    try {
      abs = normalizeUrl(new URL(raw, pageUrl).toString());
    } catch {
      return;
    }
    if (!abs) return;
    const domain = extractDomain(abs);
    if (!domain || domain === pageDomain) return;
    if (seen.has(domain)) return;
    seen.add(domain);
    if (isNotOwnSite(abs)) return;

    const text = ($(el).text() || "").trim().slice(0, 60).toLowerCase();
    let score = affinity(abs, businessName);
    // Link text is a weaker hint than the domain, but "visit our website" is
    // about as explicit as this gets.
    if (/\b(website|web site|our site|shop online|visit us|homepage)\b/.test(text)) score += 6;
    candidates.push({ url: abs, score, text });
  });

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  // Require positive evidence. Any random outbound link would otherwise be
  // promoted to "their website", which is the mistake this exists to prevent.
  if (best.score < 6) return null;

  const matchedName = affinity(best.url, businessName) >= 10;
  return {
    url: best.url,
    reason: matchedName
      ? `domain matches the business name, linked from ${pageDomain}`
      : `labelled as their website on ${pageDomain}`,
  };
}

/**
 * Pulls a website out of an Instagram profile's public meta description.
 *
 * Instagram serves most server-side requests a login wall, so this succeeds
 * only sometimes and must never be relied on. It costs one request and is worth
 * trying because the bio link is where these businesses actually put their site.
 */
export function findSiteInInstagramHtml(html: string, businessName: string): HiddenSite | null {
  const $ = cheerio.load(html);
  const meta = `${$('meta[property="og:description"]').attr("content") ?? ""} ${$('meta[name="description"]').attr("content") ?? ""}`;
  const urls = meta.match(/\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s,)]*)?/gi) ?? [];
  const scored = urls
    .map((u) => normalizeUrl(u))
    .filter((u): u is string => Boolean(u) && !isNotOwnSite(u as string))
    .map((u) => ({ url: u, score: affinity(u, businessName) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < 10) return null;
  return { url: best.url, reason: "listed in their Instagram bio" };
}

const UA = "Mozilla/5.0 (compatible; YEANLeadBot/1.0; +https://yean.tech)";

async function fetchHtml(url: string, timeoutMs = 10000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok || !/text\/html/i.test(res.headers.get("content-type") ?? "")) {
      res.body?.cancel().catch(() => undefined);
      return null;
    }
    const text = await res.text();
    return text.length > 1_500_000 ? text.slice(0, 1_500_000) : text;
  } catch {
    return null;
  }
}

/**
 * Looks one level past a link page or an Instagram profile for the business's
 * own website. Network-bound and best-effort: any failure returns null and the
 * caller keeps its original classification.
 */
export async function resolveHiddenWebsite(opts: {
  linkPageUrl?: string | null;
  instagramUsername?: string | null;
  businessName: string;
}): Promise<HiddenSite | null> {
  if (opts.linkPageUrl) {
    const html = await fetchHtml(opts.linkPageUrl);
    if (html) {
      const found = findOwnSiteInHtml(html, opts.linkPageUrl, opts.businessName);
      if (found) return found;
    }
  }

  if (opts.instagramUsername) {
    const html = await fetchHtml(`https://www.instagram.com/${opts.instagramUsername}/`, 8000);
    if (html) {
      const found = findSiteInInstagramHtml(html, opts.businessName);
      if (found) return found;
    }
  }

  return null;
}
