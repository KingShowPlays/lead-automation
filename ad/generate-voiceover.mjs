#!/usr/bin/env node
/**
 * Generates the narration and muxes it onto the rendered film.
 *
 * Each line is synthesised on its own and laid down at its exact timecode (the
 * same ones in voiceover-script.md and captions.srt), so the read stays locked
 * to the picture instead of drifting. A line that overruns its slot is nudged
 * faster with atempo (pitch preserved) rather than allowed to collide with the
 * next one.
 *
 * Backends, in order of quality:
 *   ELEVENLABS_API_KEY   most natural, recommended for the published cut
 *   OPENAI_API_KEY       gpt-4o-mini-tts, also very good
 *   (none)               Google Translate TTS, no key required
 *
 *   node generate-voiceover.mjs [--voice en] [--backend auto]
 *
 * Output: dist/voiceover.mp3 and dist/yean-leads-60s-vo.mp4
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIST = path.join(__dirname, "dist");
const PARTS = path.join(DIST, "vo-parts");

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

/** [in-point seconds, must-finish-by seconds, line]. Matches voiceover-script.md. */
const LINES = [
  [0.60, 8.14, "Every week, new businesses open. By the time Google lists them, someone else built their website."],
  [8.44, 11.18, "YEAN Leads finds them first."],
  [11.48, 17.73, "One workspace. Every business you track, every stage, every naira won."],
  [18.03, 23.03, "Three sources feed it. Google Places sweeps the cities you target."],
  [23.33, 28.71, "Or paste an Instagram find the day it opens, long before Google."],
  [29.01, 36.34, "Every site is audited automatically. DNS, SSL, redirects, mobile."],
  [36.64, 41.62, "Every lead is scored, so you only see the ones worth your time."],
  [41.92, 46.75, "AI writes the pitch from the real problem it found on their site."],
  [47.05, 51.19, "Then it waits. Nothing is sent without your approval."],
  [51.49, 54.76, "Cold discovery becomes a closed deal."],
  [55.60, 59.95, "YEAN Leads. Stop hunting. Start reviewing."],
];

const ELEVEN_VOICE = process.env.ELEVENLABS_VOICE_ID || "pNInz6obpgDQGcFmaJgB"; // Adam
const OPENAI_VOICE = process.env.OPENAI_TTS_VOICE || "onyx";
const GOOGLE_LANG = arg("voice", process.env.GOOGLE_TTS_LANG || "en");

function ffmpegPath() {
  try {
    const p = require("ffmpeg-static");
    if (typeof p === "string" && fs.existsSync(p)) return p;
  } catch {}
  return process.env.FFMPEG_PATH || "ffmpeg";
}

const ff = (args) =>
  new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath(), args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (c) => (c === 0 ? resolve(err) : reject(new Error(`ffmpeg ${c}: ${err.slice(-900)}`))));
  });

/** Duration of an audio file, via ffmpeg's own report. */
async function durationOf(file) {
  const log = await ff(["-i", file, "-f", "null", "-"]).catch((e) => e.message);
  const m = /time=(\d+):(\d+):(\d+\.\d+)/g;
  let last = null, hit;
  while ((hit = m.exec(log)) !== null) last = hit;
  if (!last) return 0;
  return +last[1] * 3600 + +last[2] * 60 + +last[3];
}

async function ttsElevenLabs(text, out) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE}`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
}

async function ttsOpenAI(text, out) {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice: OPENAI_VOICE,
      input: text,
      instructions: "Calm, confident, unhurried. Explaining to a peer, not selling.",
    }),
  });
  if (!res.ok) throw new Error(`OpenAI TTS ${res.status}: ${(await res.text()).slice(0, 300)}`);
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
}

/** Google Translate TTS. No key, but capped at ~200 chars, so long lines are chunked. */
async function ttsGoogle(text, out) {
  const chunks = [];
  let rest = text.trim();
  while (rest.length > 190) {
    let cut = rest.lastIndexOf(" ", 190);
    if (cut < 60) cut = 190;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);

  const files = [];
  for (let i = 0; i < chunks.length; i++) {
    const url =
      "https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob" +
      `&tl=${encodeURIComponent(GOOGLE_LANG)}&q=${encodeURIComponent(chunks[i])}`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error(`Google TTS ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 512) throw new Error("Google TTS returned an empty clip");
    const f = `${out}.part${i}.mp3`;
    fs.writeFileSync(f, buf);
    files.push(f);
  }
  if (files.length === 1) {
    fs.renameSync(files[0], out);
  } else {
    const list = `${out}.list`;
    fs.writeFileSync(list, files.map((f) => `file '${f}'`).join("\n"));
    await ff(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-y", out]);
    files.forEach((f) => fs.rmSync(f, { force: true }));
    fs.rmSync(list, { force: true });
  }
}

