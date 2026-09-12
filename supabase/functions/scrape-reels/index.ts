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
// Optional on the watchlist modes: { "max_new": 5 } -- caps how many *new*
// Reels get inserted this run (newest posted_at first), so a scheduled daily
// call can add a small, predictable trickle instead of however many Apify
// happens to return. Anything past the cap is simply not saved this run --
// harmless, since tomorrow's run reconsiders whatever Apify still returns.
//
// Self-healing dead links: Instagram's video_url is a short-lived signed CDN
// link (observed: often dead again within ~24h). If analyze-video couldn't
// download it in time, that video is permanently stuck at status='failed' --
// no amount of retrying the *same* URL will ever fix it. But every time this
// scraper re-scrapes a watchlist account, Apify hands back a FRESH video_url
// for any Reel that's still live on Instagram, including ones we already
// have a (dead) row for. So instead of only skipping already-seen reel_urls
// as plain duplicates, this refreshes the video_url on any existing row
// that's currently 'failed' and re-queues it for analysis -- at zero extra
// Apify cost, since we're scraping that account anyway. Capped separately by
// { "max_refresh": 3 } so a run doesn't burn the whole Gemini daily quota
// re-trying old failures instead of covering new content.
//
// curl example (from the project README):
//   curl -X POST "$SUPABASE_URL/functions/v1/scrape-reels" \
//     -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
//     -H "Content-Type: application/json" \
//     -d '{"all": true, "max_new": 5, "max_refresh": 3}'

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

  let body: { influencer_id?: number; username?: string; all?: boolean; days?: number; max_new?: number; max_refresh?: number };
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
    const saved = await saveNewReels(supabase, targets, scraped, body.max_new, body.max_refresh);

    return jsonResponse({
      scraped: scraped.length,
      inserted: saved.inserted.length,
      refreshed: saved.refreshed.length,
      skipped_duplicates: saved.skippedDuplicates,
      skipped_unmatched_username: saved.skippedUnmatched,
      skipped_over_cap: saved.skippedOverCap,
      skipped_refresh_over_cap: saved.skippedRefreshOverCap,
      inserted_videos: saved.inserted,
      refreshed_videos: saved.refreshed,
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

// Matches scraped reels back to influencer_id by username. For each scraped
// reel that's genuinely new, inserts it (capped by maxNew). For one we
// already have on file, only 'failed' rows are worth touching -- refresh
// their video_url with the fresh one Apify just returned and re-queue them
// for analysis (capped separately by maxRefresh); anything else (complete,
// pending, processing) is left alone as a plain duplicate.
async function saveNewReels(
  supabase: ReturnType<typeof createClient>,
  targets: Target[],
  scraped: ScrapedReel[],
  maxNew?: number,
  maxRefresh?: number,
) {
  const usernameToInfluencerId = new Map(targets.map((t) => [t.username.toLowerCase(), t.influencer_id]));

  const candidateUrls = scraped.map((r) => r.reel_url);
  const { data: existingRows, error: existingError } = await supabase
    .from("videos")
    .select("id, reel_url, status")
    .in("reel_url", candidateUrls);
  if (existingError) throw existingError;
  const existingByUrl = new Map((existingRows ?? []).map((r) => [r.reel_url, r]));

  const inserted: unknown[] = [];
  const refreshed: unknown[] = [];
  let skippedDuplicates = 0;
  let skippedUnmatched = 0;
  let skippedOverCap = 0;
  let skippedRefreshOverCap = 0;

  // Genuinely-new candidates. A capped run (e.g. the daily 5-a-day
  // schedule) should prioritize recently-posted content -- but a flat
  // sort-by-recency across every influencer lets whichever accounts post
  // most *often* (typically the biggest ones) fill every slot, so a
  // smaller/less-frequent account's equally-recent Reel never gets picked.
  // pickDiverseNewest round-robins by influencer instead: every influencer
  // with new content contributes their single most recent Reel before any
  // influencer contributes a second, so the daily trickle actually spans
  // the whole watchlist, big and small alike.
  const allNewCandidates = scraped.filter((reel) => !existingByUrl.has(reel.reel_url));
  let newCandidates = allNewCandidates;
  if (typeof maxNew === "number" && allNewCandidates.length > maxNew) {
    newCandidates = pickDiverseNewest(allNewCandidates, maxNew);
    skippedOverCap = allNewCandidates.length - newCandidates.length;
  }

  for (const reel of newCandidates) {
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

  // Already-seen reels whose stored link is dead -- worth refreshing since
  // Apify just handed back a live one for the same still-published Reel.
  let refreshCandidates = scraped.filter((reel) => existingByUrl.get(reel.reel_url)?.status === "failed");
  refreshCandidates.sort((a, b) => (b.posted_at ?? "").localeCompare(a.posted_at ?? ""));

  if (typeof maxRefresh === "number" && refreshCandidates.length > maxRefresh) {
    skippedRefreshOverCap = refreshCandidates.length - maxRefresh;
    refreshCandidates = refreshCandidates.slice(0, maxRefresh);
  }

  for (const reel of refreshCandidates) {
    const existing = existingByUrl.get(reel.reel_url)!;
    const { data, error } = await supabase
      .from("videos")
      .update({
        video_url: reel.video_url,
        thumbnail_url: reel.thumbnail_url,
        status: "pending",
        status_error: null,
        retry_count: 0,
      })
      .eq("id", existing.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    refreshed.push(data);
  }

  // Everything else already in `videos` (complete, pending, processing, or a
  // failed row that lost out to the refresh cap) is a plain duplicate.
  const refreshedIds = new Set(refreshCandidates.map((r) => r.reel_url));
  skippedDuplicates += scraped.filter(
    (r) => existingByUrl.has(r.reel_url) && !refreshedIds.has(r.reel_url),
  ).length;

  return { inserted, refreshed, skippedDuplicates, skippedUnmatched, skippedOverCap, skippedRefreshOverCap };
}

// Round-robins reels across influencers (grouped by username), most-recent
// first within each account: round 0 takes the single newest reel from
// every influencer that has one, ordered by recency; only once everyone's
// had a turn does round 1 start handing out anyone's second-newest. This
// keeps a handful of highly prolific accounts from filling the whole cap
// with their own posts before a smaller/less-frequent account gets a turn.
function pickDiverseNewest(candidates: ScrapedReel[], cap: number): ScrapedReel[] {
  const byInfluencer = new Map<string, ScrapedReel[]>();
  for (const reel of candidates) {
    const key = reel.username.toLowerCase();
    if (!byInfluencer.has(key)) byInfluencer.set(key, []);
    byInfluencer.get(key)!.push(reel);
  }
  for (const list of byInfluencer.values()) {
    list.sort((a, b) => (b.posted_at ?? "").localeCompare(a.posted_at ?? ""));
  }

  const picked: ScrapedReel[] = [];
  for (let round = 0; picked.length < cap; round++) {
    const roundItems = [...byInfluencer.values()].map((list) => list[round]).filter((reel): reel is ScrapedReel => !!reel);
    if (roundItems.length === 0) break; // no influencer has any candidates left
    roundItems.sort((a, b) => (b.posted_at ?? "").localeCompare(a.posted_at ?? ""));
    for (const reel of roundItems) {
      if (picked.length >= cap) break;
      picked.push(reel);
    }
  }
  return picked;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}
