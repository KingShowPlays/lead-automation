/**
 * The one list of every enum value the filters offer.
 *
 * These were previously typed out again inside the leads page, which drifted
 * from the server: two pipeline stages were missing, so leads sitting in them
 * could not be filtered at all, and the maturity list contained both "NEW" and
 * a combined "NEW,EMERGING" entry, which rendered as a duplicate.
 *
 * Deriving the union types from these arrays means a value can only exist in one
 * place, and `assertNoDuplicates` fails loudly at import time if one is ever
 * repeated.
 */

function assertNoDuplicates<T extends string>(name: string, values: readonly T[]): readonly T[] {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`${name} contains a duplicate: ${value}`);
    seen.add(value);
  }
  return values;
}

export const WEBSITE_TYPES = assertNoDuplicates("WEBSITE_TYPES", [
  "NO_WEBSITE",
  "BROKEN_WEBSITE",
  "SOCIAL_MEDIA_ONLY",
  "LINK_IN_BIO_ONLY",
  "MENU_PLATFORM_ONLY",
  "POOR_WEBSITE",
  "SHOPIFY",
  "CUSTOM_WEBSITE",
] as const);

/** Must match PIPELINE_STAGES on the server, in the order a lead moves through. */
export const PIPELINE_STAGES = assertNoDuplicates("PIPELINE_STAGES", [
  "DISCOVERED",
  "CHECKED",
  "ENRICHED",
  "SCORED",
  "QUALIFIED",
  "DISQUALIFIED",
  "PITCH_READY",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "CONTACTED",
  "ARCHIVED",
] as const);

export const OUTREACH_STATUSES = assertNoDuplicates("OUTREACH_STATUSES", [
  "NOT_CONTACTED",
  "DRAFT_CREATED",
  "CONTACTED",
  "FOLLOW_UP_SENT",
  "RESPONDED",
  "INTERESTED",
  "NOT_INTERESTED",
  "CONVERTED",
  "DO_NOT_CONTACT",
] as const);

/**
 * One entry per state. "Recently opened" covers NEW and EMERGING together and
 * is offered as its own labelled shortcut rather than as a third value that
 * looks like a repeat of the first two.
 */
export const MATURITIES = assertNoDuplicates("MATURITIES", ["NEW", "EMERGING", "ESTABLISHED", "UNKNOWN"] as const);

export const DISCOVERY_SOURCES = assertNoDuplicates("DISCOVERY_SOURCES", [
  "google_places",
  "manual_import",
  "directory",
] as const);

export const SUPPRESSION_TYPES = assertNoDuplicates("SUPPRESSION_TYPES", [
  "EMAIL",
  "PHONE",
  "DOMAIN",
  "INSTAGRAM",
  "PLACE_ID",
] as const);

/** How the business can be reached. Mirrors the server's `contactable` filter. */
export const CONTACTABLE_OPTIONS = assertNoDuplicates("CONTACTABLE_OPTIONS", [
  "any",
  "email",
  "phone",
  "whatsapp",
  "instagram",
  "none",
] as const);

export const SORT_OPTIONS = assertNoDuplicates("SORT_OPTIONS", [
  "-priority",
  "-score",
  "score",
  "-reach",
  "-created",
  "created",
  "-reviews",
  "name",
] as const);

/** "PENDING_APPROVAL" -> "Pending approval", with acronyms kept upper case. */
const ACRONYMS = new Set(["ai", "api", "dns", "http", "id", "ssl", "url"]);

export function optionLabel(value: string): string {
  const words = value.replaceAll("_", " ").toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const out = words.map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w));
  out[0] = out[0][0].toUpperCase() + out[0].slice(1);
  return out.join(" ");
}

export const SORT_LABELS: Record<(typeof SORT_OPTIONS)[number], string> = {
  "-priority": "Best leads first",
  "-score": "Highest need",
  score: "Lowest need",
  "-reach": "Easiest to contact",
  "-created": "Newest discovered",
  created: "Oldest discovered",
  "-reviews": "Most reviewed",
  name: "Name, A to Z",
};

export const CONTACTABLE_LABELS: Record<(typeof CONTACTABLE_OPTIONS)[number], string> = {
  any: "Any contact route",
  email: "Has an email",
  phone: "Has a phone number",
  whatsapp: "Reachable on WhatsApp",
  instagram: "Has Instagram",
  none: "No contact route yet",
};
