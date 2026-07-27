import { describe, expect, it } from "vitest";
import { isLikelyMobile, normalizeNigerianPhone, normalizePhone, phoneFromWhatsAppLink } from "../src/utils/phone.js";

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

  it("does not claim a number it cannot classify", () => {
    // North America has no mobile prefix, so a +1 number cannot be told apart
    // from a landline and is not advertised as a WhatsApp contact.
    expect(isLikelyMobile("+14155551234")).toBe(false);
    expect(isLikelyMobile(null)).toBe(false);
  });

  it("recognises mobiles in other countries it knows", () => {
    expect(isLikelyMobile("+233241234567")).toBe(true); // Ghana
    expect(isLikelyMobile("+254712345678")).toBe(true); // Kenya
    expect(isLikelyMobile("+447700900123")).toBe(true); // United Kingdom
    expect(isLikelyMobile("+27821234567")).toBe(true); // South Africa
  });
});

describe("numbers from outside the home country", () => {
  it("keeps the country the number states, whatever the default is", () => {
    // The old normaliser stripped whatever code it found and stamped +234 on
    // the result, so a Ghanaian number came back wrong or, more often, null.
    expect(normalizePhone("+233 24 123 4567", "NG")).toBe("+233241234567");
    expect(normalizePhone("+44 7700 900123", "NG")).toBe("+447700900123");
    expect(normalizePhone("00254 712 345678", "NG")).toBe("+254712345678");
  });

  it("reads a national number as the country the search is running in", () => {
    expect(normalizePhone("0803 123 4567", "NG")).toBe("+2348031234567");
    expect(normalizePhone("024 123 4567", "GH")).toBe("+233241234567");
    expect(normalizePhone("082 123 4567", "ZA")).toBe("+27821234567");
  });

  it("keeps a well-formed number from a country it does not know", () => {
    // Storing a number this build cannot classify is better than deleting a
    // real way to reach somebody.
    expect(normalizePhone("+352 621 123 456", "NG")).toBe("+352621123456");
  });

  it("still rejects anything that is not a phone number", () => {
    expect(normalizePhone("+12", "NG")).toBeNull();
    expect(normalizePhone("abc", "NG")).toBeNull();
    expect(normalizePhone("080312345", "NG")).toBeNull();
  });

  it("reads a wa.me number as international even without a plus", () => {
    expect(phoneFromWhatsAppLink("https://wa.me/233241234567")).toBe("+233241234567");
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
