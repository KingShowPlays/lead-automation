#!/usr/bin/env node
/**
 * Re-captures the dashboard screenshots the film uses.
 *
 * These are the real dashboard, rendering real API responses, at the size the
 * film composites them at. The responses come from the demo dataset below
 * rather than from Mongo, so the shot is reproducible: the same numbers appear
 * every time, and they are the numbers the film's counters animate to.
 *
 * Start the dashboard first, then:
 *   node capture-ui.mjs [--base http://localhost:3000]
 *
 * Writes film/assets/01-overview.png, 02-queue.png and 04-import.png.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(__dirname, "film", "assets");

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const BASE = arg("base", "http://localhost:3000");

/* ------------------------------------------------------------------ */
/* The demo dataset the film is built on                               */
/* ------------------------------------------------------------------ */

const day = (n) => new Date(Date.now() - n * 86400000).toISOString();

const BUSINESSES = [
  ["Crystal Scents", "perfume stores", "Lagos", "NO_WEBSITE", 92, "hello@crystalscents.ng", "crystalscents"],
  ["Amara Kitchen", "restaurants", "Port Harcourt", "SOCIAL_MEDIA_ONLY", 88, "orders@amarakitchen.ng", "amarakitchen"],
  ["Glow Haven Beauty", "salons", "Abuja", "NO_WEBSITE", 86, null, "glowhaven"],
  ["Ember Grill House", "restaurants", "Lagos", "LINK_IN_BIO_ONLY", 84, "book@embergrill.ng", "embergrill"],
  ["Zuri Shortlets", "shortlets", "Lagos", "MENU_PLATFORM_ONLY", 81, "stay@zurishortlets.ng", "zurishortlets"],
  ["Nkechi Couture", "fashion stores", "Enugu", "NO_WEBSITE", 78, null, "nkechicouture"],
  ["Ironclad Fitness", "gyms", "Abuja", "BROKEN_WEBSITE", 76, "train@ironcladfit.ng", "ironcladfit"],
  ["Palm & Pepper", "restaurants", "Ibadan", "SOCIAL_MEDIA_ONLY", 74, null, "palmandpepper"],
  ["Sable Interiors", "interior design", "Lagos", "POOR_WEBSITE", 71, "studio@sableinteriors.ng", "sableinteriors"],
  ["Aurora Dental", "clinics", "Lagos", "NO_WEBSITE", 69, "front@auroradental.ng", "auroradental"],
  ["Kola & Sons Logistics", "logistics", "Kano", "NO_WEBSITE", 64, "ops@kolasons.ng", "kolasons"],
  ["Verde Plant Studio", "florists", "Abuja", "LINK_IN_BIO_ONLY", 61, "hello@verdeplant.ng", "verdeplant"],
];

const PITCH = `Hi Chidi,

I looked at Crystal Scents this morning. Every order still runs through your
Instagram DMs, and there is no site to send a customer to when they ask for
sizes or prices.

We build small, fast product sites for Lagos brands. Yours would take about a
week: the full range, prices, and a WhatsApp checkout your team already knows
how to use.

Worth fifteen minutes this week?

Yean, YEAN Technologies`;

function lead(i) {
  const [businessName, category, city, websiteType, leadScore, email, ig] = BUSINESSES[i];
  const pending = i < 10;
  const contacted = i >= 10;
  const converted = i >= 10;
  return {
    _id: `lead${String(i + 1).padStart(20, "0")}`,
    businessName,
    category,
    city,
    openingSoon: i < 4,
    rating: 4.4 + (i % 5) / 10,
    userRatingCount: 40 + i * 13,
    phone: `+23480${String(11000000 + i * 137).slice(0, 8)}`,
    phoneNormalized: `+23480${String(11000000 + i * 137).slice(0, 8)}`,
    whatsappAvailable: true,
    email: email ?? undefined,
    instagramUsername: ig,
    instagramUrl: `https://instagram.com/${ig}`,
    instagramActive: true,
    strongVisualBrand: i % 2 === 0,
    websiteUrl: websiteType === "NO_WEBSITE" ? undefined : `https://${ig}.ng`,
    websiteType,
    websiteStatus: websiteType,
    websiteProblemSummary:
      websiteType === "NO_WEBSITE"
        ? "No website at all. Every enquiry has to arrive as an Instagram message, and there is nowhere to send a customer who asks for prices."
        : "The site loads, but it is slow on mobile and has no way to take an order.",
    websiteCheck: {
      httpStatus: websiteType === "NO_WEBSITE" ? undefined : websiteType === "BROKEN_WEBSITE" ? 503 : 200,
      responseTimeMs: 1840 + i * 90,
      issues: websiteType === "NO_WEBSITE" ? ["NO_WEBSITE"] : ["SLOW_RESPONSE", "NOT_MOBILE_FRIENDLY"],
      platform: websiteType === "NO_WEBSITE" ? "None" : "WordPress",
      checkedAt: day(1),
    },
    leadScore,
    scoreBreakdown: [
      { rule: "No website at all", points: 40 },
      { rule: "Public email address published", points: 15 },
      { rule: "Active Instagram", points: 15 },
      { rule: "Recently opened", points: 20 },
    ],
    personalisedObservation: "Every order runs through Instagram DMs.",
    pitchSubject: `A website for ${businessName}`,
    pitchMessage: PITCH,
    pitchModel: "gpt-4o-mini",
    outreachChannel: email ? "EMAIL" : "INSTAGRAM_MANUAL",
    pipelineStage: pending ? "PENDING_APPROVAL" : "CONTACTED",
    outreachStatus: converted ? "CONVERTED" : contacted ? "CONTACTED" : "NOT_CONTACTED",
    approval: { status: pending ? "PENDING" : "APPROVED", reviewedAt: pending ? undefined : day(3) },
    timesContacted: contacted ? 1 : 0,
    lastContactedAt: contacted ? day(2) : undefined,
    responseStatus: converted ? "POSITIVE" : "NONE",
    estimatedDealValue: converted ? 565000 : undefined,
    optedOut: false,
    notes: "",
    tags: [],
    contactSources: email
      ? [{ field: "email", value: email, source: "WEBSITE_CONTACT_PAGE", collectedAt: day(4) }]
      : [{ field: "instagram", value: ig, source: "INSTAGRAM_BIO", collectedAt: day(4) }],
    createdAt: day(5 + i),
    updatedAt: day(1),
  };
}

