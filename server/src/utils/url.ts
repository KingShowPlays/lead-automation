/** URL helpers shared by the website checker and enrichment. */

const SOCIAL_HOSTS = [
  "instagram.com",
  "facebook.com",
  "fb.com",
  "m.facebook.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "wa.me",
  "api.whatsapp.com",
  "chat.whatsapp.com",
  "t.me",
  "youtube.com",
];

const LINK_IN_BIO_HOSTS: Record<string, string> = {
  "linktr.ee": "linktree",
  "beacons.ai": "beacons",
  "bio.link": "biolink",
  "lnk.bio": "lnkbio",
  "taplink.cc": "taplink",
  "campsite.bio": "campsite",
  "milkshake.app": "milkshake",
  "msha.ke": "milkshake",
  "solo.to": "solo",
  "linkin.bio": "linkinbio",
  "withkoji.com": "koji",
  "flowpage.com": "flowpage",
  "heylink.me": "heylink",
  "linkpop.com": "linkpop",
  "allmylinks.com": "allmylinks",
};

const MENU_PLATFORM_HOSTS: Record<string, string> = {
  "lulumenu.com": "lulumenu",
  "orda.africa": "orda",
  "getorda.com": "orda",
  "chowdeck.com": "chowdeck",
  "glovoapp.com": "glovo",
  "jumia.com.ng": "jumia-food",
  "food.jumia.com.ng": "jumia-food",
  "heyfood.africa": "heyfood",
  "menu.ng": "menu-ng",
  "flipdish.com": "flipdish",
  "storefront.chowdeck.com": "chowdeck",
};

const PARKING_HOSTS = [
  "sedoparking.com",
  "hugedomains.com",
  "dan.com",
  "afternic.com",
  "parkingcrew.net",
  "bodis.com",
  "above.com",
];

export function normalizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let url = raw.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const u = new URL(url);
    // Strip common tracking params but keep the path/query that identifies pages.
    ["utm_source", "utm_medium", "utm_campaign", "fbclid", "igsh", "igshid"].forEach((p) =>
      u.searchParams.delete(p),
    );
    return u.toString();
  } catch {
    return null;
  }
}

export function extractDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}

function hostMatches(domain: string, host: string): boolean {
  return domain === host || domain.endsWith(`.${host}`);
}

export function isSocialUrl(url: string | null | undefined): boolean {
  const domain = extractDomain(url);
  if (!domain) return false;
  return SOCIAL_HOSTS.some((h) => hostMatches(domain, h));
}

export function socialPlatformOf(url: string | null | undefined): string | null {
  const domain = extractDomain(url);
  if (!domain) return null;
  if (hostMatches(domain, "instagram.com")) return "instagram";
  if (hostMatches(domain, "facebook.com") || hostMatches(domain, "fb.com")) return "facebook";
  if (
    hostMatches(domain, "wa.me") ||
    hostMatches(domain, "api.whatsapp.com") ||
    hostMatches(domain, "chat.whatsapp.com")
  )
    return "whatsapp";
  if (hostMatches(domain, "tiktok.com")) return "tiktok";
  if (hostMatches(domain, "twitter.com") || hostMatches(domain, "x.com")) return "x";
  if (hostMatches(domain, "t.me")) return "telegram";
  if (hostMatches(domain, "youtube.com")) return "youtube";
  return null;
}

export function linkInBioPlatformOf(url: string | null | undefined): string | null {
  const domain = extractDomain(url);
  if (!domain) return null;
  for (const [host, name] of Object.entries(LINK_IN_BIO_HOSTS)) {
    if (hostMatches(domain, host)) return name;
  }
  return null;
}

export function menuPlatformOf(url: string | null | undefined): string | null {
  const domain = extractDomain(url);
  if (!domain) return null;
  for (const [host, name] of Object.entries(MENU_PLATFORM_HOSTS)) {
    if (hostMatches(domain, host)) return name;
  }
  return null;
}

export function isParkingHost(url: string | null | undefined): boolean {
  const domain = extractDomain(url);
  if (!domain) return false;
  return PARKING_HOSTS.some((h) => hostMatches(domain, h));
}

/** Extracts an Instagram username from a profile URL, ignoring post/reel links. */
export function instagramUsernameFromUrl(url: string): string | null {
  const m = url.match(/instagram\.com\/([A-Za-z0-9._]{2,30})\/?(?:\?|$)/i);
  if (!m) return null;
  const username = m[1].toLowerCase();
  const reserved = ["p", "reel", "reels", "explore", "stories", "tv", "accounts", "direct", "about", "developer"];
  if (reserved.includes(username)) return null;
  return username;
}
