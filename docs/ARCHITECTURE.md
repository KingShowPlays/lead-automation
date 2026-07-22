# Architecture

## Overview

```
                         ┌──────────────────────────────────────────────┐
                         │                 server/  (API)               │
                         │                                              │
  cron / n8n / API  ───► │  pipeline.runFullPipeline()                  │
                         │    1. discover()      Google Places (New)    │
                         │    2. processPending() per lead:             │
                         │         checkWebsite() ─ DNS/SSL/HTTP/HTML    │
                         │         classifyWebsite() ─ 8 categories      │
                         │         enrichLead()   ─ contacts+provenance  │
                         │         scoreLead()    ─ weighted rules       │
                         │         generatePitch()─ OpenAI/Anthropic     │
                         │    ↓                                          │
                         │  MongoDB  (Lead, Suppression, OutreachLog,    │
                         │            SearchRun, Settings)               │
                         └───────────────▲───────────────┬──────────────┘
                                         │ REST /api      │
                         ┌───────────────┴───────────────▼──────────────┐
                         │            dashboard/  (Next.js)             │
                         │  Overview · Queue · Leads · Suppression ·    │
                         │  Settings  →  Approve / Edit / Send / Track  │
                         └──────────────────────────────────────────────┘
```

## Modules

### Discovery — `services/discovery/googlePlaces.ts`
Text Search against Places API (New) with a tight field mask (keeps billing on the basic SKU). Paginates up to 60 results/query, flags `FUTURE_OPENING`/`OPENING_SOON` as *opening soon*, skips permanently/temporarily closed. `buildQueries()` produces the `city × category` matrix. **Injectable `fetchImpl`** makes it fully unit-testable without network.

### Website checker — `services/websiteChecker/`
- `probe.ts` — pure network layer: DNS lookup → manual-redirect HTTP fetch (detects redirect loops, "redirects only to Instagram/WhatsApp"), TLS-error detection with HTTP fallback, capped HTML read, response timing.
- `analyze.ts` — pure HTML analysis (Cheerio): title/description/viewport, Shopify signatures (`cdn.shopify.com`, `Shopify.theme`, `Shopify.routes`, `myshopify.com`, `x-shopid`), parking-page signals, internal vs social link inventory.
- `classify.ts` — pure classifier → one of 8 types + a human-readable `problemSummary` that seeds the pitch. Priority: no-site → social-only → link-in-bio → menu-platform → broken → shopify → poor → custom.
- `index.ts` — orchestrates probe → analyze → classify, plus samples up to 3 internal links for broken pages.

Splitting pure logic (`analyze`, `classify`) from I/O (`probe`) is what makes the checker heavily testable.

### Enrichment — `services/enrichment/`
Scrapes the business's **own** homepage (+ a linked contact/about page) for email, WhatsApp (`wa.me`), phone (`tel:` + NG patterns), and Instagram. Normalises NG phones to E.164, flags WhatsApp-capable mobiles. Every value is written to `lead.contactSources` with source + URL + timestamp (**provenance**).

### Scoring — `services/scoring/leadScore.ts`
Pure function over `{websiteType, hasEmail, whatsappAvailable, openingSoon, instagramActive, strongVisualBrand}` with weights from `Settings`. Returns score + breakdown + qualified flag. Clamped at 0. Matches the plan's table exactly and is fully configurable from the dashboard.

### Pitch — `services/pitch/generatePitch.ts`
Builds a structured prompt (business name, category, website problem, IG bio, recent post, suggested YEAN solution per category, channel) → OpenAI or Anthropic → strict JSON `{observation, subject, message}`. Robust JSON extraction. Deterministic **template fallback** on any failure so the pipeline never stalls.

### Outreach — `services/outreach/`
- `gmail.ts` — OAuth2 Gmail client; `createDraftForLead`, `sendDraft`, `sendEmail`; RFC 2822 builder with RFC 2047 subject encoding and unicode bodies; every message appends the `COMPLIANCE_FOOTER` (unsubscribe + source disclosure). `emailsSentToday()` enforces the daily cap.
- `followUp.ts` — selects only *due, un-responded, under-cap* email leads; sends exactly one follow-up; logs it.

### Compliance — `services/suppression.ts`
`isSuppressed()` checks Place ID / email / phone / domain / Instagram against the suppression list. `optOutLead()` marks the lead and suppresses **all** its identifiers. `applySuppressionToLeads()` retroactively archives matches when you add an entry. Discovery calls `isSuppressed()` **before storing**, so suppressed businesses never re-enter.

### Scheduler — `services/scheduler.ts`
`node-cron` jobs for discovery (`DISCOVERY_CRON`) and follow-ups (`FOLLOWUP_CRON`) in `TIMEZONE`, with a re-entrancy guard and a settings toggle.

## Data model (MongoDB)

- **Lead** — the master record: identity, discovery, contacts+provenance, website check snapshot, score+breakdown, pitch, outreach/CRM state, approval, compliance flags. Indexed on stage, approval status, score, website type, place id (unique sparse), follow-up date.
- **Suppression** — `{type, value}` unique; the never-contact list.
- **OutreachLog** — append-only audit trail (drafts, sends, follow-ups, responses, opt-outs, conversions).
- **SearchRun** — per-run discovery stats.
- **Settings** — singleton: cities, categories, weights, thresholds, caps.

## Design choices

- **Code, not just n8n.** The plan's n8n diagram maps to explicit, tested services. n8n remains optional (`n8n/workflow.json`) for orchestration/notifications.
- **MongoDB over Supabase** (per request) — the flexible Lead document with nested check snapshots, score breakdowns and provenance arrays fits a document store naturally.
- **Everything degrades gracefully.** Missing keys disable a feature, never crash the server — integration status is surfaced on the overview.
- **Pure core, thin I/O.** Classifier, scorer, extractor, phone/URL utils are pure and exhaustively unit-tested; network/DB lives at the edges.
