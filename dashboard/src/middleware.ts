import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/**
 * Gate every page and every proxied API call behind a signed session.
 *
 * Auth is off unless DASHBOARD_PASSWORD is set, so an existing deployment keeps
 * working until the operator opts in. Once set, nothing is reachable without a
 * valid cookie, including the API proxy: gating only the pages would leave the
 * data one fetch away for anybody who guessed the URL.
 */
export async function middleware(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();

  const secret = process.env.AUTH_SECRET || password;
  const user = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value, secret);
  if (user) return NextResponse.next();

  const { pathname, search } = req.nextUrl;

  // An expired session during background polling must not redirect a fetch
  // into an HTML login page; the caller needs a status it can act on.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const login = req.nextUrl.clone();
  login.pathname = "/login";
  login.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except the login page, its own auth endpoints, the health probe
  // and Next's static output.
  matcher: ["/((?!login|api/auth|health|_next/static|_next/image|favicon.ico).*)"],
};
