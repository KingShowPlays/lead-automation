import { normalizeBusinessName } from "../../utils/text.js";

/**
 * Decides whether a harvested email plausibly belongs to the business.
 *
 * Scraping a page for anything shaped like an address collects three kinds of
 * wrong answer, and all three have been seen in production:
 *
 *   the agency that built the site, credited in the footer
 *   the platform the site is hosted on, in template boilerplate
 *   placeholder text nobody replaced, like you@example.com
 *
 * Emailing any of those is worse than having no address at all: the pitch lands
 * with a stranger, and a bounce or a spam report costs sending reputation that
 * takes weeks to rebuild.
 *
 * The deciding signal is the domain. A business at crystalscents.com.ng that
 * publishes info@crystalscents.com.ng is publishing its own address. One that
 * shows hello@somedesignstudio.com on the same page is showing its supplier's.
 * Free mail is the exception, because a Nigerian business running on
 * crystalscents@gmail.com is entirely normal and entirely legitimate.
 */

export type EmailVerdict = "owner" | "likely" | "reject";

export interface EmailAssessment {
  verdict: EmailVerdict;
  /** 0 to 100. Stored so the queue can show how much to trust the address. */
  confidence: number;
  reason: string;
}

/** Free mailbox providers. Common and legitimate for a small business here. */
const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "ymail.com",
  "outlook.com", "hotmail.com", "hotmail.co.uk", "live.com", "msn.com",
  "icloud.com", "me.com", "aol.com", "protonmail.com", "proton.me",
  "zoho.com", "yandex.com", "mail.com", "gmx.com",
]);

/** Local parts that are never a person who wants to hear a pitch. */
const BAD_LOCAL = [
  "noreply", "no-reply", "donotreply", "do-not-reply", "postmaster", "abuse",
  "mailer-daemon", "bounce", "bounces", "notifications", "notification",
  "unsubscribe", "dmarc", "spf", "dkim", "webmaster", "hostmaster", "root",
  "example", "email", "youremail", "your-email", "name", "firstname", "test",
  "user", "username", "domain", "yourdomain", "company", "sentry", "wordpress",
];

/**
 * Domains that belong to somebody other than the business: platforms, template
 * vendors, and the services a site is built on. An address on one of these is
 * never the owner's, whatever the page it appears on.
 */
const VENDOR_DOMAIN = [
  "wix.com", "wixsite.com", "squarespace.com", "weebly.com", "godaddy.com",
  "shopify.com", "myshopify.com", "bigcommerce.com", "woocommerce.com",
  "wordpress.com", "wordpress.org", "automattic.com", "elementor.com",
  "themeforest.net", "envato.com", "bootstrapmade.com", "colorlib.com",
  "templatemonster.com", "html5up.net", "freepik.com", "flaticon.com",
  "sentry.io", "google.com", "gstatic.com", "facebook.com", "cloudflare.com",
  "paystack.com", "flutterwave.com", "bumpa.shop", "selar.co",
  "example.com", "example.org", "domain.com", "yourdomain.com", "email.com",
];

/**
 * Words that mark a domain as belonging to whoever built the site. Matched as
 * substrings, because the giveaway is almost always glued together:
 * brightwebstudio.com, lagosdigitalagency.com. Deliberately excludes short
 * fragments like "it" and "dev" that would match innocent domains, and every
 * caller checks the business's own name first so a firm actually called
 * Techno Foods is never caught by "tech".
 */
const AGENCY_HINT = /(webstudio|webdesign|website|digital|agency|studio|creative|design|softw|solutions|technolog|media)/i;

function tokensOf(businessName: string): string[] {
  return normalizeBusinessName(businessName)
    .split(/\s+/)
    .filter((t) => t.length >= 4)
    .map((t) => t.replace(/[^a-z0-9]/g, ""));
}

/** Does this string carry a distinctive word from the business name? */
function resemblesBusiness(value: string, businessName: string): boolean {
  const bare = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return tokensOf(businessName).some((t) => t && bare.includes(t));
}

export function assessEmail(
  email: string,
  ctx: { siteDomain?: string | null; businessName: string },
): EmailAssessment {
  const clean = email.trim().toLowerCase();
  const at = clean.lastIndexOf("@");
  if (at <= 0 || at === clean.length - 1) {
    return { verdict: "reject", confidence: 0, reason: "not a valid address" };
  }
  const local = clean.slice(0, at);
  const domain = clean.slice(at + 1);

  if (BAD_LOCAL.includes(local)) {
    return { verdict: "reject", confidence: 0, reason: `"${local}" is an automated or placeholder mailbox` };
  }
  if (VENDOR_DOMAIN.some((d) => domain === d || domain.endsWith(`.${d}`))) {
    return { verdict: "reject", confidence: 0, reason: `${domain} belongs to a platform, not the business` };
  }

  const site = ctx.siteDomain?.toLowerCase().replace(/^www\./, "") ?? null;
  const isFree = FREE_MAIL.has(domain);

  // Best case: the address is on the same domain as the website.
  if (site && (domain === site || domain.endsWith(`.${site}`) || site.endsWith(`.${domain}`))) {
    return { verdict: "owner", confidence: 95, reason: "same domain as their website" };
  }

  if (isFree) {
    // Free mail cannot be tied to a domain, so the local part is the only
    // evidence. Matching the business name is strong; not matching is still
    // usable, because plenty of owners use a personal address for the business.
    return resemblesBusiness(local, ctx.businessName)
      ? { verdict: "owner", confidence: 80, reason: "free mailbox named after the business" }
      : { verdict: "likely", confidence: 55, reason: "free mailbox, cannot be tied to the business" };
  }

  // A different custom domain on the business's own page is almost always the
  // agency that built it, especially when the domain says so.
  if (site && domain !== site) {
    if (resemblesBusiness(domain, ctx.businessName)) {
      return { verdict: "owner", confidence: 75, reason: "domain matches the business name" };
    }
    if (AGENCY_HINT.test(domain)) {
      return { verdict: "reject", confidence: 0, reason: `${domain} looks like the agency that built the site` };
    }
    return { verdict: "reject", confidence: 0, reason: `${domain} is a different organisation's domain` };
  }

  // No website to compare against: judge on the domain alone.
  if (resemblesBusiness(domain, ctx.businessName)) {
    return { verdict: "owner", confidence: 85, reason: "domain matches the business name" };
  }
  if (AGENCY_HINT.test(domain)) {
    return { verdict: "reject", confidence: 0, reason: `${domain} looks like an agency or supplier, not the business` };
  }
  return { verdict: "likely", confidence: 50, reason: "unverified domain" };
}

export interface RankedEmail {
  value: string;
  sourceUrl?: string;
  assessment: EmailAssessment;
}

/**
 * Picks the address most likely to reach the owner, and returns everything it
 * rejected so the reasoning is visible on the lead rather than silent.
 */
export function pickBestEmail(
  candidates: Array<{ value: string; sourceUrl?: string }>,
  ctx: { siteDomain?: string | null; businessName: string },
): { best: RankedEmail | null; rejected: RankedEmail[] } {
  const ranked: RankedEmail[] = candidates.map((c) => ({ ...c, assessment: assessEmail(c.value, ctx) }));
  const usable = ranked
    .filter((r) => r.assessment.verdict !== "reject")
    .sort((a, b) => b.assessment.confidence - a.assessment.confidence);
  return {
    best: usable[0] ?? null,
    rejected: ranked.filter((r) => r.assessment.verdict === "reject"),
  };
}
