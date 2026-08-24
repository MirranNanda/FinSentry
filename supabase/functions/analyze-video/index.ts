// FinSentry Phase 3+4 — Gemini video analysis, then rule-based risk scoring.
//
// A Supabase Edge Function (Deno) so the Gemini API key never reaches the
// frontend. Given a video, it asks Gemini to watch/listen to it and extract:
// financial content, stock name, BUY/SELL call, price target, future
// prediction, certainty, and a supporting quote + timestamp. It then scores
// that with plain rule-based JavaScript (no ML -- see calculateRiskScore /
// js/riskScoring.js, the canonical copy of these same rules) and saves both
// the analysis and, if it clears the REVIEW threshold, a flag for human
// review. FinSentry never decides on its own that a rule was violated.
//
// Phase 7: when called with video_id, it also tracks `videos.status`
// (pending -> processing -> complete|failed) and records the error message
// on failure, so the frontend can show real progress instead of silence,
// and so a scheduled retry job (supabase/phase7_automation.sql) knows what
// to retry. Run that SQL file before relying on this -- it's what adds the
// status/status_error/retry_count columns.
//
// Deploy via the Supabase Dashboard: Edge Functions -> New Function ->
// name it "analyze-video" -> paste this file's contents -> Deploy.
// Then add a secret: Edge Functions -> Secrets -> GEMINI_API_KEY.
//
// Call it with EITHER:
//   { "video_id": 101 }                                   -- looks the video up in Supabase, saves the result to `analyses`
//   { "video_url": "...", "caption": "..." }               -- ad-hoc test, does not touch the database
//
// curl example (from the project README):
//   curl -X POST "$SUPABASE_URL/functions/v1/analyze-video" \
//     -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
//     -H "Content-Type: application/json" \
//     -d '{"video_id": 101}'

import { createClient } from "npm:@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_BASE = "https://generativelanguage.googleapis.com";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ANALYSIS_PROMPT = `You are reviewing a short-form financial/investing video (an Instagram Reel) for a compliance review tool. Watch and listen to the full video, and read the caption below.

Extract ONLY what is actually said or shown -- do not infer intent, and do not judge whether anything is legal or a rule violation. That determination is made by a human reviewer, not you.

Determine:
- is_financial_content: true if the video discusses a specific stock, or gives investing advice/recommendations. false for unrelated content (lifestyle, unrelated education, etc).
- stock: the company name mentioned, if any (e.g. "Tata Motors"). null if none or if not financial content.
- ticker: the stock's ticker symbol if stated or clearly implied (e.g. "TATAMOTORS"). null otherwise.
- recommendation: "BUY", "SELL", or "HOLD" if the speaker recommends an action on the stock. null if no clear recommendation is made.
- price_target: any specific price or price target mentioned, as stated (e.g. "₹1000"). null if none given.
- future_prediction: true if the speaker makes a prediction about future price/performance (e.g. "this will double", "expect a jump after results").
- certainty: how confident/certain the speaker's language is about their claim -- "HIGH" (e.g. "guaranteed", "100%", "will definitely"), "MEDIUM" (e.g. "I expect", "likely"), or "LOW" (e.g. general education, no strong claims).
- evidence: the exact quote (transcribed from speech, or on-screen text) that best supports the above fields. null if is_financial_content is false.
- timestamp: the MM:SS timestamp in the video where that evidence occurs. null if there's no clear single moment (e.g. text was on screen the whole time) or if is_financial_content is false.

Caption: {{CAPTION}}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (!GEMINI_API_KEY) {
    return jsonResponse({ error: "GEMINI_API_KEY secret is not set on this function." }, 500);
  }

  let body: { video_id?: number; video_url?: string; caption?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Request body must be JSON." }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let videoUrl = body.video_url;
  let caption = body.caption ?? "";
  let videoRow: { id: number } | null = null;

  try {
    if (body.video_id) {
      const { data, error } = await supabase.from("videos").select("id, video_url, caption").eq("id", body.video_id).maybeSingle();
      if (error) throw error;
      if (!data) return jsonResponse({ error: `No video with id ${body.video_id}` }, 404);
      videoRow = { id: data.id };
      videoUrl = data.video_url;
      caption = data.caption ?? "";
      await supabase.from("videos").update({ status: "processing", status_error: null }).eq("id", videoRow.id);
    }

    if (!videoUrl) {
      return jsonResponse({ error: "Provide either video_id or video_url." }, 400);
    }

    const analysis = await analyzeVideoWithGemini(videoUrl, caption);

    let savedAnalysis = null;
    if (videoRow) {
      savedAnalysis = await saveAnalysis(supabase, videoRow.id, analysis);
      await supabase.from("videos").update({ status: "complete", status_error: null }).eq("id", videoRow.id);
    }

    return jsonResponse({ analysis, saved: savedAnalysis });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : String(error);
    if (videoRow) {
      await supabase.from("videos").update({ status: "failed", status_error: message }).eq("id", videoRow.id);
    }
    return jsonResponse({ error: message }, 500);
  }
});

