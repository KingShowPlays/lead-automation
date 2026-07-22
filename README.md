# YEAN Lead Automation

A **semi-automated lead-generation engine** for YEAN Technologies: it discovers Nigerian businesses, audits their online presence, scores how badly they need a website, drafts a personalised pitch with AI, and queues everything for **your approval** before a single message goes out.

```
Google Places API ──► Website Health Checker ──► Enrichment ──► Lead Scoring
                                                                    │
      Gmail draft ◄── Approval Dashboard ◄── AI Pitch  ◄── qualified (score ≥ 50)
          │
          ▼
   You click Send ──► CRM tracking ──► one polite follow-up ──► Interested? → 💰
```

**Stack:** Node.js + Express + TypeScript · **MongoDB** (Mongoose) · Next.js dashboard · Google Places API (New) · OpenAI **or** Anthropic pitches · Gmail API · deployable on **Railway** in minutes.

---

## What it does

| Step | What happens | Where |
|---|---|---|
| 1. Discover | Daily search of every *city × category* combo (e.g. "perfume stores in Port Harcourt"), dedupe by Place ID + normalized name | `server/src/services/discovery` |
| 2. Check website | DNS → SSL → HTTP status → redirect loops → response time → mobile viewport → SEO tags → broken pages → Shopify signatures → Linktree/menu platforms → parking pages | `server/src/services/websiteChecker` |
| 3. Classify | `NO_WEBSITE` `BROKEN_WEBSITE` `SHOPIFY` `LINK_IN_BIO_ONLY` `MENU_PLATFORM_ONLY` `SOCIAL_MEDIA_ONLY` `CUSTOM_WEBSITE` `POOR_WEBSITE` | `classify.ts` |
| 4. Enrich | Email, WhatsApp, Instagram scraped from the business's **own public pages**, with provenance recorded for every value | `server/src/services/enrichment` |
| 5. Score | Configurable weights (no website +40, broken +40, social-only +30, opening soon +25 …). Score ≥ threshold → approval queue | `server/src/services/scoring` |
| 6. Pitch | AI writes a specific, warm, 70–120-word pitch from the business's actual situation. Falls back to smart templates if no AI key | `server/src/services/pitch` |
| 7. Approve | Dashboard queue: edit the pitch → **Approve** creates a Gmail draft → **Send** dispatches it. Instagram leads get an *open profile + copy message* manual flow | `dashboard/` |
| 8. Follow up | Exactly **one** follow-up after N days, only if no response. Daily email cap. Full audit log | `server/src/services/outreach` |
| 9. Win | Record replies, mark **Interested** → **Converted** with deal value. Revenue shows on the overview | CRM routes |

## Monorepo layout

```
├── server/          Express API + pipeline + scheduler (deploy → Railway service 1)
├── dashboard/       Next.js approval dashboard          (deploy → Railway service 2)
├── n8n/             Optional importable n8n workflow
├── docs/            Setup, Railway deploy, architecture, compliance
└── docker-compose.yml  Local stack (MongoDB + API + dashboard)
```

## Quick start (local)

```bash
# 1. Prereqs: Node 20+, MongoDB running locally (or Docker: docker compose up mongo)
npm install

# 2. Configure
cp .env.example server/.env       # fill in what you have; everything degrades gracefully

# 3. Run the API
npm run dev:server                # http://localhost:4000/health

# 4. Try it immediately with demo data (no API keys needed)
npm run seed --workspace server

# 5. Run the dashboard
echo "NEXT_PUBLIC_API_URL=http://localhost:4000" > dashboard/.env.local
npm run dev:dashboard             # http://localhost:3000 → check the Approval Queue
```

Or run everything with Docker: `docker compose up --build`.

## Deploy to Railway

Full walkthrough: **[docs/RAILWAY_DEPLOY.md](docs/RAILWAY_DEPLOY.md)**. Short version:

