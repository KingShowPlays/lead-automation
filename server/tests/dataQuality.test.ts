import { describe, expect, it } from "vitest";
import { assessEmail, pickBestEmail } from "../src/services/enrichment/emailQuality.js";
import { findOwnSiteInHtml, findSiteInInstagramHtml } from "../src/services/websiteChecker/behindLinkPage.js";
import { shortenName } from "../src/utils/text.js";

describe("email ownership", () => {
  const ctx = { siteDomain: "crystalscents.com.ng", businessName: "Crystal Scents" };

  it("trusts an address on the same domain as the website", () => {
    const r = assessEmail("info@crystalscents.com.ng", ctx);
    expect(r.verdict).toBe("owner");
    expect(r.confidence).toBeGreaterThanOrEqual(90);
  });

  it("rejects the agency credited in the footer", () => {
    // The reported problem: an address harvested from the business's own page
    // that belongs to whoever built it.
    const r = assessEmail("hello@brightwebstudio.com", ctx);
    expect(r.verdict).toBe("reject");
    expect(r.reason).toMatch(/agency/i);
  });

  it("rejects an unrelated organisation's domain", () => {
    expect(assessEmail("accounts@someotherfirm.com", ctx).verdict).toBe("reject");
  });

  it("rejects platform and template boilerplate", () => {
    for (const email of ["support@wix.com", "hi@example.com", "team@myshopify.com"]) {
      expect(assessEmail(email, ctx).verdict).toBe("reject");
    }
  });

  it("rejects automated mailboxes nobody reads", () => {
    for (const email of ["noreply@crystalscents.com.ng", "postmaster@crystalscents.com.ng", "you@youremail.com"]) {
      expect(assessEmail(email, ctx).verdict).toBe("reject");
    }
  });

  it("accepts free mail, which is normal for a small Nigerian business", () => {
    const named = assessEmail("crystalscents@gmail.com", ctx);
    expect(named.verdict).toBe("owner");

    const personal = assessEmail("chidi.okeke@gmail.com", ctx);
    expect(personal.verdict).toBe("likely");
    expect(personal.confidence).toBeLessThan(named.confidence);
  });

  it("judges on the name alone when there is no website to compare against", () => {
    const noSite = { siteDomain: null, businessName: "Amara Kitchen" };
    expect(assessEmail("orders@amarakitchen.ng", noSite).verdict).toBe("owner");
    expect(assessEmail("hello@lagosdigitalagency.com", noSite).verdict).toBe("reject");
    // A business whose own name contains an agency-sounding word is not caught.
    expect(assessEmail("orders@technofoods.ng", { siteDomain: null, businessName: "Techno Foods" }).verdict).toBe("owner");
  });

  it("picks the owner's address over the agency's on the same page", () => {
    const { best, rejected } = pickBestEmail(
      [
        { value: "hello@brightwebstudio.com" },
        { value: "info@crystalscents.com.ng" },
        { value: "noreply@crystalscents.com.ng" },
      ],
      ctx,
    );
    expect(best?.value).toBe("info@crystalscents.com.ng");
    expect(rejected.map((r) => r.value)).toContain("hello@brightwebstudio.com");
  });

  it("returns nothing rather than something wrong", () => {
    const { best, rejected } = pickBestEmail([{ value: "hello@webdesignpros.com" }], ctx);
    expect(best).toBeNull();
    expect(rejected).toHaveLength(1);
  });
});

