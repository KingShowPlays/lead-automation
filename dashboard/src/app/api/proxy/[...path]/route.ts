import { NextResponse } from "next/server";

/**
 * Server-side proxy to the lead API.
 *
 * The dashboard used to call the API straight from the browser with
 * NEXT_PUBLIC_API_KEY. Next inlines every NEXT_PUBLIC_ value into the client
 * bundle, so that key was readable by anyone who opened the page, and a login
 * screen in front of it would have protected nothing: the key was enough to
 * query the API directly.
 *
 * Requests now go through here. The key is read from a server-only variable and
 * attached on this side, so it never reaches the browser, and the middleware has
 * already checked the session before this handler runs.
 */

const API_URL = (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const API_KEY = process.env.API_KEY ?? process.env.NEXT_PUBLIC_API_KEY ?? "";

async function forward(request: Request, path: string[]): Promise<Response> {
  const incoming = new URL(request.url);
  const target = `${API_URL}/api/${path.join("/")}${incoming.search}`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) headers["x-api-key"] = API_KEY;

  let body: string | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.text();
  }

  try {
    const res = await fetch(target, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
    });
  } catch (error) {
    // The API being down must read as the API being down, not as a broken
    // dashboard, so the message the operator sees names the real problem.
    const reason = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Cannot reach the lead API: ${reason}` }, { status: 502 });
  }
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, ctx: Ctx) {
  return forward(request, (await ctx.params).path);
}
export async function POST(request: Request, ctx: Ctx) {
  return forward(request, (await ctx.params).path);
}
export async function PUT(request: Request, ctx: Ctx) {
  return forward(request, (await ctx.params).path);
}
export async function PATCH(request: Request, ctx: Ctx) {
  return forward(request, (await ctx.params).path);
}
export async function DELETE(request: Request, ctx: Ctx) {
  return forward(request, (await ctx.params).path);
}
