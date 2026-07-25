#!/usr/bin/env node
/**
 * Writes the film's instrumental track and muxes it onto the silent cut.
 *
 * Everything is synthesised here, sample by sample, so the music ships with the
 * repository instead of depending on a library, a licence or a download. The
 * arrangement is cut to the film's own scene windows: the beat arrives on the
 * brand reveal, the lead comes in over the audit, the drums drop out for the
 * closing card.
 *
 *   node compose-soundtrack.mjs [--bpm 120]
 *
 * Output: dist/soundtrack.wav and dist/yean-leads-60s-music.mp4
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIST = path.join(__dirname, "dist");

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

const SR = 44100;
const BPM = Number(arg("bpm", 120));
const BEAT = 60 / BPM; // 0.5s
const STEP = BEAT / 4; // one sixteenth
const BAR = BEAT * 4; // 2s

/**
 * Scene boundaries, copied from the film's own SC table. The arrangement hangs
 * off these, so a retimed cut only needs these numbers changed.
 */
const SCENE = {
  problem: 0.15,
  brand: 8.1,
  overview: 11.15,
  sources: 17.85,
  audit: 28.85,
  pitch: 41.75,
  results: 51.15,
  close: 55.35,
  end: 61.5,
};

const DUR = SCENE.end + 1.6; // room for the final chord to ring out
const N = Math.ceil(DUR * SR);

/* ------------------------------------------------------------------ */
/* Small DSP kit                                                       */
/* ------------------------------------------------------------------ */

/** Deterministic noise, so two runs produce byte-identical audio. */
let seed = 0x2f6e2b1;
function noise() {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return ((seed >>> 0) / 0xffffffff) * 2 - 1;
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** One-pole low pass. `a` is the smoothing coefficient, 0 to 1. */
function lowpass(buf, cutoff) {
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
  let y = 0;
  for (let i = 0; i < buf.length; i++) {
    y += a * (buf[i] - y);
    buf[i] = y;
  }
  return buf;
}

/** One-pole high pass, as the complement of the low pass above. */
function highpass(buf, cutoff) {
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
  let y = 0;
  for (let i = 0; i < buf.length; i++) {
    y += a * (buf[i] - y);
    buf[i] -= y;
  }
  return buf;
}

/** Exponential decay, 1 at t=0. */
const decay = (t, tau) => Math.exp(-t / tau);

/* ------------------------------------------------------------------ */
/* Voices                                                              */
/* ------------------------------------------------------------------ */

const left = new Float64Array(N);
const right = new Float64Array(N);
/** Kick envelope, kept separately so the bass and pad can duck against it. */
const duck = new Float64Array(N).fill(1);

function add(at, samples, gain = 1, pan = 0) {
  const start = Math.round(at * SR);
  const gl = gain * Math.min(1, 1 - pan);
  const gr = gain * Math.min(1, 1 + pan);
  for (let i = 0; i < samples.length; i++) {
    const j = start + i;
    if (j < 0 || j >= N) continue;
    left[j] += samples[i] * gl;
    right[j] += samples[i] * gr;
  }
}

function kick(at, gain = 1) {
  const len = Math.round(0.42 * SR);
  const out = new Float64Array(len);
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    // Pitch drops from a click down to a chest thump.
    const f = 44 + 150 * decay(t, 0.028);
    phase += (2 * Math.PI * f) / SR;
    const body = Math.sin(phase) * decay(t, 0.125);
    const click = noise() * decay(t, 0.004) * 0.35;
    out[i] = (body + click) * 0.95;
  }
  add(at, out, gain);

  // Carve a dip in everything tonal under each kick. This is the pump that
  // makes a simple loop feel like it is moving.
  const start = Math.round(at * SR);
  const hold = Math.round(0.26 * SR);
  for (let i = 0; i < hold; i++) {
    const j = start + i;
    if (j < 0 || j >= N) continue;
    const d = 0.38 + 0.62 * (1 - decay(i / SR, 0.085));
    duck[j] = Math.min(duck[j], d);
  }
}

