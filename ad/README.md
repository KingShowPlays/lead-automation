# YEAN Leads, product film

A 53 second animated ad for the lead engine. Every dashboard shot in it is a real
screenshot of the running app with real data flowing through the real pipeline,
not a mockup.

```
ad/
├── dist/yean-leads-60s.mp4   the finished film (1920x1080, 30fps, H.264)
├── film/index.html           the film itself: scenes, timeline, animation
├── film/assets/              UI captures + the brand woff2 subsets
├── render.mjs                frame renderer, HTML -> mp4
├── generate-voiceover.mjs    synthesise narration and mux it on
├── voiceover-script.md       the read, with timecodes
└── captions.srt              subtitles, same timings
```

## Watching it

Open `dist/yean-leads-60s.mp4`. It ships silent by design (see "Audio" below),
with the narration burned in as on-screen lines, so it plays correctly muted.

## Re-rendering

```bash
cd ad
npm install
node render.mjs                      # -> dist/yean-leads-60s.mp4
node render.mjs --fps 8 --out ad/dist/preview.mp4   # fast preview while editing
```

The renderer loads `film/index.html` in Chromium and steps the GSAP master
timeline one frame at a time, screenshotting each. Nothing plays in realtime, so
frames are never dropped and the output is identical on every run. Frames are
encoded with libx264 at CRF 18 and deleted afterwards.

## Editing the film

`film/index.html` is self-contained: markup for eight scenes, then one GSAP
timeline that places every animation on the clock. Two things matter if you
change it:

- `DUR` at the top of the script is the runtime. The renderer reads it.
- `CAPTIONS` is the narration. It drives the on-screen lines, and
  `captions.srt` plus `generate-voiceover.mjs` use the same timecodes, so if you
  move a line, move it in all three or regenerate them.

`window.FILM.seek(t)` positions everything at time `t`. You can call it from the
browser console to scrub while designing.

## Refreshing the UI shots

The screenshots in `film/assets` were captured from the app running locally with
seeded data. To refresh them, start the API and dashboard, then screenshot
`/`, `/queue`, `/leads` (with the import panel open), `/leads/:id`, `/settings`
at 1600x1000 with `deviceScaleFactor: 2`, and drop them in with the same names.

## Audio

The film has no audio track. The narration is on screen instead, which is how
most people watch a feed anyway.

To add a spoken track, `voiceover-script.md` has the read with exact timecodes
and `generate-voiceover.mjs` will synthesise it and mux it in one command:

```bash
export ELEVENLABS_API_KEY=...    # or OPENAI_API_KEY
node generate-voiceover.mjs      # -> dist/yean-leads-60s-vo.mp4
```

Use ElevenLabs or OpenAI's `gpt-4o-mini-tts`, or record a human. Low-end system
synthesisers (espeak and friends) sound robotic and will undercut the picture.

## Facts shown in the film

The numbers on screen come from the seeded demo database: 12 businesses tracked,
10 awaiting approval, 2 contacted, 2 interested, 2 converted, ₦1,130,000 won.
The score of 90 and the `NO_WEBSITE` classification are what the real classifier
returns for a business with no site. If you re-shoot with different data, update
the counters in the `S3` and `S7` blocks of `film/index.html` to match.
