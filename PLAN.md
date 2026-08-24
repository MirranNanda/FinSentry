# FinSentry Build Plan

## 1. Project Goal

FinSentry is a simple web app that monitors financial influencers and flags Instagram content containing potentially actionable stock recommendations.

It should detect:

- Stock names
- BUY/SELL recommendations
- Price targets
- Future price predictions
- Strong/confident language
- Exact evidence and timestamps

FinSentry should **not automatically declare that an influencer violated SEBI rules**. It produces a risk/review score for human assessment.

---

## 2. Tech Stack

```text
Frontend  → HTML + CSS + JavaScript + Tailwind CSS
AI        → Gemini API
Database  → Supabase
Scraper   → JavaScript
Hosting   → Netlify / Vercel
```

### Do NOT use

```text
Python
Machine Learning
TensorFlow / PyTorch
React
Node / Express
RAG
Vector databases
Ollama
Whisper
OpenCV
```

Keep the implementation beginner-friendly and simple.

---

## 3. Architecture

```text
Instagram
    ↓
JavaScript Scraper
    ↓
Reel + Video URL + Caption
    ↓
Gemini API
    ↓
Structured JSON
    ↓
Simple JavaScript Risk Score
    ↓
Supabase
    ↓
FinSentry Dashboard
```

The scraper must be a separate module so it can be replaced later without changing the AI or dashboard.

---

# Phase 1: Project Setup + UI

### Goal

Build the complete frontend using fake/mock data.

### Tasks

- [x] Create project structure
- [x] Set up HTML/CSS/JavaScript
- [x] Add Tailwind CSS
- [x] Build dashboard
- [x] Build influencer list
- [x] Build flagged-content table
- [x] Build Reel review page
- [x] Add search/filter/sort
- [x] Add mock data

### Important

Do not build video upload.

The application should work with a `video_url` from the beginning.

Example mock data:

```json
{
  "username": "stockguru",
  "reel_url": "https://instagram.com/reel/example",
  "video_url": "https://example.com/video.mp4",
  "caption": "3 stocks I would buy right now"
}
```

### Output

A complete FinSentry dashboard that looks real but uses mock data.

---

# Phase 2: Supabase

### Goal

Replace mock data with a real database.

### Tables

## influencers

```text
id
username
name
profile_url
followers
active
created_at
```

## videos

```text
id
influencer_id
reel_url
video_url
caption
posted_at
created_at
```

## analyses

```text
id
video_id
stock
ticker
recommendation
price_target
future_prediction
certainty
risk_score
risk_level
evidence
timestamp
raw_response
created_at
```

## flags

```text
id
analysis_id
severity
reason
reviewed
review_notes
created_at
```

### Tasks

- [ ] Create Supabase project (you: sign up at supabase.com, see README)
- [x] Create database tables (`supabase/schema.sql` — run in SQL Editor)
- [x] Connect JavaScript to Supabase (`js/config.js` + `js/supabaseClient.js`)
- [x] Save records (`supabase/seed.sql`, plus `js/db.js` is ready for future inserts)
- [x] Retrieve records (`js/db.js`: `getInfluencers`, `getJoinedReels`, `getVideoWithDetails`)
- [x] Update records (`js/db.js`: `updateFlag`, wired to the reel review page)
- [x] Configure basic Row Level Security (`supabase/schema.sql`)

### Output

```text
Frontend
   ↓
Supabase
   ↓
Real data
```

---

# Phase 3: Gemini API

### Goal

Make FinSentry understand videos.

### Tasks

- [x] Create Gemini API integration (`supabase/functions/analyze-video/index.ts`)
- [x] Create a secure server-side function for Gemini (Supabase Edge Function)
- [x] Keep API key out of frontend code (`GEMINI_API_KEY` is a function secret, never shipped to the browser)
- [x] Send a test video to Gemini (verified end-to-end against the deployed function)
- [x] Analyze speech and visuals (Gemini video understanding via the Files API)
- [x] Detect financial content
- [x] Detect stock names
- [x] Detect BUY/SELL recommendations
- [x] Detect price targets
- [x] Detect future predictions
- [x] Detect certainty
- [x] Extract evidence
- [x] Extract timestamp
- [x] Return structured JSON (Gemini structured output, schema-constrained)

