import { describe, expect, it } from "vitest";
import {
  buildPrompt,
  parsePitchJson,
  suggestedSolutionFor,
  templatePitch,
  type PitchContext,
} from "../src/services/pitch/generatePitch.js";

const ctx: PitchContext = {
  businessName: "Crystal Scents",
  category: "perfume stores",
  city: "Port Harcourt",
  websiteType: "BROKEN_WEBSITE",
  websiteProblem: "Their Shopify link isn't opening properly.",
  instagramUsername: "crystal.scents",
  instagramBio: "Luxury fragrances | PH | Nationwide delivery",
  recentPostSummary: "New oud collection launch",
  outreachChannel: "EMAIL",
  openingSoon: false,
};

describe("suggestedSolutionFor", () => {
  it("maps categories to tailored solutions", () => {
    expect(suggestedSolutionFor("restaurants")).toMatch(/menu|ordering/i);
    expect(suggestedSolutionFor("hotels")).toMatch(/booking/i);
    expect(suggestedSolutionFor("shortlet apartments")).toMatch(/booking/i);
    expect(suggestedSolutionFor("salons")).toMatch(/booking/i);
    expect(suggestedSolutionFor("perfume stores")).toMatch(/fragrance|perfume/i);
    expect(suggestedSolutionFor("fashion stores")).toMatch(/store|collection/i);
    expect(suggestedSolutionFor("unknown category")).toMatch(/professional custom website/i);
  });
});

describe("buildPrompt", () => {
  it("includes all personalisation inputs from the plan", () => {
    const prompt = buildPrompt(ctx);
    expect(prompt).toContain("Crystal Scents");
    expect(prompt).toContain("perfume stores");
    expect(prompt).toContain("Shopify link isn't opening");
    expect(prompt).toContain("@crystal.scents");
    expect(prompt).toContain("Luxury fragrances");
    expect(prompt).toContain("New oud collection");
    expect(prompt).toContain("email");
    expect(prompt).toMatch(/JSON/);
  });

  it("notes opening-soon businesses", () => {
    const prompt = buildPrompt({ ...ctx, openingSoon: true });
    expect(prompt).toMatch(/opening soon|recently opened/i);
  });
});

describe("parsePitchJson", () => {
  it("parses clean JSON", () => {
    const parsed = parsePitchJson('{"observation":"o","subject":"s","message":"m"}');
    expect(parsed).toEqual({ observation: "o", subject: "s", message: "m" });
  });

  it("strips markdown fences", () => {
    const parsed = parsePitchJson('```json\n{"observation":"o","subject":"s","message":"m"}\n```');
    expect(parsed.subject).toBe("s");
  });

  it("tolerates prose around the JSON", () => {
    const parsed = parsePitchJson('Here you go:\n{"observation":"o","subject":"s","message":"m"}\nHope it helps');
    expect(parsed.message).toBe("m");
  });

  it("throws when subject or message missing", () => {
    expect(() => parsePitchJson('{"observation":"o"}')).toThrow();
    expect(() => parsePitchJson("no json here")).toThrow();
  });
});

describe("templatePitch (AI fallback)", () => {
  it("produces a complete personalised pitch", () => {
    const pitch = templatePitch(ctx);
    expect(pitch.subject.length).toBeGreaterThan(5);
    expect(pitch.message).toContain("Crystal Scents");
    expect(pitch.message).toContain("YEAN Technologies");
    expect(pitch.message).toMatch(/website isn't loading/i);
    expect(pitch.provider).toBe("template");
  });

  it("adapts to NO_WEBSITE", () => {
    const pitch = templatePitch({ ...ctx, websiteType: "NO_WEBSITE" });
    expect(pitch.message).toMatch(/don't have a website/i);
  });

  it("congratulates opening-soon businesses", () => {
    const pitch = templatePitch({ ...ctx, openingSoon: true });
    expect(pitch.message).toMatch(/congratulations/i);
  });

  it("never contains unfilled placeholders", () => {
    const pitch = templatePitch(ctx);
    expect(pitch.message).not.toMatch(/\{|\}|undefined|null/);
  });
});
