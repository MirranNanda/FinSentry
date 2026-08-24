// FinSentry Phase 5 — Instagram Reel scraper.
//
// A Supabase Edge Function (Deno), deliberately isolated from the rest of
// the app: its only job is to find recent Reels for watchlist influencers
// and save them into `videos`. It does NOT call Gemini and does NOT compute
// a risk score -- that's Phases 3/4/6. If Instagram scraping ever needs to
// change (rate limits, a different provider, a policy change), only this
// file should need to change.
//
// Rather than scraping Instagram directly (which means either logging in
// with a real account or reverse-engineering their private app API -- both
// against Instagram's Terms of Service regardless of the stated purpose),
// this calls Apify's Instagram Scraper, a documented public data API that
// operates on Apify's platform: https://apify.com/apify/instagram-scraper
//
// Deploy via the Supabase Dashboard: Edge Functions -> New Function ->
// name it "scrape-reels" -> paste this file's contents -> Deploy.
// Then add a secret: Edge Functions -> Secrets -> APIFY_API_TOKEN
// (from Apify Console -> Settings -> API & Integrations).
//
// Call it with ONE of:
//   { "influencer_id": 1 }                    -- scrape one watchlist influencer, saves new Reels
//   { "all": true }                            -- scrape every ACTIVE watchlist influencer, saves new Reels
//   { "username": "some_public_account" }      -- ad-hoc test, does not touch the database
//
// curl example (from the project README):
//   curl -X POST "$SUPABASE_URL/functions/v1/scrape-reels" \
//     -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
//     -H "Content-Type: application/json" \
//     -d '{"all": true}'

import { createClient } from "npm:@supabase/supabase-js@2";

const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
const APIFY_BASE = "https://api.apify.com/v2";
const APIFY_ACTOR = "apify~instagram-scraper";

const RESULTS_LIMIT_PER_INFLUENCER = 5;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Target {
  influencer_id: number | null;
  username: string;
  profile_url: string;
}

interface ScrapedReel {
  username: string;
  reel_url: string;
  video_url: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  posted_at: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  if (!APIFY_API_TOKEN) {
    return jsonResponse({ error: "APIFY_API_TOKEN secret is not set on this function." }, 500);
  }

  let body: { influencer_id?: number; username?: string; all?: boolean; days?: number };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // ---- Ad-hoc mode: no database read/write, just prove the scraper works ----
    if (body.username && !body.influencer_id && !body.all) {
      const profileUrl = `https://www.instagram.com/${body.username}/`;
      const items = await runApifyScrape([{ influencer_id: null, username: body.username, profile_url: profileUrl }], body.days);
      return jsonResponse({ scraped: items });
    }

    // ---- Watchlist mode: one influencer, or every active influencer ----
    let targets: Target[];
    if (body.all) {
      const { data, error } = await supabase.from("influencers").select("id, username, profile_url").eq("active", true);
      if (error) throw error;
      targets = data.map((i) => ({ influencer_id: i.id, username: i.username, profile_url: i.profile_url }));
    } else if (body.influencer_id) {
      const { data, error } = await supabase.from("influencers").select("id, username, profile_url").eq("id", body.influencer_id).maybeSingle();
      if (error) throw error;
      if (!data) return jsonResponse({ error: `No influencer with id ${body.influencer_id}` }, 404);
      targets = [{ influencer_id: data.id, username: data.username, profile_url: data.profile_url }];
    } else {
      return jsonResponse({ error: "Provide influencer_id, all:true, or username." }, 400);
    }

    if (targets.length === 0) {
      return jsonResponse({ scraped: 0, inserted: 0, skipped_duplicates: 0, results: [] });
    }

    const scraped = await runApifyScrape(targets, body.days);
    const saved = await saveNewReels(supabase, targets, scraped);

