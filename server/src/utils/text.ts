/** Text normalization helpers. */

/** Lowercase, strip punctuation and legal suffixes, used for duplicate detection. */
export function normalizeBusinessName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(ltd|limited|llc|inc|enterprises?|ventures?|nigeria|nig|intl|international|global|co)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Shortens a business name for use in a sentence, cutting at a word boundary
 * and adding nothing.
 *
 * `truncate` is right for a log line but wrong in an email subject: Google
 * listings run long, and cutting one at a fixed character count produced
 * "A website for OH Elegance Abuja Fashion Sto…" on a real lead. A recipient
 * reads that as a broken mail-merge, which is the opposite of a personal note.
 * Long Places names are usually brand plus location plus category, so keeping
 * whole leading words gets the brand and drops the noise.
 */
export function shortenName(name: string, max = 32): string {
  const clean = name.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;

  const words = clean.split(" ");
  let out = "";
  for (const word of words) {
    const next = out ? `${out} ${word}` : word;
    if (next.length > max) break;
    out = next;
  }
  // A single word longer than the limit still has to be cut somewhere.
  if (!out) out = clean.slice(0, max);
  return out.replace(/[,;:\-–—&/(]+$/, "").trim();
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** Extracts plausible business email addresses from free text, filtering junk. */
export function extractEmails(text: string): string[] {
  const matches = text.match(EMAIL_RE) ?? [];
  const junkDomains = [
    "example.com",
    "sentry.io",
    "wixpress.com",
    "sentry.wixpress.com",
    "domain.com",
    "email.com",
    "yourdomain.com",
    "godaddy.com",
    "mysite.com",
  ];
  const junkExtensions = /\.(png|jpe?g|gif|webp|svg|css|js|woff2?)$/i;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of matches) {
    const email = m.toLowerCase().replace(/^\d+@/, ""); // strip version-string artifacts like 2x@
    if (junkExtensions.test(email)) continue;
    const domain = email.split("@")[1];
    if (!domain || junkDomains.includes(domain)) continue;
    if (email.length > 60) continue;
    if (!seen.has(email)) {
      seen.add(email);
      out.push(email);
    }
  }
  return out;
}