const LEADS = BUSINESSES.map((_, i) => lead(i));
const PENDING = LEADS.filter((l) => l.approval.status === "PENDING");

const STATS = {
  totals: { total: 12, pendingApproval: 10, contacted: 2, interested: 2, converted: 2, optedOut: 0 },
  revenue: { totalDealValue: 1130000, convertedDeals: 2 },
  byStage: { DISCOVERED: 12, PENDING_APPROVAL: 10, CONTACTED: 2 },
  byWebsiteType: { NO_WEBSITE: 5, SOCIAL_MEDIA_ONLY: 2, LINK_IN_BIO_ONLY: 2, MENU_PLATFORM_ONLY: 1, BROKEN_WEBSITE: 1, POOR_WEBSITE: 1 },
  byCity: { Lagos: 5, Abuja: 3, "Port Harcourt": 1, Enugu: 1, Ibadan: 1, Kano: 1 },
  byOutreachStatus: { CONTACTED: 2, CONVERTED: 2 },
  bySource: { GOOGLE_PLACES: 8, MANUAL_IMPORT: 4 },
  onboardedAt: day(30),
  recentRuns: [9, 14, 11, 7, 12, 6, 10, 8].map((created, i) => ({
    _id: `run${i}`,
    trigger: "SCHEDULED",
    status: "SUCCESS",
    startedAt: day(i),
    finishedAt: day(i),
    totals: { found: created + 6, created, duplicates: 4, suppressed: 1, processed: created, qualified: Math.round(created * 0.8) },
  })),
  recentActivity: [
    ["PITCH_APPROVED", "EMAIL", 0],
    ["EMAIL_SENT", "EMAIL", 10],
    ["RESPONSE_RECORDED", "EMAIL", 10],
    ["DEAL_WON", "EMAIL", 11],
    ["PITCH_APPROVED", "INSTAGRAM_MANUAL", 2],
    ["PITCH_GENERATED", "EMAIL", 1],
  ].map(([action, channel, idx], i) => ({
    _id: `act${i}`,
    channel,
    direction: "OUTBOUND",
    action,
    subject: `A website for ${BUSINESSES[idx][0]}`,
    createdAt: day(i * 0.4),
    leadId: { _id: LEADS[idx]._id, businessName: BUSINESSES[idx][0], city: BUSINESSES[idx][2] },
  })),
  integrations: {
    googlePlaces: true,
    ai: true,
    aiProvider: "openai",
    email: true,
    emailProvider: "resend",
    gmail: false,
    authEnabled: true,
  },
};

function body(url) {
  const p = new URL(url).pathname;
  if (p === "/api/stats") return STATS;
  if (p === "/api/settings") return { settings: { onboardedAt: day(30), cities: [], categories: [], scoringWeights: {}, integrations: {} } };
  if (p === "/api/suppression") return { items: [], total: 0, pages: 1 };
  if (p.startsWith("/api/leads/")) return { lead: LEADS[0], history: STATS.recentActivity };
  if (p === "/api/leads") {
    const wantsQueue = new URL(url).searchParams.get("approvalStatus") === "PENDING";
    const items = wantsQueue ? PENDING : LEADS;
    return { items, total: items.length, page: 1, pages: 1 };
  }
  return {};
}

/* ------------------------------------------------------------------ */

const SHOTS = [
  { file: "01-overview.png", path: "/" },
  { file: "02-queue.png", path: "/queue" },
  {
    file: "04-import.png",
    path: "/leads",
    async open(page) {
      await page.getByRole("button", { name: /import leads/i }).click();
      await page.waitForTimeout(400);
      // Type the lines in rather than leaving the placeholder showing, so the
      // preview beside them lists three parsed businesses. The film's callout
      // on this shot says three were detected; the shot has to agree with it.
      await page.locator("textarea").first().fill(
        [
          "Crystal Scents, @crystalscents, crystal@scents.ng",
          "Amara Kitchen, https://amara.ng, Port Harcourt, restaurants",
          "Glow Haven Beauty, @glowhaven",
        ].join("\n"),
      );
      await page.locator("#import-city").fill("Lagos");
      await page.waitForTimeout(500);
    },
  },
];

const PREINSTALLED = "/opt/pw-browsers/chromium";
const browser = await chromium.launch(fs.existsSync(PREINSTALLED) ? { executablePath: PREINSTALLED } : {});
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
await context.route("**/api/**", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body(route.request().url())) }),
);
const page = await context.newPage();

fs.mkdirSync(ASSETS, { recursive: true });
for (const shot of SHOTS) {
  await page.goto(`${BASE}${shot.path}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  if (shot.open) await shot.open(page);
  const out = path.join(ASSETS, shot.file);
  await page.screenshot({ path: out });
  console.log(`${shot.file}  ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
}

await browser.close();
console.log("done. Re-render the film to pick these up.");