    return jsonResponse({
      scraped: scraped.length,
      inserted: saved.inserted.length,
      skipped_duplicates: saved.skippedDuplicates,
      skipped_unmatched_username: saved.skippedUnmatched,
      inserted_videos: saved.inserted,
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// Runs the Apify actor against every target's profile URL in a single batch
// run, polls until it finishes, and returns normalized reels (not yet
// filtered for duplicates or matched back to influencer_id -- callers do that).
async function runApifyScrape(targets: Target[], days?: number): Promise<ScrapedReel[]> {
  const input: Record<string, unknown> = {
    resultsType: "reels",
    directUrls: targets.map((t) => t.profile_url),
    resultsLimit: RESULTS_LIMIT_PER_INFLUENCER,
  };
  if (days) input.onlyPostsNewerThan = `${days} days`;

  const startRes = await fetch(`${APIFY_BASE}/actors/${APIFY_ACTOR}/runs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${APIFY_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!startRes.ok) throw new Error(`Apify run start failed: ${await startRes.text()}`);
  const startData = await startRes.json();
  const runId = startData.data.id;

  const run = await waitForRunFinished(runId);
  if (run.status !== "SUCCEEDED") {
    throw new Error(`Apify run ended with status ${run.status}`);
  }

  const itemsRes = await fetch(`${APIFY_BASE}/datasets/${run.defaultDatasetId}/items?clean=true`, {
    headers: { Authorization: `Bearer ${APIFY_API_TOKEN}` },
  });
  if (!itemsRes.ok) throw new Error(`Fetching Apify dataset failed: ${await itemsRes.text()}`);
  const items = await itemsRes.json();

  return items
    .filter((item: Record<string, unknown>) => item.videoUrl && item.url) // real Reels only, not photo posts
    .map((item: Record<string, unknown>) => ({
      username: (item.ownerUsername as string) ?? "",
      reel_url: item.url as string,
      video_url: (item.videoUrl as string) ?? null,
      thumbnail_url: (item.displayUrl as string) ?? null,
      caption: (item.caption as string) ?? null,
      posted_at: item.timestamp ? new Date(item.timestamp as string).toISOString().slice(0, 10) : null,
    }));
}

async function waitForRunFinished(runId: string, maxAttempts = 60, delayMs = 3000) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}`, { headers: { Authorization: `Bearer ${APIFY_API_TOKEN}` } });
    if (!res.ok) throw new Error(`Checking Apify run status failed: ${await res.text()}`);
    const { data } = await res.json();
    if (["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(data.status)) return data;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error("Timed out waiting for the Apify run to finish.");
}

// Matches scraped reels back to influencer_id by username, skips anything
// whose reel_url is already in `videos` (the column also has a unique
// constraint as a second line of defense), and inserts the rest.
async function saveNewReels(supabase: ReturnType<typeof createClient>, targets: Target[], scraped: ScrapedReel[]) {
  const usernameToInfluencerId = new Map(targets.map((t) => [t.username.toLowerCase(), t.influencer_id]));

  const candidateUrls = scraped.map((r) => r.reel_url);
  const { data: existingRows, error: existingError } = await supabase.from("videos").select("reel_url").in("reel_url", candidateUrls);
  if (existingError) throw existingError;
  const existingUrls = new Set((existingRows ?? []).map((r) => r.reel_url));

  const inserted: unknown[] = [];
  let skippedDuplicates = 0;
  let skippedUnmatched = 0;

  for (const reel of scraped) {
    if (existingUrls.has(reel.reel_url)) {
      skippedDuplicates++;
      continue;
    }
    const influencerId = usernameToInfluencerId.get(reel.username.toLowerCase());
    if (!influencerId) {
      skippedUnmatched++; // Apify returned a reel for a username we didn't ask about (shouldn't normally happen)
      continue;
    }

    const { data, error } = await supabase
      .from("videos")
      .insert({
        influencer_id: influencerId,
        reel_url: reel.reel_url,
        video_url: reel.video_url,
        thumbnail_url: reel.thumbnail_url,
        caption: reel.caption,
        posted_at: reel.posted_at,
      })
      .select()
      .maybeSingle();

    if (error) {
      if (error.code === "23505") { // unique_violation -- duplicate slipped through a race, not a real failure
        skippedDuplicates++;
        continue;
      }
      throw error;
    }
    inserted.push(data);
  }

  return { inserted, skippedDuplicates, skippedUnmatched };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}
