#!/usr/bin/env node
/**
 * Synthesises the narration and muxes it onto the rendered film.
 *
 * Each line is generated separately and laid down at its exact timecode (the
 * same ones in voiceover-script.md and captions.srt), so the read stays locked
 * to the picture instead of drifting.
 *
 *   export ELEVENLABS_API_KEY=...   # preferred, most natural
 *   # or
 *   export OPENAI_API_KEY=...
 *   node generate-voiceover.mjs
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

/** in-point (seconds) -> line. Must match voiceover-script.md. */
const LINES = [
  [0.6,  "Every week new businesses open. By the time Google lists them, someone else has already built their website."],
  [6.4,  "YEAN Leads finds them first."],
  [11.0, "One workspace shows every business you are tracking, what stage it is in, and the revenue you have won."],
  [19.0, "Three discovery sources feed it. Google Places sweeps the cities you target."],
  [23.4, "Paste an Instagram find the day it opens, months before Google catches up."],
  [27.2, "Every website is audited automatically. DNS, SSL, redirects, mobile, and the platform it runs on."],
  [31.2, "Each lead is scored, so you only ever see the ones worth your time."],
  [35.2, "AI writes a pitch from the real problem it found on their site."],
  [39.2, "Then it stops and waits for you. Nothing is ever sent without your approval."],
  [43.6, "Cold discovery becomes a closed deal, without the hours of manual hunting."],
  [48.6, "YEAN Leads. Stop hunting. Start reviewing."],
];

const ELEVEN_VOICE = process.env.ELEVENLABS_VOICE_ID || "pNInz6obpgDQGcFmaJgB"; // Adam
const OPENAI_VOICE = process.env.OPENAI_TTS_VOICE || "onyx";

function ffmpegPath() {
  try {
    const p = require("ffmpeg-static");
    if (typeof p === "string" && fs.existsSync(p)) return p;
  } catch {}
  return process.env.FFMPEG_PATH || "ffmpeg";
}

const run = (args) =>
  new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath(), args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg ${c}: ${err.slice(-800)}`))));
  });

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

async function main() {
  const useEleven = Boolean(process.env.ELEVENLABS_API_KEY);
  const useOpenAI = !useEleven && Boolean(process.env.OPENAI_API_KEY);
  if (!useEleven && !useOpenAI) {
    console.error("Set ELEVENLABS_API_KEY or OPENAI_API_KEY first. See voiceover-script.md.");
    process.exit(1);
  }
  const video = path.join(DIST, "yean-leads-60s.mp4");
  if (!fs.existsSync(video)) {
    console.error(`Render the film first: node render.mjs   (missing ${video})`);
    process.exit(1);
  }

  fs.rmSync(PARTS, { recursive: true, force: true });
  fs.mkdirSync(PARTS, { recursive: true });

  console.log(`Synthesising ${LINES.length} lines via ${useEleven ? "ElevenLabs" : "OpenAI"}...`);
  for (let i = 0; i < LINES.length; i++) {
    const [, text] = LINES[i];
    const out = path.join(PARTS, `l${String(i).padStart(2, "0")}.mp3`);
    if (useEleven) await ttsElevenLabs(text, out);
    else await ttsOpenAI(text, out);
    console.log(`  ${i + 1}/${LINES.length}`);
  }

  // Lay each clip at its exact in-point on a 53s silent bed, then mux.
  const inputs = ["-f", "lavfi", "-t", "53", "-i", "anullsrc=r=44100:cl=stereo"];
  LINES.forEach((_, i) => inputs.push("-i", path.join(PARTS, `l${String(i).padStart(2, "0")}.mp3`)));
  const delays = LINES.map(([at], i) => `[${i + 1}:a]adelay=${Math.round(at * 1000)}|${Math.round(at * 1000)}[d${i}]`).join(";");
  const mixIns = LINES.map((_, i) => `[d${i}]`).join("");
  const filter = `${delays};[0:a]${mixIns}amix=inputs=${LINES.length + 1}:normalize=0:duration=first[a]`;

  const voMp3 = path.join(DIST, "voiceover.mp3");
  await run([...inputs, "-filter_complex", filter, "-map", "[a]", "-b:a", "192k", "-y", voMp3]);
  console.log("voiceover:", voMp3);

  const outMp4 = path.join(DIST, "yean-leads-60s-vo.mp4");
  await run(["-i", video, "-i", voMp3, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-y", outMp4]);
  fs.rmSync(PARTS, { recursive: true, force: true });
  console.log("done:", outMp4);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
