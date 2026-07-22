# Discovery sources

Google Places is a lagging signal. A business usually appears there only after it is established, often after it has already hired another agency for a website. To catch businesses earlier, the engine supports several sources that all feed the same pipeline: dedupe, then check the site, enrich, score, write a pitch, and drop it in your approval queue. Each source is an independent toggle. Turning one on never affects the others, and a business found by two sources is deduped to a single lead.

Configure all of this on the dashboard Settings page under "Lead sources", or in the first-run setup wizard.

## Sources

### Google Places (the baseline)
Automated search by city and category. Best for businesses that are already listed. Needs a Google Places API key. This is the original source and its behaviour is unchanged.

### Manual and bulk import (the early-signal workhorse)
Paste businesses you gather anywhere: an Instagram account you spotted, a referral, a market you walked, a CAC lookup. One business per line on the Leads page "Import leads" panel. The parser is forgiving, so any of these work:

```
Crystal Scents
Crystal Scents, @crystalscents
Crystal Scents, crystal@scents.ng
Amara Kitchen, https://amara.ng, Port Harcourt, restaurants
Glow Haven Beauty, @glowhaven, 0803 111 2222
```

It detects an email, an @handle, a phone, or a URL wherever it appears on the line. Whatever is left over becomes the city, then the category. You can also set a default city and category for the whole batch. Imported businesses run through the same checks and scoring as everything else, and their provenance is recorded as "manual".

This is the most reliable answer to the "Google is too late" problem, because a person or VA can drop in a brand-new business the day it launches on Instagram.

### Directory crawler
Point it at one or more public directory pages or sitemaps that list businesses. The crawler pulls the outbound business links (skipping social networks, aggregators, and its own internal nav), dedupes by domain, and feeds each candidate through the website checker. It reads both HTML listing pages and `sitemap.xml` files.

Set the URLs, a default city, and a default category in Settings. Only crawl directories whose terms allow it. Each business is still checked and scored on its own, so a directory full of businesses that already have good custom sites will simply score low and never reach your queue.

## Sources this engine does not automate, on purpose

- **Instagram scraping.** Instagram's API does not allow broad discovery scraping, and automated scraping risks the account and breaks Meta's terms. The supported path is manual import: a human finds the business, you drop the handle in. This is the honest, durable version.
- **CAC bulk feeds.** There is no clean public bulk API for new CAC registrations. Use a name lookup and manual import, or a licensed data provider. Treat personal data carefully.
- **Domain registration feeds (NiRA).** No free public feed of newly registered `.ng` domains exists. If you obtain one, the businesses it yields can be dropped in via manual import, where the checker will flag the parked or empty ones as prime leads.

## How runs work

- A full run (dashboard "Run discovery now", the API `/api/pipeline/run`, or the daily cron) runs Google Places when a key is set, then every enabled extra source, then processes everything new.
- You can run only the extra sources with `POST /api/pipeline/discover-sources`.
- The scheduler runs as long as at least one source is available, so you can drop Google Places entirely and run on manual import plus directories if you prefer.
- The overview shows a "by source" breakdown so you can see which channel actually converts, and a `discoverySource` is stored on every lead.

## Compliance

Every source obeys the same rules as the rest of the system: the suppression list is checked before a lead is ever stored, business contact points are targeted rather than personal profiles, and provenance is recorded. See [COMPLIANCE.md](COMPLIANCE.md).
