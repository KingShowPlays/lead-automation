import { NextResponse } from "next/server";
import { SESSION_COOKIE, createSessionToken } from "@/lib/session";

const SESSION_TTL_SECONDS = 60 * 60 * 12;

/** Length-independent comparison so a wrong password reveals nothing by timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(request: Request) {
  const expectedPassword = process.env.DASHBOARD_PASSWORD;
  const expectedUser = process.env.DASHBOARD_USER || "admin";
  if (!expectedPassword) {
    return NextResponse.json({ error: "Sign-in is not configured on this deployment" }, { status: 500 });
  }

  let username = "";
  let password = "";
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    username = String(body.username ?? "");
    password = String(body.password ?? "");
  } catch {
    return NextResponse.json({ error: "Malformed request" }, { status: 400 });
  }

  // Both comparisons always run, so a valid username cannot be discovered by
  // measuring how quickly the request fails.
  const userOk = safeEqual(username, expectedUser);
  const passOk = safeEqual(password, expectedPassword);
  if (!userOk || !passOk) {
    return NextResponse.json({ error: "That username and password do not match" }, { status: 401 });
  }

  const secret = process.env.AUTH_SECRET || expectedPassword;
  const token = await createSessionToken(expectedUser, secret, SESSION_TTL_SECONDS);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Railway terminates TLS, so the cookie is only marked secure in production
    // where the connection actually is.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
