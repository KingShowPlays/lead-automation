# Setup Guide — API keys & credentials

Everything degrades gracefully: the server boots and the pipeline runs with **no keys at all** (using template pitches and skipping discovery/email). Add each integration when you're ready.

---

## 1. MongoDB

Any MongoDB works. Options:

- **Local:** `docker compose up mongo` (from the repo root) → `mongodb://localhost:27017/yean_leads`
- **MongoDB Atlas (free tier):** create a cluster → *Connect → Drivers* → copy the SRV URI into `MONGODB_URI`. Whitelist `0.0.0.0/0` (or Railway's egress) under Network Access.
- **Railway MongoDB plugin:** reference it as `${{MongoDB.MONGO_URL}}` (see RAILWAY_DEPLOY.md).

## 2. Google Places API (New) — discovery

1. [Google Cloud Console](https://console.cloud.google.com/) → create/select a project.
2. **APIs & Services → Library →** enable **"Places API (New)"** (not the legacy one).
3. **APIs & Services → Credentials → Create credentials → API key.**
4. Restrict the key to *Places API (New)* for safety.
5. Set `GOOGLE_PLACES_API_KEY`.

> Billing must be enabled on the project. Text Search bills per request; the daily
> run makes `cities × categories` requests (× up to 3 pages). With 3 cities and 7
> categories that's ≤63 requests/day. Keep `maxResultsPerQuery` modest to control cost.

## 3. AI pitch generation (optional but recommended)

Set **either**:

- `OPENAI_API_KEY` — from <https://platform.openai.com/api-keys> (default model `gpt-4o-mini`)
- `ANTHROPIC_API_KEY` — from <https://console.anthropic.com/> (default model `claude-haiku-4-5-20251001`)

Auto-detected. Force one with `PITCH_PROVIDER=openai|anthropic`. Override the model with `PITCH_MODEL`. With neither key set, the system uses high-quality deterministic **template** pitches so nothing breaks.

## 4. Gmail — drafts & sending (optional)

The server creates drafts and sends via the Gmail API using an OAuth2 **refresh token** for the sending account.

### One-time: get a refresh token

1. Google Cloud Console → **APIs & Services → Library →** enable **Gmail API**.
2. **OAuth consent screen:** External, add yourself as a Test User (Testing mode is fine).
3. **Credentials → Create credentials → OAuth client ID → Web application.**
   - Authorized redirect URI: `https://developers.google.com/oauthplayground`
   - Save the **Client ID** and **Client secret**.
4. Go to the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground):
   - Gear icon (⚙) → check **Use your own OAuth credentials** → paste Client ID/secret.
   - Step 1: in the input box add the scope `https://www.googleapis.com/auth/gmail.modify` → **Authorize APIs** → sign in as the sending account.
   - Step 2: **Exchange authorization code for tokens** → copy the **Refresh token**.
5. Set:
   ```
   GMAIL_CLIENT_ID=...
   GMAIL_CLIENT_SECRET=...
   GMAIL_REFRESH_TOKEN=...
   GMAIL_SENDER=hello@yourdomain.com     # the authorized account
   GMAIL_SENDER_NAME=YEAN Technologies
   ```

The `gmail.modify` scope covers creating drafts, sending, and reading thread ids for follow-ups.

> **Deliverability tip:** use a real domain mailbox with SPF/DKIM/DMARC set, warm it up, and keep `DAILY_EMAIL_CAP` low at first (10–20/day). Cold volume from a fresh Gmail hurts your sender reputation and conversion.

## 5. API key (protect the API)

Set `API_KEY` to a long random string. The dashboard must send the same value:

- Dashboard build arg / env: `NEXT_PUBLIC_API_KEY`
- Any external caller (n8n) sends header `x-api-key: <API_KEY>`

Leave `API_KEY` empty **only** for local development — an empty key disables auth.

## 6. Verify

```bash
curl http://localhost:4000/health
curl -H "x-api-key: $API_KEY" http://localhost:4000/api/stats | jq .integrations
```

`integrations` shows exactly which pieces are wired up.
