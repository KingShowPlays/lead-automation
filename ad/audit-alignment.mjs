#!/usr/bin/env node
/**
 * Alignment audit for the film.
 *
 * Walks the timeline and, at each scene's settled moment, checks that:
 *  - every icon/value sits at the true centre of its container
 *  - nothing overflows the 1920x1080 canvas
 *  - overlay components do not collide with the UI frames they annotate
 *  - elements meant to share an edge actually share it
 *
 * Run: node ad/audit-alignment.mjs
 */
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILM = pathToFileURL(path.join(__dirname, "film", "index.html")).href;
const TOL = 1.0; // px

/** Sample times where each scene is fully settled. */
const SAMPLES = [
  { t: 6.0,  scene: "#s1" },
  { t: 10.2, scene: "#s2" },
  { t: 16.0, scene: "#s3" },
  { t: 21.5, scene: "#s4", note: "three cards" },
  { t: 27.0, scene: "#s4", note: "import frame in" },
  { t: 35.0, scene: "#s5", note: "audit checks" },
  { t: 40.5, scene: "#s5", note: "score settled" },
  { t: 45.0, scene: "#s6", note: "pitch highlight" },
  { t: 50.0, scene: "#s6", note: "approval callout" },
  { t: 54.0, scene: "#s7" },
  { t: 59.5, scene: "#s8" },
];

/** Pairs that must be concentric: [child, parent, label]. */
const CENTRED = [
  ["#scoreNum", "#ringBox", "score value in ring"],
  ["#ringSvg", "#ringBox", "ring svg in box"],
  ["#s2mark svg", "#s2mark", "brand mark glyph"],
  ["#s8mark svg", "#s8mark", "closing mark glyph"],
  ["#c1 .ic svg", "#c1 .ic", "sources icon 1"],
  ["#c2 .ic svg", "#c2 .ic", "sources icon 2"],
  ["#c3 .ic svg", "#c3 .ic", "sources icon 3"],
];

/**
 * Boxes that draw a border or a background, and so must visibly contain what is
 * written inside them. A counter that ends in seven digits is the usual way
 * this breaks: the card is sized for the number it starts at, not the one it
 * animates to.
 */
const CONTAINERS = ".metric, .callout, .card, .chip, .pill, .frow, .tick, #s5chip";

/** Elements that must stay inside the canvas at the sampled time. */
const IN_CANVAS = [
  "#s1wrap", "#s2mark", "#s2name", "#s2tag", "#s2sub", "#auditCard", "#scoreWrap", "#funnel", "#rev",
  "#m1", "#m2", "#m3", "#c1", "#c2", "#c3", "#co4", "#co6a", "#co6b",
  "#f3", "#f4", "#f6", "#capInner", "#s8flow",
];

const results = { pass: 0, fail: [] };
const ok = (msg) => { results.pass++; };
const bad = (msg) => { results.fail.push(msg); };

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
await page.goto(FILM, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.FILM_READY === true);
await page.evaluate(() => document.fonts.ready);

const rect = (sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    // effective opacity: a scene at 0 hides everything inside it
    let op = 1, node = el;
    while (node && node !== document.body) {
      op *= Number(getComputedStyle(node).opacity);
      node = node.parentElement;
    }
    return { x: r.left, y: r.top, w: r.width, h: r.height, op };
  }, sel);

const visible = (r) => r && r.w > 0 && r.h > 0 && r.op > 0.05;

