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
  score: number;
  breakdown: ScoreBreakdownEntry[];
  qualified: boolean;
  threshold: number;
}

export interface PitchResult {
  subject: string;
  message: string;
  observation: string;
  provider: string;
  model: string;
}

export interface ScoringWeights {
  noWebsite: number;
  brokenWebsite: number;
  socialOrLinkInBioOnly: number;
  shopifyWebsite: number;
  publicEmail: number;
  whatsappAvailable: number;
  recentlyOpened: number;
  activeInstagram: number;
  strongVisualBrand: number;
  customWebsitePenalty: number;
  poorWebsite: number;
  menuPlatformOnly: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  noWebsite: 40,
  brokenWebsite: 40,
  socialOrLinkInBioOnly: 30,
  shopifyWebsite: 15,
  publicEmail: 15,
  whatsappAvailable: 10,
  recentlyOpened: 25,
  activeInstagram: 15,
  strongVisualBrand: 10,
  customWebsitePenalty: -30,
  poorWebsite: 25,
  menuPlatformOnly: 25,
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
