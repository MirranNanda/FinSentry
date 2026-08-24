// FinSentry Phase 4 — risk/review-priority scoring.
//
// Plain rule-based JavaScript, deliberately not ML: takes the structured
// fields Gemini extracted (Phase 3) and produces a 0-100 review-priority
// score. This is an internal triage signal for a human reviewer, never an
// automatic SEBI-violation determination.
//
// This is the canonical reference copy of the scoring rules. The Edge
// Function (supabase/functions/analyze-video/index.ts) is deployed as a
// single file via the Supabase Dashboard, so it carries its own inlined
// copy of this same logic rather than importing this file -- keep both in
// sync if you change the rules here.

const RISK_POINTS = {
  RECOMMENDATION: 25, // a clear BUY or SELL call
  PRICE_TARGET: 15, // a specific price target was given
  FUTURE_PREDICTION: 15, // a prediction about future price/performance
  HIGH_CERTAINTY: 10, // Gemini judged the speaker's language as highly certain
  URGENCY: 10, // general urgency language ("act now", "don't miss")
  GUARANTEE: 20, // absolute/guaranteed-return language -- the strongest single signal
};

// Two tiers of "urgent language," checked against the evidence quote.
// GUARANTEE outranks URGENCY when both would match (checked first below) --
// a guarantee claim is scored once, at the higher tier, not stacked with urgency.
const GUARANTEE_KEYWORDS = [
  "guarantee",
  "guaranteed",
  "100%",
  "sure-shot",
  "sure shot",
  "surely",
  "certainly will",
  "confirmed",
  "no doubt",
  "risk-free",
  "risk free",
  "definitely will",
  "will double",
  "will triple",
  "cannot lose",
  "can't lose",
];

const URGENCY_KEYWORDS = [
  "don't miss",
  "dont miss",
  "act now",
  "act fast",
  "hurry",
  "before it's too late",
  "before its too late",
  "limited time",
  "last chance",
  "buy now",
  "sell now",
  "immediately",
  "right now",
  "get in before",
  "trust me",
  "don't wait",
  "dont wait",
];

function scoreUrgentLanguage(evidence) {
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

// levels: LOW 0-30, REVIEW 31-60, HIGH 61-80, CRITICAL 81-100
function riskLevelFromScore(score) {
  if (score >= 81) return "CRITICAL";
  if (score >= 61) return "HIGH";
  if (score >= 31) return "REVIEW";
  return "LOW";
}

// analysis: the structured fields from Gemini (Phase 3's output shape).
// Returns { risk_score, risk_level, score_breakdown }.
function calculateRiskScore(analysis) {
  if (!analysis || !analysis.is_financial_content) {
    return { risk_score: 0, risk_level: "LOW", score_breakdown: [] };
  }

  const breakdown = [];

  if (analysis.recommendation === "BUY" || analysis.recommendation === "SELL") {
    breakdown.push({ reason: "BUY/SELL recommendation", points: RISK_POINTS.RECOMMENDATION });
  }
  if (analysis.price_target) {
    breakdown.push({ reason: "Price target given", points: RISK_POINTS.PRICE_TARGET });
  }
  if (analysis.future_prediction) {
    breakdown.push({ reason: "Future prediction", points: RISK_POINTS.FUTURE_PREDICTION });
  }
  if (analysis.certainty === "HIGH") {
    breakdown.push({ reason: "High certainty language", points: RISK_POINTS.HIGH_CERTAINTY });
  }
  const urgent = scoreUrgentLanguage(analysis.evidence);
  if (urgent) breakdown.push(urgent);

  const risk_score = Math.min(100, breakdown.reduce((sum, b) => sum + b.points, 0));
  return { risk_score, risk_level: riskLevelFromScore(risk_score), score_breakdown: breakdown };
}
