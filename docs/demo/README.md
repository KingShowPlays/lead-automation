# Demo

Four screen recordings of the running system. Nothing here is a mock-up: each
take drives the real dashboard against the real API, the businesses on screen
came out of a live Google Places sweep of Lagos, Abuja and Port Harcourt, and
the pipeline job that runs at the end of every take is a real job writing to the
database. The counters move because the work is actually happening.

All four are the same build in the same state, in the Terminal preset. That
preset follows the operating system, so the light and dark pairs differ only in
what the recording browser reported as its colour scheme. No setting was changed
between them.

| File | Palette | Length | Size |
|---|---|---|---|
| [`yean-leads-demo-terminal-dark-full.webm`](yean-leads-demo-terminal-dark-full.webm) | Dark | 2:32 | 13 MB |
| [`yean-leads-demo-terminal-dark-cut.webm`](yean-leads-demo-terminal-dark-cut.webm) | Dark | 1:12 | 6 MB |
| [`yean-leads-demo-terminal-light-full.webm`](yean-leads-demo-terminal-light-full.webm) | Light | 2:18 | 12 MB |
| [`yean-leads-demo-terminal-light-cut.webm`](yean-leads-demo-terminal-light-cut.webm) | Light | 1:23 | 7 MB |

The full takes walk the whole product. The cuts drop analytics and the help
page, shorten the pauses and move the pointer faster, for anyone who wants the
shape of the thing rather than the tour.

## What is on screen

1. **Overview.** Headline figures over the whole database, the pipeline funnel,
   what needs attention, and integration health. 700 businesses tracked, 509
   awaiting approval.
2. **Approval queue.** Every lead that can actually be reached, filtered by the
   route that reaches it: email, Instagram, WhatsApp, or no route at all. Cards
   collapse, and each one states the means of contact available for it. The
   drafted message is shown in full, addressed to the business by name.
3. **All leads.** The whole table, with the saved filter presets applied.
4. **Analytics.** Need and reach distributions, business freshness,
   contactability, discovery sources and the website opportunity mix. Full takes
   only.
5. **Theme control.** Presets applied live, then the corner radius changed under
   the entire interface, to show that the look is data rather than code.
6. **Help.** Full takes only.
7. **The pipeline running.** Back on the overview, a job is started and the take
   closes on it: the progress panel counts through the qualified leads while the
   approval figure climbs.

The pointer is drawn into the page. Screen recording does not capture a real
cursor, so without it the recording would show things being clicked by nobody.

## Format

WebM, VP8, 1280x800, no audio. Recorded with the browser's own encoder, with no
post-production. Plays in any current browser and in VLC. GitHub will not play
WebM inline, so use the raw links above or clone the repository.