function clap(at, gain = 1) {
  const len = Math.round(0.34 * SR);
  const out = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    // Three quick bursts then a tail: the classic hand-clap shape.
    const burst = t < 0.012 ? 1 : t < 0.021 ? 0.85 : t < 0.032 ? 0.7 : decay(t - 0.032, 0.085);
    out[i] = noise() * burst;
  }
  highpass(out, 900);
  lowpass(out, 7200);
  add(at, out, gain * 0.55);
}

function hat(at, open = false, gain = 1, pan = 0) {
  const len = Math.round((open ? 0.3 : 0.075) * SR);
  const out = new Float64Array(len);
  const tau = open ? 0.11 : 0.018;
  for (let i = 0; i < len; i++) out[i] = noise() * decay(i / SR, tau);
  highpass(out, 6000);
  lowpass(out, 13000);
  add(at, out, gain * 0.16, pan);
}

function crash(at, gain = 1) {
  const len = Math.round(2.2 * SR);
  const out = new Float64Array(len);
  for (let i = 0; i < len; i++) out[i] = noise() * decay(i / SR, 0.75);
  highpass(out, 3000);
  lowpass(out, 14000);
  add(at, out, gain * 0.16);
}

/**
 * Karplus-Strong pluck. A burst of noise fed through a delay line with a
 * one-pole average sounds like a struck string, and costs almost nothing.
 */
function pluck(at, freq, dur, gain = 1, pan = 0, bright = 0.5) {
  const len = Math.round(dur * SR);
  const period = Math.max(2, Math.round(SR / freq));

  // The excitation is filtered before it enters the loop. White noise straight
  // in makes every note start as a burst of hiss, and sixteen of those a bar
  // turns the whole track into a wash.
  const line = new Float64Array(period);
  for (let i = 0; i < period; i++) line[i] = noise();
  lowpass(line, 1400 + bright * 3200);
  let energy = 0;
  for (let i = 0; i < period; i++) energy = Math.max(energy, Math.abs(line[i]));
  if (energy > 0) for (let i = 0; i < period; i++) line[i] /= energy;

  // Plain Karplus-Strong: average two neighbours each time round the loop, so
  // the harmonics fall away in order and what is left is a pitched, warm note.
  const loss = 0.986 + bright * 0.012;
  const out = new Float64Array(len);
  let idx = 0;
  for (let i = 0; i < len; i++) {
    const next = (idx + 1) % period;
    const v = (line[idx] + line[next]) * 0.5 * loss;
    line[idx] = v;
    out[i] = v;
    idx = next;
  }

  // Soften the attack and the cut-off so notes neither click nor spit.
  const atk = Math.round(0.004 * SR);
  for (let i = 0; i < atk && i < len; i++) out[i] *= i / atk;
  const fade = Math.round(0.03 * SR);
  for (let i = 0; i < fade && i < len; i++) out[len - 1 - i] *= i / fade;
  add(at, out, gain * 0.85, pan);
}

function bass(at, freq, dur, gain = 1) {
  const len = Math.round(dur * SR);
  const out = new Float64Array(len);
  let p1 = 0;
  let p2 = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    p1 += (2 * Math.PI * freq) / SR;
    p2 += (2 * Math.PI * freq * 2) / SR;
    const a = Math.min(1, t / 0.008) * Math.min(1, (dur - t) / 0.05);
    // A touch of the octave keeps it audible on a phone speaker.
    out[i] = (Math.sin(p1) + 0.22 * Math.sin(p2)) * a;
  }
  lowpass(out, 170);
  const start = Math.round(at * SR);
  for (let i = 0; i < len; i++) {
    const j = start + i;
    if (j < 0 || j >= N) continue;
    const v = out[i] * gain * 0.42 * duck[j];
    left[j] += v;
    right[j] += v;
  }
}

