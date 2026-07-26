#!/usr/bin/env node
/**
 * Mobile overflow audit.
 *
 * Loads every route at real phone widths against a live API and fails on
 * anything that pushes past the edge of the screen. The rule it enforces is the
 * one that matters on a phone: the page may scroll down, never sideways, and
 * nothing may be cut off at the right edge.
 *
 * `overflow-x: hidden` on the page shell hides the symptom without fixing it,
 * so the document's own scrollWidth is not enough on its own. Every element is
 * measured against the viewport too, and anything sticking out is reported even
 * when a parent is quietly clipping it.
 *
 *   npm run dev            # dashboard, and the API it talks to
 *   node audit-mobile.mjs  # add --shots to write screenshots
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const BASE = arg("base", "http://localhost:3000");
const SHOTS = argv.includes("--shots");
const SHOT_DIR = path.join(__dirname, ".audit-shots");

/** iPhone SE, common Android, iPhone Pro Max, small tablet, tablet. */
const WIDTHS = arg("widths", "320,360,390,430,768,1024").split(",").map(Number);

const ROUTES = [
  { path: "/", name: "overview" },
  { path: "/queue", name: "queue" },
  { path: "/leads", name: "leads" },
  { path: "/leads?stage=DISCOVERED", name: "leads filtered" },
  { path: "/suppression", name: "suppression" },
  { path: "/settings", name: "settings" },
  {
    path: "/leads",
    name: "leads with filters open",
    async open(page) {
      const more = page.getByRole("button", { name: /more filters|filters/i }).first();
      if (await more.count()) await more.click().catch(() => {});
      await page.waitForTimeout(400);
    },
  },
];

/** Runs in the page. Returns everything that crosses the right edge. */
const PROBE = () => {
  const vw = window.innerWidth;
  const out = [];
  const doc = document.scrollingElement;

  if (doc.scrollWidth > vw + 1) {
    out.push({ kind: "page-scrolls-sideways", sel: "document", detail: `${doc.scrollWidth}px of content in ${vw}px` });
  }

  const describe = (el) => {
    const cls = (typeof el.className === "string" ? el.className : "").split(/\s+/).filter(Boolean).slice(0, 3).join(".");
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${cls ? `.${cls}` : ""}`;
  };

  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
    if (el.classList.contains("sr-only")) continue;
    // A deliberately scrollable box is allowed to hold something wider than
    // itself; that is what the scrollbar is for.
    if (/(auto|scroll)/.test(cs.overflowX)) continue;

    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;

    // Sticking out past the viewport is the failure, whether or not an
    // ancestor is hiding it.
    if (r.right > vw + 1 || r.left < -1) {
      // Inside a deliberate scroller the content is reachable, which is the
      // accepted way to show a wide table on a narrow screen. Inside an
      // overflow:hidden ancestor it is simply gone, and that is the fault.
      let reachable = false;
      let hiddenBy = null;
      for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
        const ox = getComputedStyle(n).overflowX;
        if (/(auto|scroll)/.test(ox)) {
          reachable = true;
          break;
        }
        if (/(hidden|clip)/.test(ox) && !hiddenBy) hiddenBy = describe(n);
      }
      if (reachable) continue;

      out.push({
        kind: hiddenBy ? "clipped-and-unreachable" : "outside-viewport",
        sel: describe(el),
        text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 50),
        detail:
          `left=${r.left.toFixed(0)} right=${r.right.toFixed(0)} width=${r.width.toFixed(0)} viewport=${vw}` +
          (hiddenBy ? `, hidden by ${hiddenBy}` : ""),
      });
    }
  }

  // Report the outermost offender per selector so one wide table does not
  // produce a hundred findings.
  const seen = new Set();
  return out.filter((f) => {
    const k = `${f.kind}|${f.sel}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

/**
 * Sign in first when the deployment has auth turned on, otherwise every route
 * redirects to the login page and the audit measures that instead.
 */
async function signIn(context) {
  const user = process.env.DASHBOARD_USER;
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return;
  const page = await context.newPage();
  const res = await page.request.post(`${BASE}/api/auth/login`, {
    data: { username: user ?? "admin", password },
  });
  if (!res.ok()) throw new Error(`audit could not sign in: ${res.status()}`);
  await page.close();
}

const PREINSTALLED = "/opt/pw-browsers/chromium";
const browser = await chromium.launch(fs.existsSync(PREINSTALLED) ? { executablePath: PREINSTALLED } : {});
const findings = [];
let checks = 0;
if (SHOTS) fs.rmSync(SHOT_DIR, { recursive: true, force: true });

for (const width of WIDTHS) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    deviceScaleFactor: 2,
    isMobile: width < 768,
    hasTouch: width < 768,
  });
  await signIn(context);
  const page = await context.newPage();

  for (const route of ROUTES) {
    await page.goto(`${BASE}${route.path}`, { waitUntil: "networkidle" }).catch(() => {});
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    await page.waitForTimeout(500);
    if (route.open) await route.open(page).catch(() => {});
    await page.waitForTimeout(200);

    const found = await page.evaluate(PROBE);
    checks++;
    for (const f of found) findings.push({ width, route: route.name, ...f });

    if (SHOTS) {
      fs.mkdirSync(SHOT_DIR, { recursive: true });
      await page.screenshot({ path: path.join(SHOT_DIR, `${route.name.replace(/\s+/g, "-")}-${width}.png`), fullPage: true });
    }
  }
  await context.close();
}

await browser.close();

const order = ["page-scrolls-sideways", "outside-viewport", "clipped-and-unreachable"];
findings.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.width - b.width);

console.log(`route/width combinations checked: ${checks}`);
if (findings.length === 0) {
  console.log("nothing overflows the screen");
  process.exit(0);
}
console.log(`\nissues (${findings.length}):`);
for (const f of findings) {
  console.log(`  ${f.kind}  ${f.route} @${f.width}  ${f.sel}`);
  if (f.text) console.log(`      text: ${f.text}`);
  console.log(`      ${f.detail}`);
}
process.exit(1);
