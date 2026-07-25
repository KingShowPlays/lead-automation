#!/usr/bin/env node
/**
 * Deterministic film renderer.
 *
 * Loads ad/film/index.html in Chromium, steps the GSAP master timeline one
 * frame at a time (no realtime playback, so nothing is dropped or jittered),
 * screenshots each frame, then encodes to H.264 with ffmpeg.
 *
 * Usage:
 *   node ad/render.mjs [--fps 30] [--scale 1] [--out ad/dist/yean-leads-60s.mp4]
 *
 * Requires playwright and ffmpeg-static, resolved from either this folder or
 * a global install (see ad/README.md).
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

const FPS = Number(arg("fps", 30));
const SCALE = Number(arg("scale", 1));
const OUT = path.resolve(__dirname, "..", arg("out", "ad/dist/yean-leads-60s.mp4"));
const FRAME_DIR = path.resolve(__dirname, ".frames");
const FILM = pathToFileURL(path.join(__dirname, "film", "index.html")).href;

function ffmpegPath() {
  for (const id of ["ffmpeg-static", "ffmpeg-static/index.js"]) {
    try {
      const p = require(id);
      if (typeof p === "string" && fs.existsSync(p)) return p;
    } catch {}
  }
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  return "ffmpeg"; // fall back to PATH
}

async function main() {
  fs.rmSync(FRAME_DIR, { recursive: true, force: true });
  fs.mkdirSync(FRAME_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  const browser = await chromium.launch({ args: ["--force-color-profile=srgb", "--disable-lcd-text"] });
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: SCALE,
    reducedMotion: "no-preference",
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(FILM, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForFunction(() => window.FILM_READY === true, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600); // let images/fonts settle before frame 0

  const duration = await page.evaluate(() => window.FILM.duration);
  const total = Math.ceil(duration * FPS);
  console.log(`Rendering ${total} frames at ${FPS}fps (${duration}s), scale ${SCALE}x`);

  const t0 = Date.now();
  for (let i = 0; i < total; i++) {
    const t = i / FPS;
    await page.evaluate((tt) => window.FILM.seek(tt), t);
    await page.screenshot({
      path: path.join(FRAME_DIR, `f${String(i).padStart(5, "0")}.jpg`),
      type: "jpeg",
      quality: 96,
    });
    if (i % 120 === 0 || i === total - 1) {
      const pct = (((i + 1) / total) * 100).toFixed(1);
      const el = ((Date.now() - t0) / 1000).toFixed(0);
      process.stdout.write(`  ${pct}%  (frame ${i + 1}/${total}, ${el}s)\n`);
    }
  }
  if (errors.length) console.warn("page errors:", errors.slice(0, 5));
  await browser.close();

  console.log("Encoding with ffmpeg...");
  await encode();
  fs.rmSync(FRAME_DIR, { recursive: true, force: true });

  const mb = (fs.statSync(OUT).size / 1e6).toFixed(2);
  console.log(`Done: ${OUT} (${mb} MB)`);
}

function encode() {
  const args = [
    "-y",
    "-framerate", String(FPS),
    "-i", path.join(FRAME_DIR, "f%05d.jpg"),
    "-c:v", "libx264",
    "-profile:v", "high",
    "-preset", "slow",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-r", String(FPS),
    OUT,
  ];
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath(), args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}\n${err.slice(-1500)}`))));
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
