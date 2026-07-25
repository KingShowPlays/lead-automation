#!/usr/bin/env node
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const film = pathToFileURL(path.join(here, "film", "index.html")).href;
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
await page.goto(film, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.FILM_READY === true);
await page.evaluate(() => document.fonts.ready);

const checks = [
  { selector: "#m3 .v", time: 16.2, label: "overview revenue" },
  { selector: "#rev .v", time: 54.2, label: "results revenue" },
];

const failures = [];
for (const check of checks) {
  await page.evaluate((time) => window.FILM.seek(time), check.time);
  const result = await page.$eval(check.selector, (element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    left: element.getBoundingClientRect().left,
    right: element.getBoundingClientRect().right,
    parentLeft: element.parentElement.getBoundingClientRect().left,
    parentRight: element.parentElement.getBoundingClientRect().right,
  }));
  if (result.scrollWidth > result.clientWidth + 1 || result.left < result.parentLeft - 1 || result.right > result.parentRight + 1) {
    failures.push(`${check.label}: ${JSON.stringify(result)}`);
  }
}

await browser.close();
if (failures.length) {
  console.error("Currency overflow audit failed:\n" + failures.join("\n"));
  process.exit(1);
}
console.log("Currency overflow audit passed for all animated money cards.");
