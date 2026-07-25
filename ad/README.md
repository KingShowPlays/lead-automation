# YEAN Leads, product film

A 61 second animated ad for the lead engine, in two cuts: one narrated, one with
music only. Every dashboard shot in it is a real screenshot of the running app
with real data flowing through the real pipeline, not a mockup.

```
ad/
├── dist/yean-leads-60s-vo.mp4     the film with narration
├── dist/yean-leads-60s-music.mp4  the film with music, no voice
├── dist/yean-leads-60s.mp4        the same cut, silent
├── film/index.html                the film itself: scenes, timeline, animation
├── film/assets/                   UI captures + the brand woff2 subsets
├── capture-ui.mjs                 re-shoot the dashboard screenshots
├── render.mjs                     frame renderer, HTML -> mp4
├── generate-voiceover.mjs         synthesise narration and mux it on
├── compose-soundtrack.mjs         synthesise the instrumental and mux it on
├── audit-alignment.mjs            geometry checks across every scene
├── timing.json                    measured narration timings (source of truth)
├── voiceover-script.md            the read, with timecodes
└── captions.srt                   subtitles, same timings
```

## Which cut to use

`yean-leads-60s-vo.mp4` explains the product, so it suits a landing page, a
pitch or anywhere someone has chosen to watch.

`yean-leads-60s-music.mp4` has no voice, only the instrumental. Use it on social
feeds, where most views are muted and a voice track is wasted, and anywhere the
film plays behind someone speaking. Both carry the same subtitles, so either one
still reads with the sound off.

## Re-rendering

```bash
cd ad
npm install
node render.mjs                                   # -> dist/yean-leads-60s.mp4
node generate-voiceover.mjs                       # -> dist/yean-leads-60s-vo.mp4
node compose-soundtrack.mjs                       # -> dist/yean-leads-60s-music.mp4
node render.mjs --fps 8 --out ad/dist/preview.mp4 # fast preview while editing
node ../ad/audit-alignment.mjs                    # geometry check, run from repo root
```

Both audio scripts start from `dist/yean-leads-60s.mp4`, so render the silent
cut first.

The renderer loads `film/index.html` in Chromium and steps the GSAP master
timeline one frame at a time, screenshotting each. Nothing plays in realtime, so
frames are never dropped and the output is identical on every run. Frames are
encoded with libx264 at CRF 18 and deleted afterwards.

## Editing the film

`film/index.html` is self-contained: markup for eight scenes, then one GSAP
timeline that places every animation on the clock.

The cut is driven by the narration, not the other way round. At the top of the
script, `SEG` holds each spoken line's in-point and its measured duration, and
`SC` holds the scene windows built from them. Every animation is expressed
relative to its scene start, so retiming a scene moves its contents with it.

If you change the copy, re-measure it (synthesise each line, read its real
duration), update `SEG` and `SC`, then regenerate `captions.srt` and the `LINES`
table in `generate-voiceover.mjs` from `window.FILM.segments`. Keeping those in
one place is what stops the voice and the picture from drifting apart.

`window.FILM.seek(t)` positions everything at time `t`. Call it from the browser
console to scrub while designing.

## Alignment

`audit-alignment.mjs` samples every scene at its settled moment and asserts that
icons and values sit at the true centre of their containers, that text stays
inside the card drawn around it, that nothing leaves the 1920x1080 canvas, that
overlays do not collide with the frames they annotate, and that elements meant
to share an edge or a baseline actually do. Run it after any layout change; it
exits non-zero on a regression.

Two checks cover the cards specifically, and both exist because the revenue
figure broke them in turn. A card sized for the number a counter starts at is
not necessarily wide enough for the number it ends on: that value used to finish
224px outside its own border. And fitting is not the same as looking like it
fits, so a headline value may not fill more than 88% of its card. A figure
running from one border to the other reads as overflowing even when it is
inside by a pixel, especially next to a card holding two digits.

## Refreshing the UI shots

The three screenshots in `film/assets` are the real dashboard, rendering real
API responses at 1600x1000 with `deviceScaleFactor: 2`. `capture-ui.mjs` takes
them, and it serves the responses from the demo dataset at the top of that file
rather than from Mongo, so the shot is reproducible and the numbers on screen
are the numbers the film's counters animate to.

```bash
npm run dev --workspace dashboard   # from the repo root
node capture-ui.mjs                 # -> film/assets/01, 02, 04
node render.mjs                     # re-render to pick them up
```

Re-shoot after any change to the dashboard. The film is a product demo, so a
screenshot that no longer matches the shipped interface is a bug in the ad.

## Narration

`dist/yean-leads-60s-vo.mp4` carries the narration. It was generated by
`generate-voiceover.mjs`, which synthesises each line separately, places it at
its exact in-point, and levels the result with `loudnorm`.

The backend is picked automatically: ElevenLabs if `ELEVENLABS_API_KEY` is set,
OpenAI if `OPENAI_API_KEY` is set, otherwise a keyless Google endpoint (what the
committed cut uses). For a published campaign an ElevenLabs read or a human
recording will sound warmer; see `voiceover-script.md`.

## Music

`compose-soundtrack.mjs` writes the instrumental one sample at a time. There is
no sample pack and no download: kick, clap, hats, bass, pad and a
Karplus-Strong pluck are all synthesised in the script, so the music ships in
the repository with no licence attached to it and no way for a missing asset to
break the build. The noise source is seeded, so two runs give identical audio.

The arrangement is cut to the film's own scene boundaries, which are repeated at
the top of the script:

| From | Scene | What the music does |
|------|-------|---------------------|
| 0.15s | The problem | pad and a lone pluck, no drums |
| 8.10s | Brand reveal | riser, sub impact |
| 11.15s | Overview | beat enters, arpeggio starts |
| 17.85s | Sources | claps in, bass drives |
| 28.85s | Audit and score | the lead motif joins |
| 41.75s | Pitch and approval | sixteenth hats, peak energy |
| 51.15s | Results | crash and impact together |
| 55.35s | Close | drums drop, final A minor rings out |

It is A minor at 120 BPM over i, VI, III, VII. Retiming the film means editing
the `SCENE` table and rerunning; nothing else needs to move.

Levels are set in two passes: measure the bed, apply one flat gain, then a
limiter at -1 dBTP. That lands on -13.9 LUFS with 7 LU of range, so the quiet
opening still reads as quiet instead of being pumped up to meet the drop.

`SOUNDTRACK_DEBUG=1 node compose-soundtrack.mjs` prints per-section levels
before mastering, which is the quickest way to see whether an arrangement change
has left a hole in the track.

## Facts shown in the film

The numbers on screen come from the seeded demo database: 12 businesses tracked,
10 awaiting approval, 2 contacted, 2 interested, 2 converted, ₦1,130,000 won.
The score of 90 and the `NO_WEBSITE` classification are what the real classifier
returns for a business with no site. If you re-shoot with different data, update
the counters in the `S3` and `S7` blocks of `film/index.html` to match.