/** Detuned stack, low passed. Holds the harmony under everything else. */
function pad(at, freqs, dur, gain = 1) {
  const len = Math.round(dur * SR);
  const out = new Float64Array(len);
  const detunes = [-0.14, 0, 0.11];
  for (const f of freqs) {
    for (const d of detunes) {
      let phase = Math.random() * 0;
      const step = (2 * Math.PI * (f + d)) / SR;
      for (let i = 0; i < len; i++) {
        phase += step;
        // A soft saw: two harmonics is enough once it is filtered.
        out[i] += Math.sin(phase) + 0.3 * Math.sin(phase * 2) + 0.12 * Math.sin(phase * 3);
      }
    }
  }
  lowpass(out, 1500);
  // Kept out of the sub so the pad supports the bass instead of muddying it.
  highpass(out, 170);
  const atk = Math.round(0.5 * SR);
  const rel = Math.round(0.9 * SR);
  for (let i = 0; i < len; i++) {
    if (i < atk) out[i] *= i / atk;
    if (i > len - rel) out[i] *= (len - i) / rel;
  }
  const start = Math.round(at * SR);
  const scale = (gain * 0.055) / (freqs.length * detunes.length);
  for (let i = 0; i < len; i++) {
    const j = start + i;
    if (j < 0 || j >= N) continue;
    const v = out[i] * scale * (0.55 + 0.45 * duck[j]);
    left[j] += v;
    right[j] += v;
  }
}

/** Noise sweep into a section change. */
function riser(at, dur, gain = 1) {
  const len = Math.round(dur * SR);
  const out = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / len;
    out[i] = noise() * t * t;
  }
  highpass(out, 1200);
  add(at, out, gain * 0.16);
}

/** Low boom under a hard cut. */
function impact(at, gain = 1) {
  const len = Math.round(1.6 * SR);
  const out = new Float64Array(len);
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const f = 38 + 90 * decay(t, 0.09);
    phase += (2 * Math.PI * f) / SR;
    out[i] = (Math.sin(phase) + noise() * 0.25 * decay(t, 0.05)) * decay(t, 0.42);
  }
  lowpass(out, 400);
  add(at, out, gain * 0.7);
}

/* ------------------------------------------------------------------ */
/* Arrangement                                                         */
/* ------------------------------------------------------------------ */

/**
 * A minor, four bars a cycle: i, VI, III, VII. Familiar enough to catch on one
 * listen, which is the whole job of a sixty second bed.
 */
const PROGRESSION = [
  { root: 110.0, triad: [220.0, 261.63, 329.63], arp: [220.0, 261.63, 329.63, 440.0, 523.25] }, // Am
  { root: 87.31, triad: [174.61, 220.0, 261.63], arp: [174.61, 220.0, 261.63, 349.23, 440.0] }, // F
  { root: 130.81, triad: [261.63, 329.63, 392.0], arp: [261.63, 329.63, 392.0, 523.25, 659.25] }, // C
  { root: 98.0, triad: [196.0, 246.94, 293.66], arp: [196.0, 246.94, 293.66, 392.0, 493.88] }, // G
];

/** Sixteenth-note pattern over the five arp tones. -1 is a rest. */
const ARP = [0, 2, 1, 3, 2, 4, 3, 2, 0, 2, 1, 4, 3, 2, 1, 2];

/** The hook. Scale degrees over the cycle, one entry a bar. */
const HOOK = [
  [[0, 659.25, 1.0], [2, 587.33, 0.5], [3, 523.25, 1.5]],
  [[0, 523.25, 1.0], [2, 440.0, 1.0]],
  [[0, 587.33, 0.75], [1.5, 659.25, 0.75], [3, 783.99, 1.0]],
  [[0, 659.25, 1.5], [2.5, 587.33, 1.5]],
];

const bars = Math.ceil(SCENE.end / BAR);
const at = (bar, step = 0) => bar * BAR + step * STEP;

