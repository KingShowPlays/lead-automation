import type { ScoreBreakdownEntry, ScoreResult, ScoringWeights } from "../../types.js";
import { DEFAULT_SCORING_WEIGHTS } from "../../types.js";

/**
 * Lead scoring.
 *
 * The model answers two separate questions, and keeping them separate is the
 * whole point:
 *
 *   need   How badly does this business need a website?
 *   reach  How many ways do we have to start the conversation?
 *
 * The previous model added those together and qualified on the total, which
 * quietly threw away the best leads. A business with no website scored 40
 * against a threshold of 50 and could only cross the line if Google happened to
 * return a mobile number. Worse, the points it needed were unreachable by
 * construction: email and Instagram are scraped from the business's own
 * website, and a business with no website has nothing to scrape. The single
 * strongest buying signal was therefore the hardest to qualify.
 *
 * Now a lead qualifies on need alone. Reach never gates qualification, because
 * "hard to email" is a routing problem, not a reason to discard a business that
 * obviously needs what you sell: you call them, or you walk in. Reach instead
 * feeds the priority used to rank the approval queue, so the leads you can act
 * on immediately float to the top without the rest being lost.
 */

export type Maturity = "NEW" | "EMERGING" | "ESTABLISHED" | "UNKNOWN";

export interface ScoringInput {
  websiteType: string;
  hasEmail: boolean;
  hasPhone: boolean;
  whatsappAvailable: boolean;
  instagramActive: boolean;
  strongVisualBrand: boolean;
  openingSoon: boolean;
  /** Derived from review count and how long we have been watching. */
  maturity?: Maturity;
  rating?: number;
  userRatingCount?: number;
  /** Reviews gained per week since we first saw the business. */
  ratingVelocity?: number;
  /** True when the business showed up in a scan after we had already swept its area. */
  newToGoogle?: boolean;
}

const clamp = (value: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, value));

/**
 * Review count is the most reliable free proxy for age in Nigerian Places data.
 * There is no "established" field, but a business with four reviews is either
 * new or invisible, and both are worth a pitch.
 */
export function maturityOf(userRatingCount?: number, openingSoon?: boolean): Maturity {
  if (openingSoon) return "NEW";
  if (userRatingCount == null) return "UNKNOWN";
  if (userRatingCount < 10) return "NEW";
  if (userRatingCount < 60) return "EMERGING";
  return "ESTABLISHED";
}

/** How badly the business needs a website, 0 to 100. */
function needOf(input: ScoringInput, w: ScoringWeights): { score: number; breakdown: ScoreBreakdownEntry[] } {
  const breakdown: ScoreBreakdownEntry[] = [];
  const add = (rule: string, points: number) => {
    if (points !== 0) breakdown.push({ rule, points });
  };

  // The web presence itself. This alone should be able to qualify a lead: no
  // website at all is the strongest signal the system will ever see.
  switch (input.websiteType) {
    case "NO_WEBSITE":
      add("No website at all", w.noWebsite);
      break;
    case "BROKEN_WEBSITE":
      add("Website is broken", w.brokenWebsite);
      break;
    case "SOCIAL_MEDIA_ONLY":
      add("Social media page instead of a website", w.socialOrLinkInBioOnly);
      break;
    case "LINK_IN_BIO_ONLY":
      add("Link-in-bio page instead of a website", w.socialOrLinkInBioOnly);
      break;
    case "MENU_PLATFORM_ONLY":
      add("Rented storefront on a third-party platform", w.menuPlatformOnly);
      break;
    case "SHOPIFY":
      add("Generic Shopify template", w.shopifyWebsite);
      break;
    case "POOR_WEBSITE":
      add("Website exists but performs badly", w.poorWebsite);
      break;
    case "CUSTOM_WEBSITE":
      add("Already has a custom website", w.customWebsitePenalty);
      break;
    default:
      break;
  }

  // Timing. A business that opened last month is deciding these things now;
  // one with 900 reviews settled them years ago.
  if (input.openingSoon) add("Opening soon", w.openingSoon);
  else if (input.maturity === "NEW") add("Newly opened, few reviews yet", w.newBusiness);
  else if (input.maturity === "EMERGING") add("Still growing", w.emergingBusiness);

  if (input.newToGoogle) add("Appeared on Google since the last sweep", w.newToGoogle);

  // Momentum. Reviews arriving steadily means real customers and real money,
  // which is what separates a business that can pay from one that cannot.
  if ((input.ratingVelocity ?? 0) >= 2) add("Gaining reviews quickly", w.risingActivity);

  // A business that already curates its reputation will invest in presentation.
  if ((input.rating ?? 0) >= 4.2 && (input.userRatingCount ?? 0) >= 10) {
    add("Well rated, cares about reputation", w.wellRated);
  }

  if (input.strongVisualBrand) add("Strong visual brand", w.strongVisualBrand);

  const score = clamp(breakdown.reduce((sum, b) => sum + b.points, 0));
  return { score, breakdown };
}

/** How easily we can open the conversation, 0 to 100. Never gates qualification. */
function reachOf(input: ScoringInput, w: ScoringWeights): { score: number; breakdown: ScoreBreakdownEntry[] } {
  const breakdown: ScoreBreakdownEntry[] = [];
  const add = (rule: string, points: number) => {
    if (points !== 0) breakdown.push({ rule, points });
  };

  if (input.hasEmail) add("Email address found", w.publicEmail);
  if (input.whatsappAvailable) add("WhatsApp reachable", w.whatsappAvailable);
  else if (input.hasPhone) add("Phone number on file", w.phoneOnly);
  if (input.instagramActive) add("Active Instagram", w.activeInstagram);

  const score = clamp(breakdown.reduce((sum, b) => sum + b.points, 0));
  return { score, breakdown };
}

export function scoreLead(
  input: ScoringInput,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS,
  threshold = 50,
): ScoreResult {
  const w = { ...DEFAULT_SCORING_WEIGHTS, ...weights };
  const need = needOf(input, w);
  const reach = reachOf(input, w);

  // Need dominates: it decides whether the lead is worth anyone's time. Reach
  // only breaks ties, so an unreachable business with a screaming need still
  // outranks a well-connected one that already has a good website.
  const priorityScore = Math.round(need.score * 0.75 + reach.score * 0.25);

  return {
    score: need.score,
    needScore: need.score,
    reachScore: reach.score,
    priorityScore,
    breakdown: [...need.breakdown, ...reach.breakdown],
    needBreakdown: need.breakdown,
    reachBreakdown: reach.breakdown,
    qualified: need.score >= threshold,
    threshold,
  };
}
