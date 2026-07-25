/** Shared domain types used across the pipeline. */

export const WEBSITE_TYPES = [
  "NO_WEBSITE",
  "BROKEN_WEBSITE",
  "SHOPIFY",
  "LINK_IN_BIO_ONLY",
  "MENU_PLATFORM_ONLY",
  "SOCIAL_MEDIA_ONLY",
  "CUSTOM_WEBSITE",
  "POOR_WEBSITE",
] as const;
export type WebsiteType = (typeof WEBSITE_TYPES)[number];

export const WEBSITE_STATUSES = ["NONE", "LIVE", "DEGRADED", "DEAD"] as const;
export type WebsiteStatus = (typeof WEBSITE_STATUSES)[number];

export const PIPELINE_STAGES = [
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
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const OUTREACH_CHANNELS = ["EMAIL", "INSTAGRAM_MANUAL", "WHATSAPP", "NONE"] as const;
export type OutreachChannel = (typeof OUTREACH_CHANNELS)[number];

export const OUTREACH_STATUSES = [
  "NOT_CONTACTED",
  "DRAFT_CREATED",
  "CONTACTED",
  "FOLLOW_UP_SENT",
  "RESPONDED",
  "INTERESTED",
  "NOT_INTERESTED",
  "CONVERTED",
  "DO_NOT_CONTACT",
] as const;
export type OutreachStatus = (typeof OUTREACH_STATUSES)[number];

export const RESPONSE_STATUSES = [
  "NONE",
  "POSITIVE",
  "NEUTRAL",
  "NEGATIVE",
  "OPT_OUT",
  "BOUNCED",
] as const;
export type ResponseStatus = (typeof RESPONSE_STATUSES)[number];

export const SUPPRESSION_TYPES = ["EMAIL", "PHONE", "DOMAIN", "INSTAGRAM", "PLACE_ID"] as const;
export type SuppressionType = (typeof SUPPRESSION_TYPES)[number];

/** A business as returned by discovery, before it becomes a Lead document. */
export interface DiscoveredBusiness {
  googlePlaceId: string;
  businessName: string;
  category: string;
  categoryRaw?: string[];
  city: string;
  address?: string;
  location?: { lat: number; lng: number };
  phone?: string;
  internationalPhone?: string;
  websiteUrl?: string;
  googleMapsUrl?: string;
  businessStatus?: string;
  /** True when Places reports the business as opening soon / recently opened. */
  openingSoon?: boolean;
  rating?: number;
  userRatingCount?: number;
  searchQuery: string;
}

/**
 * Source-agnostic incoming lead. Every discovery source (Google Places,
 * manual/bulk import, directory crawler) normalises to this shape and goes
 * through the same upsert -> enrich -> score -> pitch pipeline. Google
 * Places keeps its exact prior behaviour; new sources are purely additive.
 */
export interface IncomingLead {
  businessName: string;
  category: string;
  city: string;
  address?: string;
  phone?: string;
  email?: string;
  instagramUsername?: string;
  websiteUrl?: string;
  googlePlaceId?: string;
  googleMapsUrl?: string;
  location?: { lat: number; lng: number };
  businessStatus?: string;
  openingSoon?: boolean;
  rating?: number;
  userRatingCount?: number;
  categoryRaw?: string[];
  searchQuery?: string;
  /** "google_places" | "manual_import" | "directory" | ... */
  discoverySource: string;
  /** Where this record came from (directory page, import batch label). */
  sourceUrl?: string;
}

export interface WebsiteCheckResult {
  inputUrl: string | null;
  finalUrl: string | null;
  domain: string | null;
  dnsResolved: boolean;
  sslValid: boolean;
  sslError: string | null;
  httpStatus: number | null;
  responseTimeMs: number | null;
  redirectChain: string[];
  redirectLoop: boolean;
  reachable: boolean;
  title: string | null;
  metaDescription: string | null;
  hasViewport: boolean;
  isShopify: boolean;
  shopifyIndicators: string[];
  /** Detected hosting platform, e.g. "linktree", "lulumenu", "wix" */
  platform: string | null;
  platformKind: "link_in_bio" | "menu" | "site_builder" | "parking" | null;
  redirectsToSocialOnly: boolean;
  socialTarget: string | null;
  isParkingPage: boolean;
  brokenInternalLinks: number;
  internalLinksChecked: number;
  issues: string[];
  error: string | null;
  checkedAt: string;
}

export interface ClassificationResult {
  websiteType: WebsiteType;
  websiteStatus: WebsiteStatus;
  /** Human-readable summary of the main problem, used to seed the pitch. */
  problemSummary: string;
}

export interface ExtractedContacts {
  emails: Array<{ value: string; sourceUrl: string }>;
  phones: Array<{ value: string; sourceUrl: string }>;
  whatsappNumbers: Array<{ value: string; sourceUrl: string }>;
  instagramUsernames: Array<{ value: string; sourceUrl: string }>;
  facebookUrls: Array<{ value: string; sourceUrl: string }>;
}

export interface ScoreBreakdownEntry {
  rule: string;
  points: number;
}

export interface ScoreResult {
  /** Kept as an alias of needScore so existing callers and stored docs still read. */
  score: number;
  /** How badly the business needs a website. This alone decides qualification. */
  needScore: number;
  /** How easy the business is to contact. Ranks the queue, never gates it. */
  reachScore: number;
  /** Blended ordering value: need weighted at 0.75, reach at 0.25. */
  priorityScore: number;
  breakdown: ScoreBreakdownEntry[];
  needBreakdown: ScoreBreakdownEntry[];
  reachBreakdown: ScoreBreakdownEntry[];
  qualified: boolean;
  threshold: number;
}

export interface PitchResult {
  subject: string;
  message: string;
  observation: string;
  provider: string;
  model: string;
  /** Present when a configured AI provider failed and a template was used. */
  fallbackReason?: string;
}

export interface ScoringWeights {
  // Need: the web presence itself.
  noWebsite: number;
  brokenWebsite: number;
  socialOrLinkInBioOnly: number;
  shopifyWebsite: number;
  poorWebsite: number;
  menuPlatformOnly: number;
  customWebsitePenalty: number;
  // Need: timing and momentum.
  openingSoon: number;
  newBusiness: number;
  emergingBusiness: number;
  newToGoogle: number;
  risingActivity: number;
  wellRated: number;
  strongVisualBrand: number;
  // Reach: how we start the conversation. Never gates qualification.
  publicEmail: number;
  whatsappAvailable: number;
  phoneOnly: number;
  activeInstagram: number;
  /** @deprecated superseded by openingSoon/newBusiness; kept so saved settings still load. */
  recentlyOpened?: number;
}

/**
 * Need weights are set so that the web presence alone can clear the default
 * threshold of 50. A business with no website is the strongest lead this system
 * can find, and it must never depend on a scraped email to qualify.
 */
export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  // Need: web presence.
  //
  // Everything above the threshold of 50 is a business with no real website of
  // its own: nothing, something broken, or a page on somebody else's platform.
  // Each of those qualifies unaided, because each is the pitch. Below the line
  // sit businesses that do have a site; they need a second signal, such as
  // being newly opened, before they are worth a founder's morning.
  noWebsite: 60,
  brokenWebsite: 55,
  socialOrLinkInBioOnly: 52,
  menuPlatformOnly: 50,
  poorWebsite: 35,
  shopifyWebsite: 25,
  customWebsitePenalty: -40,
  // Need: timing and momentum.
  openingSoon: 20,
  newBusiness: 18,
  emergingBusiness: 10,
  newToGoogle: 12,
  risingActivity: 10,
  wellRated: 8,
  strongVisualBrand: 8,
  // Reach: contactability, scored separately and capped at 100.
  publicEmail: 40,
  whatsappAvailable: 30,
  phoneOnly: 15,
  activeInstagram: 25,
};

export const DEFAULT_CITIES = ["Lagos", "Abuja", "Port Harcourt"];

export const DEFAULT_CATEGORIES = [
  "restaurants",
  "hotels",
  "resorts",
  "salons",
  "fashion stores",
  "perfume stores",
  "shortlet apartments",
];
