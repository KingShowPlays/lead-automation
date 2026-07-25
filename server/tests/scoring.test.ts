import { describe, expect, it } from "vitest";
import { scoreLead, maturityOf } from "../src/services/scoring/leadScore.js";
import { DEFAULT_SCORING_WEIGHTS } from "../src/types.js";

const base = {
  websiteType: "NO_WEBSITE",
  hasEmail: false,
  hasPhone: false,
  whatsappAvailable: false,
  openingSoon: false,
  instagramActive: false,
  strongVisualBrand: false,
  maturity: "UNKNOWN" as const,
  newToGoogle: false,
};

const THRESHOLD = 50;

describe("need and reach are scored separately", () => {
  it("qualifies on need alone, with no way to contact the business", () => {
    // The regression that mattered. Under the previous model a business with no
    // website scored 40 against a threshold of 50 and was discarded unless
    // Google happened to return a mobile number. On a real Lagos sweep that
    // disqualified all 700 leads, including 384 with no website at all.
    const r = scoreLead({ ...base, websiteType: "NO_WEBSITE" }, DEFAULT_SCORING_WEIGHTS, THRESHOLD);
    expect(r.reachScore).toBe(0);
    expect(r.qualified).toBe(true);
  });

  it("keeps reach out of the qualifying decision entirely", () => {
    const unreachable = scoreLead({ ...base, websiteType: "NO_WEBSITE" }, DEFAULT_SCORING_WEIGHTS, THRESHOLD);
    const reachable = scoreLead(
      { ...base, websiteType: "NO_WEBSITE", hasEmail: true, whatsappAvailable: true, instagramActive: true },
      DEFAULT_SCORING_WEIGHTS,
      THRESHOLD,
    );
    expect(reachable.needScore).toBe(unreachable.needScore);
    expect(reachable.reachScore).toBeGreaterThan(unreachable.reachScore);
    expect(reachable.qualified).toBe(unreachable.qualified);
  });

  it("ranks the reachable lead higher without qualifying it differently", () => {
    const unreachable = scoreLead({ ...base }, DEFAULT_SCORING_WEIGHTS, THRESHOLD);
    const reachable = scoreLead({ ...base, hasEmail: true }, DEFAULT_SCORING_WEIGHTS, THRESHOLD);
    expect(reachable.priorityScore).toBeGreaterThan(unreachable.priorityScore);
  });
});

describe("need ordering matches how sellable each problem is", () => {
  const need = (websiteType: string) =>
    scoreLead({ ...base, websiteType }, DEFAULT_SCORING_WEIGHTS, THRESHOLD).needScore;

  it("leaves a business that owns a working site below the line without a second signal", () => {
    for (const type of ["POOR_WEBSITE", "SHOPIFY", "CUSTOM_WEBSITE"]) {
      expect(scoreLead({ ...base, websiteType: type }, DEFAULT_SCORING_WEIGHTS, THRESHOLD).qualified).toBe(false);
    }
    // A poor site plus real momentum is worth a look.
    const risingPoorSite = scoreLead(
      { ...base, websiteType: "POOR_WEBSITE", maturity: "NEW", newToGoogle: true },
      DEFAULT_SCORING_WEIGHTS,
      THRESHOLD,
    );
    expect(risingPoorSite.qualified).toBe(true);
  });

  it("ranks no website above every other problem", () => {
    expect(need("NO_WEBSITE")).toBeGreaterThan(need("BROKEN_WEBSITE"));
    expect(need("BROKEN_WEBSITE")).toBeGreaterThan(need("SOCIAL_MEDIA_ONLY"));
    expect(need("SOCIAL_MEDIA_ONLY")).toBeGreaterThan(need("MENU_PLATFORM_ONLY"));
    expect(need("MENU_PLATFORM_ONLY")).toBeGreaterThan(need("POOR_WEBSITE"));
    expect(need("POOR_WEBSITE")).toBeGreaterThan(need("SHOPIFY"));
  });

  it("qualifies every type of missing or rented web presence on its own", () => {
    for (const type of ["NO_WEBSITE", "BROKEN_WEBSITE", "SOCIAL_MEDIA_ONLY", "LINK_IN_BIO_ONLY", "MENU_PLATFORM_ONLY"]) {
      expect(scoreLead({ ...base, websiteType: type }, DEFAULT_SCORING_WEIGHTS, THRESHOLD).qualified).toBe(true);
    }
  });

  it("never qualifies a business that already has a good custom website", () => {
    const r = scoreLead(
      {
        ...base,
        websiteType: "CUSTOM_WEBSITE",
        hasEmail: true,
        whatsappAvailable: true,
        instagramActive: true,
        strongVisualBrand: true,
        openingSoon: true,
        newToGoogle: true,
      },
      DEFAULT_SCORING_WEIGHTS,
      THRESHOLD,
    );
    expect(r.needScore).toBe(0);
    expect(r.qualified).toBe(false);
  });
});

