import { NextResponse } from "next/server";

/**
 * Empties the working data, behind the operator's own password.
 *
 * The password lives here rather than on the API because this is where it
 * already is: the dashboard holds DASHBOARD_PASSWORD for sign-in, and the API
 * has never known it. Re-typing it is the point. A signed-in session is enough
 * to look at anything, and should not be enough to delete everything from a
 * laptop somebody walked away from.
 */
const API_URL = (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const API_KEY = process.env.API_KEY ?? "";

/** Length-independent comparison so a wrong password reveals nothing by timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(request: Request) {
  const expected = process.env.DASHBOARD_PASSWORD;

  // Nothing to check against means nothing to stop a stray request, so the
  // safe answer is to refuse rather than to wipe on a bare POST.
  if (!expected) {
    return NextResponse.json(
      { error: "Set DASHBOARD_PASSWORD on the dashboard before this can be used." },
      { status: 503 },
    );
  }

  let password = "";
  let includeSuppression = false;
  try {
    const body = (await request.json()) as { password?: string; includeSuppression?: boolean };
    password = String(body.password ?? "");
    includeSuppression = Boolean(body.includeSuppression);
  } catch {
    return NextResponse.json({ error: "Malformed request" }, { status: 400 });
  }

  if (!safeEqual(password, expected)) {
    return NextResponse.json({ error: "That password is not right" }, { status: 401 });
  }

  const res = await fetch(`${API_URL}/api/settings/wipe-data`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ includeSuppression }),
    cache: "no-store",
  });

  const body = await res.json().catch(() => ({}));
  return NextResponse.json(body, { status: res.status });
}