async function main() {
  let backend = arg("backend", "auto");
  if (backend === "auto") {
    backend = process.env.ELEVENLABS_API_KEY ? "elevenlabs" : process.env.OPENAI_API_KEY ? "openai" : "google";
  }
  const synth = { elevenlabs: ttsElevenLabs, openai: ttsOpenAI, google: ttsGoogle }[backend];
  if (!synth) throw new Error(`unknown backend: ${backend}`);

  const video = path.join(DIST, "yean-leads-60s.mp4");
  if (!fs.existsSync(video)) throw new Error(`render the film first (missing ${video})`);

  fs.rmSync(PARTS, { recursive: true, force: true });
  fs.mkdirSync(PARTS, { recursive: true });

  console.log(`Synthesising ${LINES.length} lines with ${backend}${backend === "google" ? ` (${GOOGLE_LANG})` : ""}...`);
  const clips = [];
  for (let i = 0; i < LINES.length; i++) {
    const [at, until, text] = LINES[i];
    const raw = path.join(PARTS, `r${String(i).padStart(2, "0")}.mp3`);
    await synth(text, raw);

    // Fit the clip into its slot: speed up only if it would run past the window.
    const slot = until - at;
    const dur = await durationOf(raw);
    const fitted = path.join(PARTS, `l${String(i).padStart(2, "0")}.mp3`);
    let tempo = 1;
    if (dur > slot && slot > 0) tempo = Math.min(dur / slot, 1.35);
    if (tempo > 1.001) {
      await ff(["-i", raw, "-filter:a", `atempo=${tempo.toFixed(4)}`, "-y", fitted]);
    } else {
      fs.copyFileSync(raw, fitted);
    }
    clips.push(fitted);
    console.log(`  ${i + 1}/${LINES.length}  ${dur.toFixed(2)}s in ${slot.toFixed(2)}s slot${tempo > 1.001 ? ` (x${tempo.toFixed(2)})` : ""}`);
  }

  // Bed length is taken from the film itself; a shorter bed would make
  // -shortest truncate the video at the mux step.
  const filmDur = await durationOf(video);
  const bed = Math.max(filmDur, LINES[LINES.length - 1][1] + 1).toFixed(2);
  console.log(`film is ${filmDur.toFixed(2)}s, laying a ${bed}s bed`);
  const inputs = ["-f", "lavfi", "-t", bed, "-i", "anullsrc=r=44100:cl=stereo"];
  clips.forEach((c) => inputs.push("-i", c));
  const delays = LINES.map(([at], i) => {
    const ms = Math.round(at * 1000);
    return `[${i + 1}:a]aresample=44100,adelay=${ms}|${ms}[d${i}]`;
  }).join(";");
  const mixIns = LINES.map((_, i) => `[d${i}]`).join("");
  // gentle high-shelf lifts diction, loudnorm gives a consistent broadcast level
  const filter =
    `${delays};[0:a]${mixIns}amix=inputs=${LINES.length + 1}:normalize=0:duration=first[m];` +
    `[m]highpass=f=80,treble=g=2.5:f=3500,loudnorm=I=-16:TP=-1.5:LRA=11[a]`;

  const voMp3 = path.join(DIST, "voiceover.mp3");
  await ff([...inputs, "-filter_complex", filter, "-map", "[a]", "-b:a", "192k", "-y", voMp3]);
  console.log("voiceover:", voMp3, `(${(fs.statSync(voMp3).size / 1e6).toFixed(2)} MB)`);

  const outMp4 = path.join(DIST, "yean-leads-60s-vo.mp4");
  await ff(["-i", video, "-i", voMp3, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-y", outMp4]);
  fs.rmSync(PARTS, { recursive: true, force: true });
  console.log("done:", outMp4, `(${(fs.statSync(outMp4).size / 1e6).toFixed(2)} MB)`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