### Expected output

```json
{
  "is_financial_content": true,
  "stock": "Tata Motors",
  "ticker": "TATAMOTORS",
  "recommendation": "BUY",
  "price_target": "₹1000",
  "future_prediction": true,
  "certainty": "HIGH",
  "evidence": "Buy Tata Motors before the results.",
  "timestamp": "00:32"
}
```

### Output

```text
Video
  ↓
Gemini
  ↓
Structured analysis
```

---

# Phase 4: Risk Scoring

### Goal

Turn Gemini's analysis into a simple risk/review score.

Do NOT use machine learning.

Use basic JavaScript rules.

### Initial scoring

```text
BUY/SELL recommendation           +25
Price target                      +15
Future prediction                 +15
High certainty                    +10
Urgent language                   +10
Guaranteed-return language        +20   (replaces the +10 urgent-language
                                          point when the claim is a flat
                                          guarantee, e.g. "guaranteed",
                                          "100% return", "sure-shot" --
                                          without this tier the max score
                                          was 75 and CRITICAL, 81-100,
                                          was unreachable)
```

### Risk levels

```text
0-30     LOW
31-60    REVIEW
61-80    HIGH
81-100   CRITICAL
```

### Tasks

- [x] Create scoring function (`js/riskScoring.js`, mirrored inline in the Edge Function)
- [x] Calculate risk score
- [x] Assign risk level
- [x] Save score to Supabase (`analyses.risk_score`/`risk_level`, plus auto-synced `flags` rows for REVIEW+)
- [x] Display score on dashboard (built in Phase 1, now fed by real scores)
- [x] Display reasons behind score (built in Phase 1, now fed by real `score_breakdown`)

### Important

This is an internal **review priority score**, not a legal judgment.

---

# Phase 5: Instagram Scraper

Only start this after Phases 1-4 work.

### Goal

Automatically find Instagram Reels from a controlled influencer watchlist.

Start with approximately 5-20 influencers.

### Tasks