async function analyzeVideoWithGemini(videoUrl: string, caption: string) {
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) {
    throw new Error(`Couldn't download video from ${videoUrl} (HTTP ${videoRes.status})`);
  }
  const mimeType = videoRes.headers.get("content-type") || "video/mp4";
  const videoBytes = new Uint8Array(await videoRes.arrayBuffer());

  const file = await uploadToGeminiFiles(videoBytes, mimeType);
  const activeFile = await waitForFileActive(file.name);

  const prompt = ANALYSIS_PROMPT.replace("{{CAPTION}}", caption || "(no caption)");

  const generateRes = await fetch(`${GEMINI_BASE}/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ file_data: { file_uri: activeFile.uri, mime_type: activeFile.mimeType } }, { text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: ANALYSIS_RESPONSE_SCHEMA,
      },
    }),
  });

  if (!generateRes.ok) {
    throw new Error(`Gemini generateContent failed: ${await generateRes.text()}`);
  }
  const generated = await generateRes.json();
  const text = generated.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content.");

  deleteGeminiFile(activeFile.name).catch(() => {}); // best-effort cleanup, don't block the response

  return JSON.parse(text);
}

const ANALYSIS_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    is_financial_content: { type: "BOOLEAN" },
    stock: { type: "STRING", nullable: true },
    ticker: { type: "STRING", nullable: true },
    recommendation: { type: "STRING", enum: ["BUY", "SELL", "HOLD"], nullable: true },
    price_target: { type: "STRING", nullable: true },
    future_prediction: { type: "BOOLEAN" },
    certainty: { type: "STRING", enum: ["LOW", "MEDIUM", "HIGH"] },
    evidence: { type: "STRING", nullable: true },
    timestamp: { type: "STRING", nullable: true },
  },
  required: ["is_financial_content", "future_prediction", "certainty"],
};

async function uploadToGeminiFiles(bytes: Uint8Array, mimeType: string) {
  const startRes = await fetch(`${GEMINI_BASE}/upload/v1beta/files?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: "finsentry-reel" } }),
  });
  if (!startRes.ok) throw new Error(`Gemini file upload (start) failed: ${await startRes.text()}`);
  const uploadUrl = startRes.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Gemini didn't return an upload URL.");

  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: bytes,
  });
  if (!uploadRes.ok) throw new Error(`Gemini file upload (finalize) failed: ${await uploadRes.text()}`);
  const { file } = await uploadRes.json();
  return file as { name: string; uri: string; mimeType: string; state: string };
}

async function waitForFileActive(fileName: string, maxAttempts = 30, delayMs = 2000) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(`${GEMINI_BASE}/v1beta/${fileName}?key=${GEMINI_API_KEY}`);
    if (!res.ok) throw new Error(`Checking Gemini file status failed: ${await res.text()}`);
    const file = await res.json();
    if (file.state === "ACTIVE") return file as { name: string; uri: string; mimeType: string; state: string };
    if (file.state === "FAILED") throw new Error("Gemini failed to process the uploaded video.");
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error("Timed out waiting for Gemini to finish processing the video.");
}

async function deleteGeminiFile(fileName: string) {
  await fetch(`${GEMINI_BASE}/v1beta/${fileName}?key=${GEMINI_API_KEY}`, { method: "DELETE" });
}

// ---- Phase 4: rule-based risk scoring --------------------------------
// Mirrors js/riskScoring.js exactly. Kept as an inline copy (rather than
// imported) because this function is deployed as a single file via the
// Supabase Dashboard editor -- keep both copies in sync if the rules change.

const RISK_POINTS = { RECOMMENDATION: 25, PRICE_TARGET: 15, FUTURE_PREDICTION: 15, HIGH_CERTAINTY: 10, URGENCY: 10, GUARANTEE: 20 };

const GUARANTEE_KEYWORDS = [
  "guarantee", "guaranteed", "100%", "sure-shot", "sure shot", "surely", "certainly will", "confirmed",
  "no doubt", "risk-free", "risk free", "definitely will", "will double", "will triple", "cannot lose", "can't lose",
];

const URGENCY_KEYWORDS = [
  "don't miss", "dont miss", "act now", "act fast", "hurry", "before it's too late", "before its too late",
  "limited time", "last chance", "buy now", "sell now", "immediately", "right now", "get in before",
  "trust me", "don't wait", "dont wait",
];