describe("websites hiding behind a link page", () => {
  const linktree = (links: string) => `<html><body>${links}</body></html>`;

  it("finds the business's own domain among the usual link-page clutter", () => {
    const html = linktree(`
      <a href="https://wa.me/2348012345678">WhatsApp us</a>
      <a href="https://instagram.com/crystalscents">Instagram</a>
      <a href="https://crystalscents.com.ng">Shop</a>
      <a href="https://paystack.com/pay/crystal">Pay now</a>
    `);
    const found = findOwnSiteInHtml(html, "https://linktr.ee/crystalscents", "Crystal Scents");
    expect(found?.url).toContain("crystalscents.com.ng");
  });

  it("takes an explicitly labelled website link", () => {
    const html = linktree(`
      <a href="https://wa.me/2348012345678">Order on WhatsApp</a>
      <a href="https://shopfront.ng/store/1042">Visit our website</a>
    `);
    const found = findOwnSiteInHtml(html, "https://linktr.ee/x", "Amara Kitchen");
    expect(found?.url).toContain("shopfront.ng");
  });

  it("finds nothing on a page that is only social and payment links", () => {
    // The correct answer for most link pages. Inventing a website here would
    // wrongly disqualify a genuine lead.
    const html = linktree(`
      <a href="https://wa.me/2348012345678">WhatsApp</a>
      <a href="https://instagram.com/x">Instagram</a>
      <a href="https://paystack.com/pay/x">Pay</a>
      <a href="https://selar.co/x">Buy the ebook</a>
    `);
    expect(findOwnSiteInHtml(html, "https://linktr.ee/x", "Glow Haven")).toBeNull();
  });

  it("never promotes a random outbound link to being their website", () => {
    const html = linktree(`<a href="https://someblog.net/article/12">A review of us</a>`);
    expect(findOwnSiteInHtml(html, "https://linktr.ee/x", "Glow Haven")).toBeNull();
  });

  it("ignores another link page nested inside the first", () => {
    const html = linktree(`<a href="https://beacons.ai/glowhaven">More links</a>`);
    expect(findOwnSiteInHtml(html, "https://linktr.ee/glowhaven", "Glow Haven")).toBeNull();
  });

  it("reads a site out of an Instagram bio when the page is not walled off", () => {
    const html = `<html><head><meta property="og:description"
      content="Crystal Scents (@crystalscents) . Perfume oils in Lagos. crystalscents.com.ng"></head></html>`;
    const found = findSiteInInstagramHtml(html, "Crystal Scents");
    expect(found?.url).toContain("crystalscents.com.ng");
    expect(found?.reason).toMatch(/instagram bio/i);
  });

  it("does not guess from a bio that only mentions unrelated domains", () => {
    const html = `<html><head><meta property="og:description"
      content="Glow Haven (@glowhaven) . Book via wa.me/234801 . linktr.ee/glowhaven"></head></html>`;
    expect(findSiteInInstagramHtml(html, "Glow Haven")).toBeNull();
  });
});

describe("subject lines", () => {
  it("shortens a long business name at a word boundary, with no ellipsis", () => {
    // A real lead produced "A website for OH Elegance Abuja Fashion Sto…",
    // which reads to the recipient as a broken mail merge.
    const out = shortenName("OH Elegance Abuja Fashion Store And Accessories");
    expect(out).toBe("OH Elegance Abuja Fashion Store");
    expect(out).not.toContain("…");
    expect(out.endsWith(" ")).toBe(false);
    expect(out.length).toBeLessThanOrEqual(32);
  });

  it("leaves a short name untouched", () => {
    expect(shortenName("Crystal Scents")).toBe("Crystal Scents");
  });

  it("collapses runaway whitespace", () => {
    expect(shortenName("Amara   Kitchen")).toBe("Amara Kitchen");
  });

  it("still cuts a single unbroken word", () => {
    expect(shortenName("Supercalifragilisticexpialidociousenterprises", 20)).toHaveLength(20);
  });

  it("drops dangling punctuation left by the cut", () => {
    // The cut lands straight after "Shortlets," so the comma has to go.
    expect(shortenName("Zuri Shortlets, Lekki Phase One Annex", 16)).toBe("Zuri Shortlets");
  });

  it("keeps interior punctuation when the name still fits", () => {
    expect(shortenName("Zuri Shortlets, Lekki Phase One Annex", 26)).toBe("Zuri Shortlets, Lekki");
  });
});