describe("recency and momentum", () => {
  it("reads review count as an age proxy", () => {
    expect(maturityOf(0)).toBe("NEW");
    expect(maturityOf(9)).toBe("NEW");
    expect(maturityOf(10)).toBe("EMERGING");
    expect(maturityOf(59)).toBe("EMERGING");
    expect(maturityOf(60)).toBe("ESTABLISHED");
    expect(maturityOf(undefined)).toBe("UNKNOWN");
  });

  it("treats an opening-soon business as new whatever its review count", () => {
    expect(maturityOf(500, true)).toBe("NEW");
  });

  it("scores a new business above an established one with the same web presence", () => {
    const fresh = scoreLead({ ...base, maturity: "NEW" }, DEFAULT_SCORING_WEIGHTS, THRESHOLD);
    const old = scoreLead({ ...base, maturity: "ESTABLISHED" }, DEFAULT_SCORING_WEIGHTS, THRESHOLD);
    expect(fresh.needScore).toBeGreaterThan(old.needScore);
  });

  it("rewards a business that appeared since the last sweep", () => {
    const seen = scoreLead({ ...base, newToGoogle: true }, DEFAULT_SCORING_WEIGHTS, THRESHOLD);
    const known = scoreLead({ ...base, newToGoogle: false }, DEFAULT_SCORING_WEIGHTS, THRESHOLD);
    expect(seen.needScore).toBeGreaterThan(known.needScore);
  });

  it("rewards review growth measured across scans", () => {
    const rising = scoreLead({ ...base, ratingVelocity: 5 }, DEFAULT_SCORING_WEIGHTS, THRESHOLD);
    const flat = scoreLead({ ...base, ratingVelocity: 0 }, DEFAULT_SCORING_WEIGHTS, THRESHOLD);
    expect(rising.needScore).toBeGreaterThan(flat.needScore);
  });
});

describe("bounds", () => {
  it("keeps both scores inside 0 to 100", () => {
    const maxed = scoreLead(
      {
        ...base,
        websiteType: "NO_WEBSITE",
        hasEmail: true,
        hasPhone: true,
        whatsappAvailable: true,
        instagramActive: true,
        strongVisualBrand: true,
        openingSoon: true,
        newToGoogle: true,
        ratingVelocity: 20,
        rating: 5,
        userRatingCount: 400,
      },
      DEFAULT_SCORING_WEIGHTS,
      THRESHOLD,
    );
    expect(maxed.needScore).toBeLessThanOrEqual(100);
    expect(maxed.reachScore).toBeLessThanOrEqual(100);
    expect(maxed.priorityScore).toBeLessThanOrEqual(100);
    expect(maxed.needScore).toBeGreaterThanOrEqual(0);
  });

  it("exposes score as an alias of needScore for stored documents", () => {
    const r = scoreLead({ ...base }, DEFAULT_SCORING_WEIGHTS, THRESHOLD);
    expect(r.score).toBe(r.needScore);
  });

  it("honours a custom threshold", () => {
    const r = scoreLead({ ...base, websiteType: "SHOPIFY" }, DEFAULT_SCORING_WEIGHTS, 20);
    expect(r.qualified).toBe(true);
    const strict = scoreLead({ ...base, websiteType: "SHOPIFY" }, DEFAULT_SCORING_WEIGHTS, 90);
    expect(strict.qualified).toBe(false);
  });
});