for (let bar = 0; bar < bars; bar++) {
  const t0 = at(bar);
  if (t0 > SCENE.end) break;
  const chord = PROGRESSION[bar % PROGRESSION.length];

  const intro = t0 < SCENE.brand;
  const beatOn = t0 >= SCENE.overview - 0.05;
  const full = t0 >= SCENE.sources - 0.05;
  const lead = t0 >= SCENE.audit - 0.05;
  const peak = t0 >= SCENE.pitch - 0.05;
  const outro = t0 >= SCENE.close - 0.05;

  // Harmony runs the whole way through, quieter at the ends.
  pad(t0, chord.triad, BAR + 0.6, intro ? 0.75 : outro ? 1.15 : 1);

  if (intro) {
    // Sparse and unresolved: this is the part of the film about the problem.
    pluck(t0, chord.arp[0], BAR * 0.9, 0.5, -0.2, 0.32);
    pluck(t0 + BEAT * 2.5, chord.arp[2], BEAT * 1.2, 0.36, 0.25, 0.28);
    bass(t0, chord.root / 2, BAR * 0.8, 0.6);
    continue;
  }

  if (beatOn) {
    for (let b = 0; b < 4; b++) kick(t0 + b * BEAT, outro ? 0 : 1);
  }
  if (full && !outro) {
    clap(t0 + BEAT, 1);
    clap(t0 + BEAT * 3, 1);
  }
  if (beatOn && !outro) {
    const div = peak ? 4 : 2; // sixteenths at the peak, eighths before it
    for (let s = 0; s < 16; s += 4 / div) {
      const open = s % 8 === 6;
      hat(t0 + s * STEP, open, open ? 0.8 : 1, s % 2 === 0 ? -0.25 : 0.25);
    }
  }

  // Bass: a held root early, a driven pattern once the film opens up.
  if (full && !outro) {
    for (const s of [0, 3, 6, 8, 11, 14]) bass(t0 + s * STEP, chord.root, STEP * 1.9, peak ? 1.05 : 0.9);
  } else {
    bass(t0, chord.root, BAR * 0.8, outro ? 0.7 : 0.85);
  }

  // The arpeggio is the thing you remember.
  if (!outro) {
    for (let s = 0; s < 16; s++) {
      const note = chord.arp[ARP[s]];
      const gain = (s % 4 === 0 ? 1 : 0.72) * (full ? 1 : 0.65);
      pluck(t0 + s * STEP, note, STEP * 2.2, gain * 0.62, s % 2 === 0 ? -0.3 : 0.3, full ? 0.62 : 0.45);
    }
  }

  // The hook sits on top from the audit scene onward.
  if (lead && !outro) {
    for (const [beat, freq, length] of HOOK[bar % HOOK.length]) {
      pluck(t0 + beat * BEAT, freq, length * BEAT, peak ? 0.95 : 0.75, 0, 0.8);
    }
  }

  if (outro) {
    // Drums gone, the chord left ringing under the closing card.
    pluck(t0, chord.arp[0], BAR, 0.5, -0.2, 0.5);
    pluck(t0 + BEAT * 2, chord.arp[2], BAR * 0.7, 0.4, 0.2, 0.45);
  }
}

// Section markers, placed on the cut rather than on the grid.
riser(SCENE.brand - 1.5, 1.5, 1);
impact(SCENE.brand, 1);
riser(SCENE.overview - 1.0, 1.0, 0.8);
crash(SCENE.overview, 0.9);
riser(SCENE.sources - 0.9, 0.9, 0.7);
crash(SCENE.sources, 0.7);
riser(SCENE.pitch - 1.2, 1.2, 0.9);
crash(SCENE.pitch, 0.8);
riser(SCENE.results - 1.4, 1.4, 1);
crash(SCENE.results, 1);
impact(SCENE.results, 0.8);
crash(SCENE.close, 0.7);

// The final chord: one long Am, allowed to ring past the last frame.
pad(SCENE.close, [220.0, 261.63, 329.63, 440.0], DUR - SCENE.close, 1.5);
bass(SCENE.close, 55.0, DUR - SCENE.close - 0.2, 0.8);

/* ------------------------------------------------------------------ */
/* Master and write                                                    */
/* ------------------------------------------------------------------ */

// Nothing musical lives above 16k here, or below 28Hz, and leaving either in
// only costs headroom.
lowpass(left, 16000);
lowpass(right, 16000);
highpass(left, 28);
highpass(right, 28);

