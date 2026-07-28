/**
 * Phone number handling.
 *
 * This used to be Nigeria only, and not by configuration: every number went
 * through a normaliser that stripped whatever country code it found and stamped
 * +234 on the result. A Ghanaian or British number came out either wrong or, more
 * often, null, because it failed the ten-digit check and was thrown away.
 *
 * Two rules now decide the country, in order:
 *
 *   1. If the number carries its own country code, that country wins. A number
 *      written +233 24 123 4567 is Ghanaian no matter where the search ran.
 *   2. Otherwise the number is national, and belongs to the country the search
 *      is running in, which the operator sets and which defaults to Nigeria.
 *
 * Numbers from a country not in the table are kept rather than discarded: an
 * unrecognised but well-formed international number is still a way to reach
 * somebody, and silently deleting it is the worse failure.
 */

export interface CountryPhoneRules {
  iso: string;
  name: string;
  /** Dial code without the plus. */
  dial: string;
  /** Valid lengths for the national significant number. */
  lengths: number[];
  /** Digit the national format prefixes and international format drops. */
  trunk?: string;
  /** Leading digits of a mobile number, tested against the national number. */
  mobile: RegExp;
}

/**
 * The countries this is expected to run in, plus the ones a Nigerian studio's
 * leads most often carry. Anything else falls through to the generic path.
 */
export const COUNTRY_RULES: CountryPhoneRules[] = [
  { iso: "NG", name: "Nigeria", dial: "234", lengths: [10], trunk: "0", mobile: /^(70|80|81|90|91)/ },
  { iso: "GH", name: "Ghana", dial: "233", lengths: [9], trunk: "0", mobile: /^(2|5)/ },
  { iso: "KE", name: "Kenya", dial: "254", lengths: [9], trunk: "0", mobile: /^(7|1)/ },
  { iso: "ZA", name: "South Africa", dial: "27", lengths: [9], trunk: "0", mobile: /^(6|7|8)/ },
  { iso: "EG", name: "Egypt", dial: "20", lengths: [10], trunk: "0", mobile: /^1/ },
  { iso: "GB", name: "United Kingdom", dial: "44", lengths: [10], trunk: "0", mobile: /^7/ },
  /*
   * North America has no mobile prefix: the same ranges carry landlines and
   * mobiles, so a number cannot be classified from its digits. These never
   * match, which means such a lead is offered as a phone contact rather than
   * being claimed as a WhatsApp one.
   */
  { iso: "US", name: "United States", dial: "1", lengths: [10], mobile: /(?!)/ },
  { iso: "CA", name: "Canada", dial: "1", lengths: [10], mobile: /(?!)/ },
  { iso: "IN", name: "India", dial: "91", lengths: [10], trunk: "0", mobile: /^[6-9]/ },
  { iso: "AE", name: "United Arab Emirates", dial: "971", lengths: [9], trunk: "0", mobile: /^5/ },
  { iso: "FR", name: "France", dial: "33", lengths: [9], trunk: "0", mobile: /^[67]/ },
  { iso: "DE", name: "Germany", dial: "49", lengths: [10, 11], trunk: "0", mobile: /^1[5-7]/ },
];

export const DEFAULT_COUNTRY = "NG";

const byIso = new Map(COUNTRY_RULES.map((c) => [c.iso, c]));

/** Dial codes longest first, so +234 is matched before +23 would be. */
const byDialLongestFirst = [...COUNTRY_RULES].sort((a, b) => b.dial.length - a.dial.length);

export function rulesFor(iso: string | null | undefined): CountryPhoneRules {
  return byIso.get((iso ?? DEFAULT_COUNTRY).toUpperCase()) ?? byIso.get(DEFAULT_COUNTRY)!;
}

/** Which country an already-normalised E.164 number belongs to. */
export function countryOf(e164: string | null | undefined): CountryPhoneRules | null {
  if (!e164 || !e164.startsWith("+")) return null;
  const digits = e164.slice(1);
  for (const rules of byDialLongestFirst) {
    if (!digits.startsWith(rules.dial)) continue;
    if (rules.lengths.includes(digits.length - rules.dial.length)) return rules;
  }
  return null;
}

function national(digits: string, rules: CountryPhoneRules): string | null {
  let n = digits;
  if (rules.trunk && n.startsWith(rules.trunk)) n = n.slice(rules.trunk.length);
  return rules.lengths.includes(n.length) ? n : null;
}

