// Dashboard data visualizations. Every number here comes straight from the
// real Supabase data already loaded on the page (js/db.js) -- nothing here
// is synthetic or placeholder. Two charts:
//   - renderRiskByInfluencerChart: avg risk score per influencer (bar)
//   - renderReelsTimelineChart: reels analyzed per month (bar)
// Mark specs follow the dataviz skill: thin marks, rounded ends, status
// color reserved for risk-level state (shipped with a legend + labels,
// never color alone), per-mark hover tooltips via native <title>.
//
// Bar fills animate in via a CSS keyframe reading a --target custom
// property set inline (see growWidth/growHeight in css/style.css) rather
// than JS toggling styles after a requestAnimationFrame -- the latter was
// unreliable under synthetic/virtual-time environments (headless testing,
// throttled tabs), where the second rAF isn't guaranteed to land before
// paint. A pure-CSS animation always plays correctly since the browser
// owns the whole timeline itself.

function riskBucket(score) {
  if (score >= 81) return "CRITICAL";
  if (score >= 61) return "HIGH";
  if (score >= 31) return "REVIEW";
  return "LOW";
}

const BUCKET_COLOR = {
  LOW: "var(--status-good)",
  REVIEW: "var(--status-warning)",
  HIGH: "var(--status-serious)",
  CRITICAL: "var(--status-critical)",
};

// ---- Chart 1: average risk score by influencer (horizontal bars) --------

function renderRiskByInfluencerChart(container, joined) {
  const byInfluencer = new Map();
  for (const row of joined) {
    if (!row.analysis) continue; // not analyzed yet -- don't count as a 0
    const key = row.influencer.id;
    if (!byInfluencer.has(key)) {
      byInfluencer.set(key, { username: row.influencer.username, total: 0, count: 0 });
    }
    const entry = byInfluencer.get(key);
    entry.total += row.analysis.risk_score;
    entry.count += 1;
  }

  const rows = Array.from(byInfluencer.values())
    .map((e) => ({ username: e.username, avg: Math.round(e.total / e.count), count: e.count }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 8);

  if (rows.length === 0) {
    container.innerHTML = `<p class="text-sm py-8 text-center" style="color: var(--text-muted)">No analyzed reels yet.</p>`;
    return;
  }

  const legend = `
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4 text-xs" style="color: var(--text-secondary)">
      ${["LOW", "REVIEW", "HIGH", "CRITICAL"]
        .map((b) => `<span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full" style="background:${BUCKET_COLOR[b]}"></span>${RISK_META[b].label}</span>`)
        .join("")}
    </div>`;

  const bars = rows
    .map((r, i) => {
      const bucket = riskBucket(r.avg);
      const color = BUCKET_COLOR[bucket];
      const pct = Math.max(2, r.avg); // 0-100 scale maps directly to width%
      return `
      <div class="chart-bar-row" style="animation-delay:${i * 60}ms">
        <span class="chart-bar-label tabular" title="@${escapeHtml(r.username)}">@${escapeHtml(r.username)}</span>
        <div class="chart-bar-track">
          <div class="chart-bar-fill" style="--target:${pct}%; background:${color}" title="@${escapeHtml(r.username)}: avg risk score ${r.avg}/100 across ${r.count} analyzed reel${r.count === 1 ? "" : "s"}"></div>
        </div>
        <span class="tabular text-xs font-semibold w-8 text-right" style="color: var(--text-primary)">${r.avg}</span>
      </div>`;
    })
    .join("");

  container.innerHTML = legend + `<div class="flex flex-col gap-2.5">${bars}</div>`;
}

// ---- Chart 2: reels by month posted (discrete bars) -----------------------
// A bar chart, not a line/area: the real posted_at spread is sparse and
// bursty (some accounts' scraped Reels go back years, others are all from
// the last few days), so implying a smooth continuous trend between distant
// points would misrepresent it. Bars treat each month as the discrete count
// it is, and empty months between real data points are simply not drawn
// rather than padded in as fake zeros.

function renderReelsTimelineChart(container, joined) {
  const withDates = joined.filter((r) => r.video.posted_at);
  if (withDates.length === 0) {
    container.innerHTML = `<p class="text-sm py-8 text-center" style="color: var(--text-muted)">No reel dates yet.</p>`;
    return;
  }

  const counts = new Map();
  for (const row of withDates) {
    const month = row.video.posted_at.slice(0, 7); // YYYY-MM
    counts.set(month, (counts.get(month) || 0) + 1);
  }
  const points = Array.from(counts.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => (a.month < b.month ? -1 : 1));

  const maxCount = Math.max(...points.map((p) => p.count), 1);
  const n = points.length;
  const showEvery = Math.max(1, Math.ceil(n / 10));

  const bars = points
    .map((p, i) => {
      const heightPct = Math.max(6, Math.round((p.count / maxCount) * 100));
      const label = new Date(p.month + "-01T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
      const showLabel = n <= 10 || i % showEvery === 0 || i === n - 1;
      return `
      <div class="chart-vbar" style="animation-delay:${i * 25}ms">
        <div class="chart-vbar-track">
          <div class="chart-vbar-fill" style="--target:${heightPct}%; animation-delay:${i * 25}ms" title="${label}: ${p.count} reel${p.count === 1 ? "" : "s"}"></div>
        </div>
        <span class="chart-vbar-label font-mono-ui">${showLabel ? label : ""}</span>
      </div>`;
    })
    .join("");

  container.innerHTML = `<div class="chart-vbar-row">${bars}</div>`;
}
