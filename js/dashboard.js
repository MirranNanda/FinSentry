// Dashboard page: stat tiles, risk distribution, recent flags table.
// Data now comes from Supabase (js/db.js) instead of the Phase 1 mock arrays.

function renderStatTiles(influencers, joined) {
  const analyzed = joined.filter((r) => r.analysis && r.analysis.is_financial_content);
  const flagged = joined.filter((r) => r.flag !== null);
  const critical = joined.filter((r) => r.analysis && r.analysis.risk_level === "CRITICAL");
  const activeInfluencers = influencers.filter((i) => i.active).length;

  const tiles = [
    { label: "Watched influencers", value: influencers.length, sub: `${activeInfluencers} active`, color: "var(--series-blue)" },
    { label: "Reels analyzed", value: analyzed.length, sub: `${joined.length} total scraped`, color: "var(--series-blue)" },
    { label: "Flagged for review", value: flagged.length, sub: `${flagged.filter((r) => !r.flag.reviewed).length} pending`, color: "var(--status-warning)" },
    { label: "Critical severity", value: critical.length, sub: "guaranteed-return / urgent language", color: "var(--status-critical)" },
  ];

  document.getElementById("stat-tiles").innerHTML = tiles
    .map(
      (t) => `
    <div class="card p-4">
      <div class="flex items-center gap-2 mb-2">
        <span class="w-2 h-2 rounded-full" style="background:${t.color}"></span>
        <p class="text-xs" style="color: var(--text-muted)">${t.label}</p>
      </div>
      <p class="stat-tile-value text-3xl font-semibold" style="color: var(--text-primary)" data-count-to="${t.value}">0</p>
      <p class="text-xs mt-1" style="color: var(--text-secondary)">${t.sub}</p>
    </div>`
    )
    .join("");

  animateCountUps();
}

// Counts each stat tile value up from 0 to its real total -- purely a visual
// entrance effect, the underlying numbers are the exact same real data.
function animateCountUps() {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll("[data-count-to]").forEach((el) => {
    const target = Number(el.getAttribute("data-count-to"));
    if (prefersReducedMotion || !target) {
      el.textContent = String(target);
      return;
    }
    const duration = 700;
    const start = performance.now();
    const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
    function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      el.textContent = String(Math.round(target * easeOutExpo(progress)));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

function renderRiskDistribution(joined) {
  const analyzed = joined.filter((r) => r.analysis && r.analysis.is_financial_content);
  const counts = RISK_LEVELS.reduce((acc, level) => {
    acc[level] = analyzed.filter((r) => r.analysis.risk_level === level).length;
    return acc;
  }, {});
  const max = Math.max(1, ...Object.values(counts));
  const colorVar = { LOW: "var(--status-good)", REVIEW: "var(--status-warning)", HIGH: "var(--status-serious)", CRITICAL: "var(--status-critical)" };

  const container = document.getElementById("risk-distribution");
  container.innerHTML = RISK_LEVELS.map((level) => {
    const count = counts[level];
    const pct = Math.round((count / max) * 100);
    return `
    <div class="risk-bar-row">
      <span class="text-sm" style="color: var(--text-secondary)">${RISK_META[level].label}</span>
      <div class="risk-bar-track">
        <div class="risk-bar-fill" style="--target:${pct}%; background:${colorVar[level]}"></div>
      </div>
      <span class="text-sm tabular text-right" style="color: var(--text-primary)">${count}</span>
    </div>`;
  }).join("");
}

function renderRecentFlags(flaggedRows) {
  const rows = flaggedRows.sort((a, b) => new Date(b.video.posted_at) - new Date(a.video.posted_at)).slice(0, 6);

  document.getElementById("recent-flags-body").innerHTML = rows
    .map(
      (row) => `
    <tr class="cursor-pointer" onclick="window.location.href='reel.html?id=${row.video.id}'">
      <td class="py-2.5 pr-3" style="color: var(--text-primary)">@${escapeHtml(row.influencer.username)}</td>
      <td class="py-2.5 pr-3" style="color: var(--text-secondary)">${escapeHtml(row.analysis.stock || "—")}</td>
      <td class="py-2.5 pr-3">${recommendationBadge(row.analysis.recommendation)}</td>
      <td class="py-2.5 pr-3">${riskBadge(row.analysis.risk_level)}</td>
      <td class="py-2.5 pr-3 tabular" style="color: var(--text-muted)">${formatDate(row.video.posted_at)}</td>
    </tr>`
    )
    .join("") || `<tr><td colspan="5" class="py-6 text-center" style="color: var(--text-muted)">No flagged content yet.</td></tr>`;
}

async function loadDashboard(isBackgroundRefresh = false) {
  if (!requireSupabaseConfigured()) return;

  const statTiles = document.getElementById("stat-tiles");
  if (!isBackgroundRefresh) statTiles.innerHTML = loadingHTML();

  try {
    const [influencers, joined] = await Promise.all([getInfluencers(), getJoinedReels()]);
    renderStatTiles(influencers, joined);
    renderRiskDistribution(joined);
    renderRecentFlags(joined.filter((r) => r.flag !== null));
    renderRiskByInfluencerChart(document.getElementById("risk-by-influencer-chart"), joined);
    renderReelsTimelineChart(document.getElementById("reels-timeline-chart"), joined);
  } catch (error) {
    if (!isBackgroundRefresh) {
      statTiles.innerHTML = "";
      document.querySelector("main").insertAdjacentHTML("afterbegin", errorHTML(error));
    }
    // A background refresh that fails (e.g. a dropped connection) just
    // leaves the last-good render on screen rather than blanking the page.
  }
}

loadDashboard();

// Live updates: the analysis pipeline (Phase 6/7) writes to `videos`,
// `analyses`, and `flags` in the background on its own schedule -- re-fetch
// and silently re-render whenever any of them change, instead of requiring
// a manual reload to see newly-analyzed reels.
subscribeToTableChanges(["videos", "analyses", "flags"], () => loadDashboard(true));
