# YEAN Leads, voiceover script

Total runtime: 53 seconds. Timecodes match the cuts in `film/index.html` and the
subtitle file `captions.srt`, so a recorded read drops straight onto the video
without re-timing.

## Direction

Read it like you are explaining the tool to a colleague who runs a web studio,
not like you are selling. Calm, certain, unhurried. Let the silences sit; the
picture is doing work in the gaps. Nigerian English or neutral English both fit.
Drop your pitch slightly on the last three words of the film.

Pace is roughly 145 words per minute. There is deliberate air between lines.

## Script

| # | In | Out | Line |
|---|----|-----|------|
| 1 | 0:00.6 | 0:05.4 | Every week new businesses open. By the time Google lists them, someone else has already built their website. |
| 2 | 0:06.4 | 0:10.2 | YEAN Leads finds them first. |
| 3 | 0:11.0 | 0:18.0 | One workspace shows every business you are tracking, what stage it is in, and the revenue you have won. |
| 4 | 0:19.0 | 0:23.2 | Three discovery sources feed it. Google Places sweeps the cities you target. |
| 5 | 0:23.4 | 0:26.2 | Paste an Instagram find the day it opens, months before Google catches up. |
| 6 | 0:27.2 | 0:31.0 | Every website is audited automatically. DNS, SSL, redirects, mobile, and the platform it runs on. |
| 7 | 0:31.2 | 0:34.2 | Each lead is scored, so you only ever see the ones worth your time. |
| 8 | 0:35.2 | 0:39.0 | AI writes a pitch from the real problem it found on their site. |
| 9 | 0:39.2 | 0:42.8 | Then it stops and waits for you. Nothing is ever sent without your approval. |
| 10 | 0:43.6 | 0:47.8 | Cold discovery becomes a closed deal, without the hours of manual hunting. |
| 11 | 0:48.6 | 0:52.6 | YEAN Leads. Stop hunting. Start reviewing. |

## Plain text, for pasting into a TTS tool

```
Every week new businesses open. By the time Google lists them, someone else has already built their website.

YEAN Leads finds them first.

One workspace shows every business you are tracking, what stage it is in, and the revenue you have won.

Three discovery sources feed it. Google Places sweeps the cities you target.

Paste an Instagram find the day it opens, months before Google catches up.

Every website is audited automatically. DNS, SSL, redirects, mobile, and the platform it runs on.

Each lead is scored, so you only ever see the ones worth your time.

AI writes a pitch from the real problem it found on their site.

Then it stops and waits for you. Nothing is ever sent without your approval.

Cold discovery becomes a closed deal, without the hours of manual hunting.

YEAN Leads. Stop hunting. Start reviewing.
```

## Getting the audio onto the video

The film currently ships silent, with the narration burned in as on-screen
subtitles, so it reads correctly muted (which is how most feeds play it).

To add a spoken track, run:

```bash
cd ad
npm install                      # playwright + ffmpeg-static
export ELEVENLABS_API_KEY=...    # or OPENAI_API_KEY
node generate-voiceover.mjs      # writes dist/voiceover.mp3 and dist/yean-leads-60s-vo.mp4
```

`generate-voiceover.mjs` synthesises each line separately, places it at the exact
timecode above, and muxes the result. If you would rather record a human read,
export the lines above, keep the same in-points, and run:

```bash
ffmpeg -i dist/yean-leads-60s.mp4 -i your-read.wav \
  -c:v copy -c:a aac -b:a 192k -shortest dist/yean-leads-60s-vo.mp4
```

## A note on machine voices

Anything from a low-end synthesiser (espeak, the stock OS voices) will sound
robotic and undercut the film. If you are not recording a human, use ElevenLabs
(Adam, Charlie, or Daniel read this copy well) or OpenAI `gpt-4o-mini-tts` with
the `onyx` or `ash` voice. Both hold up at this length.