- [x] Create scraper module (`supabase/functions/scrape-reels/index.ts`, isolated Edge Function)
- [x] Add influencer watchlist (already exists: the `influencers` table from Phase 2)
- [x] Find influencer profiles (uses each influencer's `profile_url`)
- [x] Find recent Reels (via Apify's Instagram Scraper, `resultsType: "reels"`)
- [x] Extract Reel URL
- [x] Extract video URL where accessible
- [x] Extract caption
- [x] Extract posting date
- [x] Extract thumbnail
- [x] Prevent duplicate Reels (pre-check + the `reel_url` unique constraint as a backstop)
- [ ] Test scraper with a small number of accounts (you: deploy + call it — see README)

### Standard scraper output

```json
{
  "username": "stockguru",
  "reel_url": "...",
  "video_url": "...",
  "caption": "...",
  "posted_at": "...",
  "thumbnail_url": "..."
}
```

The scraper should only collect content.

It should not analyze the video.

### Important

Instagram scraping can be rate-limited, blocked, or changed by Instagram. Keep the scraper isolated from the rest of the application.

Use only content/access methods that are permitted.

---

# Phase 6: Connect Everything

### Goal

Replace mock data with the real scraper and create the complete pipeline.

```text
Instagram
    ↓
Scraper
    ↓
New Reel
    ↓
Supabase
    ↓
Gemini
    ↓
Analysis
    ↓
Risk Score
    ↓
Supabase
    ↓
Dashboard
```

### Tasks

- [x] Send scraped Reels to Supabase (Phase 5: `scrape-reels`)
- [x] Check for duplicates (Phase 5: pre-check + unique constraint)
- [x] Send new Reels to Gemini (`supabase/trigger.sql` — DB trigger on `videos` insert, the missing link)
- [x] Save Gemini analysis (Phase 3: `analyze-video`)
- [x] Calculate risk score (Phase 4: inline in `analyze-video`)
- [x] Save risk score (Phase 4)
- [x] Display flagged Reels (Phase 1: `flagged.html`, now fed by the real pipeline)
- [x] Display evidence and timestamps (Phase 1: `reel.html`)
- [x] Add review/dismiss functionality (Phase 1: reviewed toggle + notes on `reel.html`)

---

# Phase 7: Automation

### Goal

Make FinSentry run automatically.

```text
Scheduler
    ↓
Scraper
    ↓
Find new Reels
    ↓
Check Supabase
    ↓
New Reel?
   ↓
Gemini
   ↓
Risk Score
   ↓
Supabase
   ↓
Dashboard
```

### Tasks

- [x] Add scheduled scraper runs (`pg_cron`, built but left inactive — see `supabase/phase7_automation.sql`; you: activate once the watchlist has real accounts)
- [x] Detect new content (Phase 5)
- [x] Ignore already processed content (Phase 5)
- [x] Filter obvious non-financial content where possible (deliberately skipped — see note below)
- [x] Automatically analyze relevant Reels (Phase 6 trigger)
- [x] Add processing status (`videos.status`/`status_error`, reflected live on the reel review page)
- [x] Add basic error handling (failures are caught, logged to `status_error`, never crash the pipeline)
- [x] Add retry handling (scheduled retry job, capped at 3 attempts; manual "Retry analysis" button on the reel page)

**Note on the skipped filter:** a caption-keyword pre-filter was considered but deliberately not built — Gemini watches/listens to every scraped Reel regardless of caption, because a real violation hiding behind a vague caption ("check this out 👀") is a far costlier failure for a compliance tool than one extra Gemini call.

Start small. Do not attempt to monitor thousands of influencers.

---

# Phase 8: Deployment

### Goal

Put FinSentry online.

### Hosting

```text
Frontend       → Netlify / Vercel
Database       → Supabase
Backend/API    → Supabase Edge Functions
AI             → Gemini API
Scraper        → Separate scraper process
```

### Tasks

- [ ] Deploy frontend
- [ ] Deploy Supabase functions
- [ ] Configure environment variables
- [ ] Secure API keys
- [ ] Test production flow
- [ ] Test scraper
- [ ] Test Gemini
- [ ] Test database
- [ ] Test dashboard

---

# Final User Flow

```text
1. Scraper finds a Reel
        ↓
2. Reel is saved to Supabase
        ↓
3. Gemini analyzes the Reel
        ↓
4. Gemini identifies:
   - Stock
   - Recommendation
   - Price target
   - Future prediction
   - Certainty
   - Evidence
        ↓
5. JavaScript calculates risk score
        ↓
6. Result is saved
        ↓
7. Dashboard updates
        ↓
8. Reviewer opens flagged Reel
        ↓
9. Reviewer confirms or dismisses the flag
```

---

# MVP Definition of Done

The MVP is complete when this works:

```text
Instagram Reel
      ↓
Scraper
      ↓
Video URL
      ↓
Gemini
      ↓
Stock + Recommendation detected
      ↓
Risk Score
      ↓
Evidence + Timestamp
      ↓
Supabase
      ↓
FinSentry Dashboard
```

A reviewer must be able to see **why FinSentry flagged the content**.

---

# Future Features

Do NOT build these in the initial MVP:

- FinSentry influencer score
- Historical recommendation accuracy
- Prediction tracking
- Automatic SEBI violation determination
- Thousands of influencers
- Multiple social platforms
- Advanced ML
- Custom AI models

These can be added after the core engine works.

---

# Final Product Vision

```text
                 FINSENTRY

                     ↓

        Monitor financial influencers

                     ↓

             Find new Reels

                     ↓

             Analyze with Gemini

                     ↓

          Detect stock recommendations

                     ↓

             Calculate risk score

                     ↓

           Prioritize human review

                     ↓

              Evidence-backed
                dashboard
```

## Final Stack

```text
HTML
CSS
JavaScript
Tailwind CSS
Supabase
Gemini API
JavaScript Scraper
Netlify/Vercel
```

**Core principle: keep it simple. Build one phase completely, test it, then move to the next phase.**
