# FinSentry

Dashboard, influencer list, flagged-content table, and Reel review page, backed by a real Supabase database (Phase 2). No build step — plain HTML/CSS/JS + Tailwind (CDN) + the Supabase JS client (CDN).

## Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com) (free tier is fine). Save the database password somewhere safe.
2. **Run the schema.** Project → **SQL Editor** → New query → paste the contents of [`supabase/schema.sql`](supabase/schema.sql) → Run. This creates the four tables (`influencers`, `videos`, `analyses`, `flags`) and enables Row Level Security.
3. **Seed demo data.** New query → paste [`supabase/seed.sql`](supabase/seed.sql) → Run. This loads the same sample dataset the Phase 1 mock UI used, so the dashboard looks populated immediately.
4. **Get your API credentials.** Project Settings (gear icon) → **API** → copy the **Project URL** and the **`anon` `public`** key.
5. **Fill in `js/config.js`** with those two values:
   ```js
   const SUPABASE_URL = "https://your-project-ref.supabase.co";
   const SUPABASE_ANON_KEY = "your-anon-public-key";
   ```
   Never put the `service_role` key here — only the `anon` key belongs in frontend code.

## Run it

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000/index.html. If `js/config.js` still has placeholder values, every page shows a banner telling you to fill it in.

## Structure

```
index.html            Dashboard
influencers.html       Influencer list (search/filter/sort)
flagged.html           Flagged-content table (search/filter/sort)
reel.html               Reel review page (?id=<video_id>)

css/style.css           Design tokens (light/dark) + component styles

js/config.js             Your Supabase URL + anon key (fill this in)
js/supabaseClient.js     Initializes the shared Supabase client
js/db.js                 Data access layer (get/update records)
js/utils.js              Formatting, badges, loading/error UI
js/theme.js              Light/dark toggle
js/dashboard.js, influencers.js, flagged.js, reel.js   Per-page rendering

supabase/schema.sql       Table definitions + Row Level Security policies
supabase/seed.sql         Demo dataset (same data Phase 1's mock UI used)
```

## Phase 3: Gemini video analysis

A Supabase Edge Function (`supabase/functions/analyze-video/index.ts`) sends a video to Gemini and gets back structured JSON (financial content? stock, recommendation, price target, future prediction, certainty, evidence quote + timestamp). The Gemini API key lives only in the function's secrets — it's never in frontend code.

**Deploy it (via the Supabase Dashboard — no CLI needed):**

