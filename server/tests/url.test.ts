import { describe, expect, it } from "vitest";
import {
  extractDomain,
  instagramUsernameFromUrl,
  isParkingHost,
  isSocialUrl,
  linkInBioPlatformOf,
  menuPlatformOf,
  normalizeUrl,
  socialPlatformOf,
} from "../src/utils/url.js";

describe("normalizeUrl", () => {
  it("adds https to bare domains", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com/");
  });

  it("preserves existing scheme", () => {
    expect(normalizeUrl("http://example.com/menu")).toBe("http://example.com/menu");
  });

  it("strips tracking params", () => {
    expect(normalizeUrl("https://example.com/?utm_source=ig&x=1")).toBe("https://example.com/?x=1");
  });

  it("returns null for garbage", () => {
    expect(normalizeUrl("not a url at all !!!")).toBeNull();
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl(null)).toBeNull();
  });
});

describe("extractDomain", () => {
  it("strips www and lowercases", () => {
    expect(extractDomain("https://WWW.Example.COM/path")).toBe("example.com");
  });

  it("works on bare domains", () => {
    expect(extractDomain("crystalscents.ng")).toBe("crystalscents.ng");
  });
});

describe("social URL detection", () => {
  it("detects instagram", () => {
    expect(isSocialUrl("https://instagram.com/crystalscents")).toBe(true);
    expect(socialPlatformOf("https://www.instagram.com/crystalscents")).toBe("instagram");
  });

  it("detects whatsapp", () => {
    expect(socialPlatformOf("https://wa.me/2348031234567")).toBe("whatsapp");
    expect(socialPlatformOf("https://api.whatsapp.com/send?phone=234")).toBe("whatsapp");
  });

  it("detects facebook", () => {
    expect(socialPlatformOf("https://facebook.com/mybusiness")).toBe("facebook");
  });

  it("does not flag ordinary domains", () => {
    expect(isSocialUrl("https://crystalscents.ng")).toBe(false);
    // must not match instagram.com.evil.example
    expect(isSocialUrl("https://instagram.com.evil.example")).toBe(false);
  });
});

describe("platform detection", () => {
  it("detects linktree", () => {
    expect(linkInBioPlatformOf("https://linktr.ee/crystalscents")).toBe("linktree");
  });

  it("detects beacons", () => {
    expect(linkInBioPlatformOf("https://beacons.ai/somebiz")).toBe("beacons");
  });

  it("detects lulumenu", () => {
    expect(menuPlatformOf("https://lulumenu.com/lagos-grill")).toBe("lulumenu");
  });

  it("detects chowdeck storefront", () => {
    expect(menuPlatformOf("https://chowdeck.com/store/lagos-grill")).toBe("chowdeck");
  });

  it("detects parking hosts", () => {
    expect(isParkingHost("https://sedoparking.com/somedomain")).toBe(true);
    expect(isParkingHost("https://example.com")).toBe(false);
  });
});

describe("instagramUsernameFromUrl", () => {
  it("extracts a profile username", () => {
    expect(instagramUsernameFromUrl("https://instagram.com/Crystal.Scents")).toBe("crystal.scents");
  });

  it("ignores post and reel links", () => {
    expect(instagramUsernameFromUrl("https://instagram.com/p/Cxyz123")).toBeNull();
    expect(instagramUsernameFromUrl("https://instagram.com/reel/Cxyz123")).toBeNull();
  });

  it("handles query strings", () => {
    expect(instagramUsernameFromUrl("https://www.instagram.com/mybiz?igsh=abc")).toBe("mybiz");
  });
});