function scoreUrgentLanguage(evidence: string | null) {
  if (!evidence) return null;
  const text = evidence.toLowerCase();
  if (GUARANTEE_KEYWORDS.some((k) => text.includes(k))) {
    return { reason: "Guaranteed-return / absolute language", points: RISK_POINTS.GUARANTEE };
  }
  if (URGENCY_KEYWORDS.some((k) => text.includes(k))) {
    return { reason: "Urgent language", points: RISK_POINTS.URGENCY };
  }
  return null;
}

function riskLevelFromScore(score: number) {
  if (score >= 81) return "CRITICAL";
  if (score >= 61) return "HIGH";
  if (score >= 31) return "REVIEW";
  return "LOW";
}

function calculateRiskScore(analysis: Record<string, unknown>) {
  if (!analysis.is_financial_content) {
    return { risk_score: 0, risk_level: "LOW", score_breakdown: [] as { reason: string; points: number }[] };
  }

  const breakdown: { reason: string; points: number }[] = [];
  if (analysis.recommendation === "BUY" || analysis.recommendation === "SELL") {
    breakdown.push({ reason: "BUY/SELL recommendation", points: RISK_POINTS.RECOMMENDATION });
  }
  if (analysis.price_target) breakdown.push({ reason: "Price target given", points: RISK_POINTS.PRICE_TARGET });
  if (analysis.future_prediction) breakdown.push({ reason: "Future prediction", points: RISK_POINTS.FUTURE_PREDICTION });
  if (analysis.certainty === "HIGH") breakdown.push({ reason: "High certainty language", points: RISK_POINTS.HIGH_CERTAINTY });
  const urgent = scoreUrgentLanguage((analysis.evidence as string) ?? null);
  if (urgent) breakdown.push(urgent);

  const risk_score = Math.min(100, breakdown.reduce((sum, b) => sum + b.points, 0));
  return { risk_score, risk_level: riskLevelFromScore(risk_score), score_breakdown: breakdown };
}

// ---- Persistence --------------------------------------------------------

async function saveAnalysis(supabase: ReturnType<typeof createClient>, videoId: number, analysis: Record<string, unknown>) {
  const scoring = calculateRiskScore(analysis);
  const row = {
    video_id: videoId,
    is_financial_content: !!analysis.is_financial_content,
    stock: analysis.stock ?? null,
    ticker: analysis.ticker ?? null,
    recommendation: analysis.recommendation ?? null,
    price_target: analysis.price_target ?? null,
    future_prediction: !!analysis.future_prediction,
    certainty: analysis.certainty ?? "LOW",
    evidence: analysis.evidence ?? null,
    timestamp: analysis.timestamp ?? null,
    raw_response: analysis,
    risk_score: scoring.risk_score,
    risk_level: scoring.risk_level,
    score_breakdown: scoring.score_breakdown,
  };

  const { data: existing, error: findError } = await supabase.from("analyses").select("id").eq("video_id", videoId).maybeSingle();
  if (findError) throw findError;

  const query = existing
    ? supabase.from("analyses").update(row).eq("id", existing.id)
    : supabase.from("analyses").insert(row);

  const { data, error } = await query.select().maybeSingle();
  if (error) throw error;

  await syncFlag(supabase, data.id, scoring);
  return data;
}

// REVIEW/HIGH/CRITICAL gets a flag row so it shows up on the Flagged
// Content page; LOW means no flag (and clears a stale one from a prior
// analysis run, if any). Re-running analysis never resets a flag a human
// has already reviewed -- only severity/reason are refreshed.
async function syncFlag(supabase: ReturnType<typeof createClient>, analysisId: number, scoring: ReturnType<typeof calculateRiskScore>) {
  const { data: existingFlag, error: findError } = await supabase.from("flags").select("id").eq("analysis_id", analysisId).maybeSingle();
  if (findError) throw findError;

  if (scoring.risk_level === "LOW") {
    if (existingFlag) {
      const { error } = await supabase.from("flags").delete().eq("id", existingFlag.id);
      if (error) throw error;
    }
    return;
  }

  const reason = scoring.score_breakdown.length
    ? `Risk factors: ${scoring.score_breakdown.map((b) => b.reason).join(", ")}.`
    : "Flagged for review.";

  if (existingFlag) {
    const { error } = await supabase.from("flags").update({ severity: scoring.risk_level, reason }).eq("id", existingFlag.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("flags").insert({ analysis_id: analysisId, severity: scoring.risk_level, reason, reviewed: false });
    if (error) throw error;
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
