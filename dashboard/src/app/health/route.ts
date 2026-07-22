import { NextResponse } from "next/server";

/**
 * Liveness endpoint for platform health checks. The API and the dashboard
 * share Dockerfiles and railway.json config that can end up applied to
 * either service depending on how each is deployed, so both apps answer
 * GET /health the same way to make the healthcheck path irrelevant to
 * which service picks up which config.
 */
export function GET() {
  return NextResponse.json({ ok: true, service: "yean-dashboard" });
}