1. Get a free Gemini API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. In your Supabase project: left sidebar → **Edge Functions** → **Deploy a new function** → **Via Editor**.
3. Name it exactly `analyze-video`.
4. Delete the placeholder code and paste in the full contents of `supabase/functions/analyze-video/index.ts`.
5. Click **Deploy function**.
6. Still in **Edge Functions**, go to the **Secrets** tab → **Add new secret** → name `GEMINI_API_KEY`, value your Gemini key from step 1 → Save. (`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — you don't set those.)

**Test it:**

```bash
curl -X POST "https://<your-project-ref>.supabase.co/functions/v1/analyze-video" \
  -H "Authorization: Bearer <your-anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"video_url": "<any public .mp4 URL>", "caption": "optional caption text"}'
```

This form (`video_url` + `caption`) doesn't touch the database — good for a first connectivity check with any public sample video. Once that works, test against a real seeded row with `{"video_id": 101}` — it'll look up the video's URL/caption in Supabase and **save the result into `analyses`**, scored (see below), and sync a `flags` row if it's REVIEW or above. Refresh the reel review page for that video afterward to see it reflected.

## Phase 4: risk scoring

Plain rule-based JavaScript (`js/riskScoring.js`), not ML — takes Gemini's structured fields and produces the 0–100 review-priority score:

| Signal | Points |
|---|---|
| BUY/SELL recommendation | +25 |
| Price target given | +15 |
| Future prediction | +15 |
| High-certainty language | +10 |
| Urgent language ("act now", "don't miss") | +10 |
| Guaranteed-return language ("guaranteed", "100%", "sure-shot") | +20 |

Levels: 0–30 LOW, 31–60 REVIEW, 61–80 HIGH, 81–100 CRITICAL.

The Edge Function carries an inlined copy of this exact logic (it's deployed as a single file via the Dashboard, so it can't `import` a sibling file) — if you change the rules, update both `js/riskScoring.js` and `supabase/functions/analyze-video/index.ts`, then redeploy. After scoring, the function also keeps `flags` in sync: REVIEW/HIGH/CRITICAL gets a flag row (or updates one), LOW clears a stale one — and re-running analysis on an already-reviewed flag never resets a reviewer's notes, only the severity/reason text.

This is a review-priority signal for a human, never an automatic SEBI-violation determination.

## Phase 5: Instagram scraper

A second, deliberately isolated Edge Function (`supabase/functions/scrape-reels/index.ts`) finds recent Reels for your watchlist influencers and saves new ones into `videos`. It only collects content — it never calls Gemini or computes a score.

It doesn't scrape Instagram directly (that means either logging in with a real account or reverse-engineering their private app API, both against Instagram's ToS regardless of purpose). Instead it calls **[Apify's Instagram Scraper](https://apify.com/apify/instagram-scraper)**, a documented public data API, via plain HTTP.

**Deploy it (same pattern as `analyze-video`):**

1. Get an Apify API token: sign up at [apify.com](https://apify.com) (free tier includes monthly credits) → **Console** → **Settings** → **API & Integrations** → copy your **Personal API token**.
2. Supabase Dashboard → **Edge Functions** → **Deploy a new function** → **Via Editor** → name it exactly `scrape-reels`.
3. Paste in the full contents of `supabase/functions/scrape-reels/index.ts` → **Deploy function**.
4. Edge Functions → **Secrets** → **Add new secret** → name `APIFY_API_TOKEN`, value your token from step 1 → Save.

**Test it:**

```bash
# Ad-hoc: any public Instagram username, doesn't touch the database
curl -X POST "https://<your-project-ref>.supabase.co/functions/v1/scrape-reels" \
  -H "Authorization: Bearer <your-anon-key>" -H "Content-Type: application/json" \
  -d '{"username": "some_public_account"}'

# Real watchlist influencer — saves any new Reels into `videos`
curl -X POST "https://<your-project-ref>.supabase.co/functions/v1/scrape-reels" \
  -H "Authorization: Bearer <your-anon-key>" -H "Content-Type: application/json" \
  -d '{"influencer_id": 1}'

# Every active influencer in one batched run
curl -X POST "https://<your-project-ref>.supabase.co/functions/v1/scrape-reels" \
  -H "Authorization: Bearer <your-anon-key>" -H "Content-Type: application/json" \
  -d '{"all": true}'
```

Apify runs can take 10–60+ seconds depending on how many profiles/Reels are requested — the function polls until the run finishes. Note this calls a metered third-party service; check your Apify usage/billing if you run it frequently.

## Phase 6: connecting the pipeline

Everything from Phases 2-5 already talks to Supabase; the one missing link was automatic: a new Reel landing in `videos` didn't automatically get sent to Gemini. `supabase/trigger.sql` closes that loop with a Postgres trigger — the moment `scrape-reels` (or anything else) inserts a row into `videos`, it calls `analyze-video` in the background via `pg_net` (Supabase's async HTTP extension). The insert itself is never slowed down waiting on Gemini.

**Set it up:** SQL Editor → New query → paste the full contents of `supabase/trigger.sql` → Run. That's it — no redeploy needed, and it's safe to re-run (it drops and recreates the trigger).

Full pipeline after this: **scrape-reels finds a Reel → saves it to `videos` → trigger fires → analyze-video runs → saves to `analyses` → computes the risk score → syncs `flags` → dashboard/flagged/reel pages show it**, with zero manual steps in between.

To see what a background trigger call actually did (status, response, errors), query pg_net's log in the SQL Editor:
```sql
select * from net._http_response order by created desc limit 20;
```

## Phase 7: automation

`supabase/phase7_automation.sql` adds:

- **Processing status** — `videos.status` (`pending` → `processing` → `complete`/`failed`) and `videos.status_error`, set by `analyze-video` itself. The reel review page now shows a real "analyzing…" state (auto-polls every 5s until done) or a "failed" state with the error message and a **Retry analysis** button, instead of misreading an unprocessed video as "not financial content."
- **Retry job** (active immediately) — every 15 minutes, `pg_cron` re-triggers analysis for anything `failed`, or stuck in `pending`/`processing` for over 10 minutes (a lost trigger call), capped at 3 attempts per video. This only touches videos already in your database — it costs nothing until something actually fails.
- **Scraper schedule** (inactive by default) — a ready-to-run `cron.schedule(...)` block at the bottom of the file, commented out. Your watchlist still has Phase 1's fictional seed usernames; activate this once `influencers.profile_url` points at real accounts. To turn it on: copy just that block into a new SQL Editor query and run it. To pause it again: `select cron.unschedule('scrape-watchlist');`

**No caption pre-filter, on purpose.** Gemini analyzes every scraped Reel regardless of caption — a real violation behind a vague caption is a far costlier miss than one extra Gemini call for a compliance tool.

Run `supabase/phase7_automation.sql` once in the SQL Editor to set all of this up.

## Row Level Security

RLS is enabled on all four tables. The `anon` key can:
- **Read** everything (it's an internal review tool, no login yet).
- **Update** `flags` only — that's the one write action the UI performs today (mark reviewed / save review notes).

Inserting influencers, videos, and analyses is expected to come from the scraper/Gemini pipeline (Phases 3, 5, 6) using the `service_role` key server-side, which bypasses RLS — so there's no anon insert policy for those tables yet. Revisit this once an auth/login system exists.
