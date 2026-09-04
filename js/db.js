// Data access layer backed by Supabase. Mirrors the shape mockData.js used
// to hand pages in Phase 1 ({ video, influencer, analysis, flag }) so the
// rendering code in dashboard.js / influencers.js / flagged.js / reel.js
// barely had to change when the mock arrays were swapped for real queries.

const REEL_SELECT = "*, influencer:influencers(*), analysis:analyses(*, flag:flags(*))";

// PostgREST returns embedded one-to-many relationships as arrays even when,
// in practice, there's at most one row (one analysis per video, one flag per
// analysis) -- this normalizes that down to a single object or null.
function reshapeVideoRow(row) {
  const { influencer, analysis, ...video } = row;
  const analysisRow = Array.isArray(analysis) ? analysis[0] || null : analysis;
  let flag = null;
  let cleanAnalysis = null;
  if (analysisRow) {
    const { flag: flagRel, ...analysisRest } = analysisRow;
    cleanAnalysis = analysisRest;
    flag = Array.isArray(flagRel) ? flagRel[0] || null : flagRel || null;
  }
  return {
    video,
    influencer: Array.isArray(influencer) ? influencer[0] || null : influencer,
    analysis: cleanAnalysis,
    flag,
  };
}

async function getInfluencers() {
  const { data, error } = await supabaseClient.from("influencers").select("*");
  if (error) throw error;
  return data;
}

async function getInfluencerById(id) {
  const { data, error } = await supabaseClient.from("influencers").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

// Every video joined with its influencer, analysis, and flag (if any) --
// the same shape every Phase 1 page rendered from.
async function getJoinedReels() {
  const { data, error } = await supabaseClient
    .from("videos")
    .select(REEL_SELECT)
    .order("posted_at", { ascending: false });
  if (error) throw error;
  return data.map(reshapeVideoRow);
}

async function getFlaggedReels() {
  const rows = await getJoinedReels();
  return rows.filter((row) => row.flag !== null);
}

async function getVideoWithDetails(id) {
  const { data, error } = await supabaseClient.from("videos").select(REEL_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? reshapeVideoRow(data) : null;
}

async function updateFlag(flagId, updates) {
  const { data, error } = await supabaseClient.from("flags").update(updates).eq("id", flagId).select().maybeSingle();
  if (error) throw error;
  return data;
}

// Phase 7: re-runs Gemini analysis for a video that's stuck or failed.
// Calls the analyze-video Edge Function directly -- same one the database
// trigger and the retry cron job call, just invoked manually from the UI.
async function retryAnalysis(videoId) {
  const { data, error } = await supabaseClient.functions.invoke("analyze-video", { body: { video_id: videoId } });
  if (error) throw error;
  return data;
}

// Live updates: calls onChange (debounced) whenever any row in the given
// tables changes -- e.g. the background analysis pipeline finishing a
// video, or a flag being reviewed elsewhere. Pages use this to silently
// refresh instead of requiring a manual reload. Requires each table to be
// added to the `supabase_realtime` publication (see README).
function subscribeToTableChanges(tables, onChange, debounceMs = 800) {
  const debounced = debounce(onChange, debounceMs);
  const channel = supabaseClient.channel(`live-${tables.join("-")}`);
  for (const table of tables) {
    channel.on("postgres_changes", { event: "*", schema: "public", table }, debounced);
  }
  channel.subscribe();
  return channel;
}
