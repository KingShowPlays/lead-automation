import { describe, expect, it } from "vitest";
import { isLikelyMobile, normalizeNigerianPhone, phoneFromWhatsAppLink } from "../src/utils/phone.js";

describe("normalizeNigerianPhone", () => {
  it("normalizes local format with leading 0", () => {
    expect(normalizeNigerianPhone("08031234567")).toBe("+2348031234567");
  });

  it("normalizes spaced local format", () => {
    expect(normalizeNigerianPhone("0803 123 4567")).toBe("+2348031234567");
  });

  it("normalizes +234 international format", () => {
    expect(normalizeNigerianPhone("+234 803 123 4567")).toBe("+2348031234567");
  });

  it("normalizes 234 without plus", () => {
    expect(normalizeNigerianPhone("2348031234567")).toBe("+2348031234567");
  });

  it("handles redundant trunk zero after 234", () => {
    expect(normalizeNigerianPhone("+2340803 123 4567")).toBe("+2348031234567");
  });

  it("handles 00234 prefix", () => {
    expect(normalizeNigerianPhone("002348031234567")).toBe("+2348031234567");
  });

  it("handles dashes and parentheses", () => {
    expect(normalizeNigerianPhone("(0803) 123-4567")).toBe("+2348031234567");
  });

  it("rejects too-short numbers", () => {
    expect(normalizeNigerianPhone("080312345")).toBeNull();
  });

  it("rejects too-long numbers", () => {
    expect(normalizeNigerianPhone("080312345678")).toBeNull();
  });

  it("rejects empty/null", () => {
    expect(normalizeNigerianPhone("")).toBeNull();
    expect(normalizeNigerianPhone(null)).toBeNull();
    expect(normalizeNigerianPhone(undefined)).toBeNull();
  });

  it("normalizes 70/81/90/91 prefixes", () => {
    expect(normalizeNigerianPhone("07012345678")).toBe("+2347012345678");
    expect(normalizeNigerianPhone("08112345678")).toBe("+2348112345678");
    expect(normalizeNigerianPhone("09012345678")).toBe("+2349012345678");
    expect(normalizeNigerianPhone("09112345678")).toBe("+2349112345678");
  });
});

describe("isLikelyMobile", () => {
  it("accepts NG mobile prefixes", () => {
    expect(isLikelyMobile("+2348031234567")).toBe(true);
    expect(isLikelyMobile("+2347012345678")).toBe(true);
    expect(isLikelyMobile("+2349112345678")).toBe(true);
  });

  it("rejects landline-looking numbers", () => {
    expect(isLikelyMobile("+2341234567890")).toBe(false);
  });

  it("rejects non-NG numbers", () => {
    expect(isLikelyMobile("+14155551234")).toBe(false);
    expect(isLikelyMobile(null)).toBe(false);
  });
});

describe("phoneFromWhatsAppLink", () => {
  it("extracts from wa.me links", () => {
    expect(phoneFromWhatsAppLink("https://wa.me/2348031234567")).toBe("+2348031234567");
  });

  it("extracts from api.whatsapp.com links", () => {
    expect(phoneFromWhatsAppLink("https://api.whatsapp.com/send?phone=2348031234567")).toBe("+2348031234567");
  });

  it("extracts from api.whatsapp.com/send/ with trailing slash", () => {
    expect(phoneFromWhatsAppLink("https://api.whatsapp.com/send/?phone=2348031234567&text=hi")).toBe(
      "+2348031234567",
    );
  });

  it("returns null for non-WhatsApp links", () => {
    expect(phoneFromWhatsAppLink("https://instagram.com/business")).toBeNull();
  });
});