/**
 * Normalises to E.164.
 *
 * `country` is the ISO-2 code the number should be read as when it does not
 * carry one of its own. It only ever acts as a default: a number written with
 * an explicit country code keeps it.
 */
/**
 * Reads the country out of a formatted address.
 *
 * Places returns addresses that end in the country name, and a scan may cover
 * several countries at once, so the country belongs to the business rather than
 * to the account. Returns null when it cannot tell, and the caller is expected
 * to leave the number alone rather than guess: a Ghanaian number read as
 * Nigerian is worse than an unformatted one.
 */
export function countryFromAddress(address: string | null | undefined): CountryPhoneRules | null {
  if (!address) return null;
  const tail = address.split(",").map((part) => part.trim().toLowerCase()).filter(Boolean).pop();
  if (!tail) return null;
  for (const rules of COUNTRY_RULES) {
    if (tail === rules.name.toLowerCase() || tail === rules.iso.toLowerCase()) return rules;
    if (ALIASES[tail] === rules.iso) return rules;
  }
  return null;
}

/** Names a country is written under that are not its formal name. */
const ALIASES: Record<string, string> = {
  uk: "GB",
  "united kingdom": "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "northern ireland": "GB",
  usa: "US",
  "united states of america": "US",
  uae: "AE",
  "u.a.e.": "AE",
};

/**
 * Normalises a number to E.164.
 *
 * `country` is what the number should be read as when it does not say. Pass
 * null when that is genuinely unknown: the number is then only accepted if it
 * carries its own dial code, and otherwise left for the caller to show as
 * found. Guessing is how every phone number in the database ended up Nigerian.
 */
export function normalizePhone(
  raw: string | null | undefined,
  country: string | null = DEFAULT_COUNTRY,
): string | null {
  if (!raw) return null;

  const cleaned = raw.replace(/[^\d+]/g, "");
  if (!cleaned) return null;

  // An explicit international prefix means the number states its own country.
  const international = cleaned.startsWith("+") || cleaned.startsWith("00");
  let digits = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned.startsWith("00") ? cleaned.slice(2) : cleaned;
  if (!/^\d+$/.test(digits)) return null;

  const home = country ? rulesFor(country) : null;

  // Written with the home country's dial code, with or without a plus.
  if (home && digits.startsWith(home.dial)) {
    const rest = national(digits.slice(home.dial.length), home);
    if (rest) return `+${home.dial}${rest}`;
  }

  if (international) {
    for (const rules of byDialLongestFirst) {
      if (!digits.startsWith(rules.dial)) continue;
      const rest = national(digits.slice(rules.dial.length), rules);
      if (rest) return `+${rules.dial}${rest}`;
    }
    // A country this build does not know about. Keep it if it is a plausible
    // E.164 number; discarding a real contact is worse than storing one this
    // code cannot classify.
    if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
    return null;
  }

  // No country code and no country to read it as. Leaving it unformatted is
  // the honest answer; the raw number is still shown and still dialable.
  if (!home) return null;

  // No country code: read it as a national number in the home country.
  const rest = national(digits, home);
  return rest ? `+${home.dial}${rest}` : null;
}

/**
 * Kept for the many call sites written when this only handled Nigeria. New code
 * should call normalizePhone with the country it means.
 */
export function normalizeNigerianPhone(raw: string | null | undefined): string | null {
  return normalizePhone(raw, "NG");
}

/** True when the number looks like a mobile, and so is plausibly on WhatsApp. */
export function isLikelyMobile(e164: string | null | undefined): boolean {
  const rules = countryOf(e164);
  if (!rules || !e164) return false;
  return rules.mobile.test(e164.slice(1 + rules.dial.length));
}

/** Extracts the phone number from a wa.me / api.whatsapp.com link. */
export function phoneFromWhatsAppLink(url: string, country: string = DEFAULT_COUNTRY): string | null {
  const m = url.match(/(?:wa\.me\/|api\.whatsapp\.com\/send\/?\?phone=|whatsapp:\/\/send\?phone=)\+?(\d{7,15})/i);
  if (!m) return null;
  // A wa.me number is always international, even without the plus.
  return normalizePhone(`+${m[1]}`, country);
}