1. Create a Railway project → **Deploy MongoDB** from the template gallery.
2. **New service → GitHub repo**, set *Root Directory* = `server`. Add env vars (`MONGODB_URI=${{MongoDB.MONGO_URL}}`, `API_KEY`, `GOOGLE_PLACES_API_KEY`, AI + Gmail keys).
3. **New service → same repo**, *Root Directory* = `dashboard`. Set build args `NEXT_PUBLIC_API_URL` (the server's public URL) and `NEXT_PUBLIC_API_KEY`.
4. Done. The server's built-in cron discovers leads every morning (Africa/Lagos) and queues pitches for you.

## Configuration

Everything is environment-driven — see [`.env.example`](.env.example). Key vars:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `API_KEY` | Shared secret for the API (dashboard sends it as `x-api-key`) |
| `GOOGLE_PLACES_API_KEY` | Places API (New) — discovery |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | AI pitches (auto-detected; template fallback if neither) |
| `GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN/SENDER` | Gmail drafts + sending ([setup guide](docs/SETUP.md)) |
| `DISCOVERY_CRON` / `FOLLOWUP_CRON` / `TIMEZONE` | Built-in scheduler (default 07:00 / 09:00 Africa/Lagos) |
| `SCORE_THRESHOLD`, `DAILY_EMAIL_CAP`, `FOLLOW_UP_DAYS`, `MAX_CONTACT_ATTEMPTS` | Guardrails (also editable live in dashboard Settings) |

## API surface

All routes under `/api` require the `x-api-key` header when `API_KEY` is set.

```
GET  /health                          liveness (no auth)
POST /api/pipeline/run                discover + process everything
POST /api/pipeline/discover           discovery only (optional {cities, categories})
POST /api/pipeline/process            process unchecked leads
POST /api/pipeline/follow-ups         send due follow-ups
POST /api/pipeline/check-website      ad-hoc website audit {url}
GET  /api/pipeline/runs               discovery run history

GET  /api/leads                       filters: stage, websiteType, city, minScore, search…
GET  /api/leads/:id                   lead + outreach history
PATCH /api/leads/:id                  edit contacts/pitch/notes (auto-rescores)
POST /api/leads/:id/approve           approve → Gmail draft
POST /api/leads/:id/send              send approved email (respects daily cap)
POST /api/leads/:id/mark-contacted    manual IG/WhatsApp outreach done
POST /api/leads/:id/response          POSITIVE | NEUTRAL | NEGATIVE | OPT_OUT | BOUNCED
POST /api/leads/:id/convert           won the deal (+ deal value)
POST /api/leads/:id/opt-out           NDPA right to object
POST /api/leads/:id/recheck           re-run website check + rescore
POST /api/leads/:id/regenerate-pitch  new AI pitch

GET/POST/DELETE /api/suppression      never-contact list
GET/PUT /api/settings                 cities, categories, weights, caps
GET  /api/stats                       funnel, revenue, integrations
```

## Compliance (built in, not bolted on)

- **Provenance**: every email/phone/Instagram handle stores *where* it came from and *when*.
- **Suppression list**: opt-outs suppress email + phone + domain + Instagram + Place ID permanently; new discoveries matching the list are never even stored.
- **One follow-up max**, never after any reply; `MAX_CONTACT_ATTEMPTS` hard cap.
- **Opt-out line in every email** ("reply 'unsubscribe'") — honouring Nigeria's NDPA right to object.
- **Business contacts only**, from public business listings and the business's own website.
- Details: [docs/COMPLIANCE.md](docs/COMPLIANCE.md).

## Testing

```bash
npm test --workspace server        # 140+ unit tests (classifier, scoring, extraction, phone, email, places)
                                   # + full API integration suite (in-memory / real MongoDB)
```

## Docs

- [docs/SETUP.md](docs/SETUP.md) — Google Places, Gmail OAuth refresh token, AI keys
- [docs/RAILWAY_DEPLOY.md](docs/RAILWAY_DEPLOY.md) — step-by-step Railway deployment
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the pipeline fits together
- [docs/COMPLIANCE.md](docs/COMPLIANCE.md) — NDPA controls and outreach policy
- [n8n/README.md](n8n/README.md) — optional n8n orchestration