// Soft clip rather than hard limit: a tanh curve keeps the peaks in bounds
// without the crunch a brickwall would add to the kick.
let peakLevel = 0;
for (let i = 0; i < N; i++) {
  peakLevel = Math.max(peakLevel, Math.abs(left[i]), Math.abs(right[i]));
}
if (process.env.SOUNDTRACK_DEBUG) {
  const marks = [2, 5, 9, 11, 13, 16, 20, 30, 44, 52, 58];
  console.log("pre-master peak", peakLevel.toFixed(3));
  for (const m of marks) {
    let sum = 0, pk = 0;
    for (let i = m * SR; i < (m + 1) * SR && i < N; i++) { sum += left[i] * left[i]; pk = Math.max(pk, Math.abs(left[i])); }
    console.log(`  t=${m}s rms=${(20 * Math.log10(Math.sqrt(sum / SR) + 1e-12)).toFixed(1)}dB peak=${pk.toFixed(3)}`);
  }
}
const pre = peakLevel > 0 ? 0.9 / peakLevel : 1;
for (let i = 0; i < N; i++) {
  left[i] = Math.tanh(left[i] * pre * 1.25) * 0.82;
  right[i] = Math.tanh(right[i] * pre * 1.25) * 0.82;
}

// Fade the very top and tail so nothing pops.
const fadeIn = Math.round(0.08 * SR);
const fadeOut = Math.round(1.2 * SR);
for (let i = 0; i < fadeIn; i++) {
  left[i] *= i / fadeIn;
  right[i] *= i / fadeIn;
}
for (let i = 0; i < fadeOut; i++) {
  const g = i / fadeOut;
  left[N - 1 - i] *= g;
  right[N - 1 - i] *= g;
}

function writeWav(file, l, r) {
  const frames = l.length;
  const data = Buffer.alloc(frames * 4);
  for (let i = 0; i < frames; i++) {
    data.writeInt16LE(Math.round(clamp(l[i], -1, 1) * 32767), i * 4);
    data.writeInt16LE(Math.round(clamp(r[i], -1, 1) * 32767), i * 4 + 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(SR, 24);
  header.writeUInt32LE(SR * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([header, data]));
}

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

async function durationOf(file) {
  const log = await ff(["-i", file, "-f", "null", "-"]).catch((e) => e.message);
  const m = /time=(\d+):(\d+):(\d+\.\d+)/g;
  let last = null;
  let hit;
  while ((hit = m.exec(log)) !== null) last = hit;
  return last ? +last[1] * 3600 + +last[2] * 60 + +last[3] : 0;
}

fs.mkdirSync(DIST, { recursive: true });
const wav = path.join(DIST, "soundtrack.wav");
writeWav(wav, left, right);
console.log(`wrote ${wav} (${(fs.statSync(wav).size / 1e6).toFixed(2)} MB, ${DUR.toFixed(2)}s at ${BPM} BPM)`);

const video = path.join(DIST, "yean-leads-60s.mp4");
if (!fs.existsSync(video)) throw new Error(`render the film first (missing ${video})`);

const filmDur = await durationOf(video);
const out = path.join(DIST, "yean-leads-60s-music.mp4");

// -14 LUFS is the streaming target, and it leaves the peaks room to breathe,
// which matters for a track this percussive.
const TARGET_LUFS = -14;
const bed = `atrim=0:${filmDur.toFixed(3)},afade=t=out:st=${Math.max(0, filmDur - 1.1).toFixed(3)}:d=1.1`;

// Measure, then apply one flat gain with a limiter on the end. loudnorm's own
// normaliser would ride the level as it goes and squash the quiet opening up
// against the drop, which is exactly the contrast the arrangement is built on.
const probe = await ff(["-i", wav, "-af", `${bed},loudnorm=print_format=json`, "-f", "null", "-"]);
const measured = JSON.parse(probe.slice(probe.lastIndexOf("{"), probe.lastIndexOf("}") + 1));
const gain = TARGET_LUFS - Number(measured.input_i);
console.log(`measured ${measured.input_i} LUFS, applying ${gain.toFixed(2)} dB`);

await ff([
  "-i", video,
  "-i", wav,
  "-filter_complex",
  // limit=0.89 is -1 dBTP, the usual ceiling for anything that will be encoded
  // to a lossy format afterwards.
  `[1:a]${bed},volume=${gain.toFixed(2)}dB,alimiter=limit=0.89:attack=4:release=60:level=disabled[a]`,
  "-map", "0:v", "-map", "[a]",
  "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", "-y", out,
]);
console.log(`done: ${out} (${(fs.statSync(out).size / 1e6).toFixed(2)} MB, film is ${filmDur.toFixed(2)}s)`);