for (const { t, scene, note } of SAMPLES) {
  await page.evaluate((tt) => window.FILM.seek(tt), t);
  const label = `t=${t}s ${scene}${note ? ` (${note})` : ""}`;

  // concentric checks
  for (const [childSel, parentSel, name] of CENTRED) {
    const c = await rect(childSel), p = await rect(parentSel);
    if (!visible(c) || !visible(p)) continue;
    const dx = c.x + c.w / 2 - (p.x + p.w / 2);
    const dy = c.y + c.h / 2 - (p.y + p.h / 2);
    if (Math.abs(dx) > TOL || Math.abs(dy) > TOL)
      bad(`${label}: ${name} off-centre by dx=${dx.toFixed(2)} dy=${dy.toFixed(2)}`);
    else ok();
  }

  // canvas bounds
  for (const sel of IN_CANVAS) {
    const r = await rect(sel);
    if (!visible(r)) continue;
    if (r.x < -0.5 || r.y < -0.5 || r.x + r.w > 1920.5 || r.y + r.h > 1080.5)
      bad(`${label}: ${sel} outside canvas (x=${r.x.toFixed(0)} y=${r.y.toFixed(0)} w=${r.w.toFixed(0)} h=${r.h.toFixed(0)})`);
    else ok();
  }

  // text must stay inside the box that is drawn around it
  const spills = await page.evaluate((sel) => {
    const found = [];
    for (const box of document.querySelectorAll(sel)) {
      const br = box.getBoundingClientRect();
      if (br.width === 0 || br.height === 0) continue;
      let op = 1;
      for (let n = box; n && n !== document.body; n = n.parentElement) op *= Number(getComputedStyle(n).opacity);
      if (op <= 0.05) continue;

      const cs = getComputedStyle(box);
      const inner = {
        left: br.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth),
        right: br.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth),
        top: br.top + parseFloat(cs.paddingTop) + parseFloat(cs.borderTopWidth),
        bottom: br.bottom - parseFloat(cs.paddingBottom) - parseFloat(cs.borderBottomWidth),
      };
      const name = box.id ? `#${box.id}` : `.${String(box.className).split(/\s+/)[0]}`;

      for (const el of box.querySelectorAll("*")) {
        if (el.children.length > 0) continue;
        const text = (el.textContent || "").trim();
        if (!text) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        const over = Math.max(inner.left - r.left, r.right - inner.right, inner.top - r.top, r.bottom - inner.bottom);
        if (over > 1.5) {
          found.push(`${name}: "${text.slice(0, 22)}" spills ${over.toFixed(0)}px outside the card`);
          continue;
        }

        // Fitting is not the same as looking like it fits. A figure that runs
        // from one border to the other reads as overflowing even when it is
        // inside by a pixel, especially beside a card holding two digits. Hold
        // the headline value to most of the width, not all of it.
        if (el.closest(".v") === null) continue;
        const innerWidth = inner.right - inner.left;
        if (innerWidth <= 0) continue;
        // Measure the glyphs, not the block around them: a full-width block
        // holding the word "12" is not tight.
        const range = document.createRange();
        range.selectNodeContents(el);
        const ink = range.getBoundingClientRect().width;
        range.detach?.();
        if (ink / innerWidth > 0.88) {
          found.push(
            `${name}: "${text.slice(0, 22)}" fills ${Math.round((ink / innerWidth) * 100)}% of the card, too tight to read as contained`,
          );
        }
      }
    }
    return found;
  }, CONTAINERS);
  for (const s of spills) bad(`${label}: ${s}`);
  if (spills.length === 0) ok();

  // overlay/frame collisions that would look like a layout bug
  const overlaps = [
    ["#c3", "#f4", "sources card 3", "import frame"],
    ["#c2", "#f4", "sources card 2", "import frame"],
    ["#co4", "#f4", "import callout", "import frame"],
    ["#auditCard", "#scoreWrap", "audit card", "score ring"],
    ["#funnel", "#rev", "funnel", "revenue card"],
    ["#m1", "#m3", "metric 1", "metric 3"],
  ];
  for (const [aSel, bSel, aName, bName] of overlaps) {
    const a = await rect(aSel), b = await rect(bSel);
    if (!visible(a) || !visible(b)) continue;
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (ox > 2 && oy > 2) bad(`${label}: ${aName} overlaps ${bName} by ${ox.toFixed(0)}x${oy.toFixed(0)}px`);
    else ok();
  }
}

// shared-edge checks on the sets that should line up
await page.evaluate(() => window.FILM.seek(16.0));
const m1 = await rect("#m1"), m3 = await rect("#m3");
if (visible(m1) && visible(m3)) {
  if (Math.abs(m1.x - m3.x) > TOL) bad(`metric 1 and 3 left edges differ by ${(m1.x - m3.x).toFixed(2)}px`);
  else ok();
  if (Math.abs(m1.w - m3.w) > TOL) bad(`metric 1 and 3 widths differ by ${(m1.w - m3.w).toFixed(2)}px`);
  else ok();
}
await page.evaluate(() => window.FILM.seek(21.5));
const cards = [await rect("#c1"), await rect("#c2"), await rect("#c3")].filter(visible);
if (cards.length === 3) {
  const tops = cards.map((c) => c.y);
  if (Math.max(...tops) - Math.min(...tops) > TOL) bad(`source cards not on one baseline: ${tops.map((v) => v.toFixed(1)).join(", ")}`);
  else ok();
  const gaps = [cards[1].x - (cards[0].x + cards[0].w), cards[2].x - (cards[1].x + cards[1].w)];
  if (Math.abs(gaps[0] - gaps[1]) > TOL) bad(`source card gaps uneven: ${gaps.map((g) => g.toFixed(1)).join(" vs ")}`);
  else ok();
}

await browser.close();

console.log(`checks passed: ${results.pass}`);
if (pageErrors.length) console.log("page errors:", pageErrors.slice(0, 3));
if (results.fail.length) {
  console.log(`\nissues (${results.fail.length}):`);
  for (const f of results.fail) console.log("  -", f);
  process.exit(1);
}
console.log("no alignment issues");
