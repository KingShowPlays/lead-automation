/**
 * Session cookie signing.
 *
 * Uses Web Crypto rather than node:crypto because the middleware that checks
 * the cookie runs on the edge runtime, where node:crypto is unavailable.
 *
 * The cookie carries an expiry and a signature over it. There is no session
 * store: this protects a single operator's dashboard, so a signed expiring
 * token is the right weight. Rotating AUTH_SECRET invalidates every session.
 */

const ENCODER = new TextEncoder();

/** Base64url, because a cookie value may not contain +, / or =. */
function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    ENCODER.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, ENCODER.encode(payload));
  return toBase64Url(new Uint8Array(mac));
}

/** Length-independent comparison, so a mismatch reveals nothing by timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const SESSION_COOKIE = "yean_session";

export async function createSessionToken(username: string, secret: string, ttlSeconds: number): Promise<string> {
  const expires = Date.now() + ttlSeconds * 1000;
  const payload = `${encodeURIComponent(username)}.${expires}`;
  return `${payload}.${await sign(payload, secret)}`;
}

export async function verifySessionToken(token: string | undefined, secret: string): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [user, expiresRaw, signature] = parts;
  const payload = `${user}.${expiresRaw}`;

  const expected = await sign(payload, secret);
  if (!safeEqual(signature, expected)) return null;

  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || Date.now() > expires) return null;
  return decodeURIComponent(user);
}
