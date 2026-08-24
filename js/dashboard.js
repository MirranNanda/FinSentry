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
      <p class="stat-tile-value text-3xl font-semibold" style="color: var(--text-primary)">${t.value}</p>
      <p class="text-xs mt-1" style="color: var(--text-secondary)">${t.sub}</p>
    </div>`
    )
    .join("");
}

function renderRiskDistribution(joined) {
  const analyzed = joined.filter((r) => r.analysis && r.analysis.is_financial_content);
  const counts = RISK_LEVELS.reduce((acc, level) => {
    acc[level] = analyzed.filter((r) => r.analysis.risk_level === level).length;
    return acc;
  }, {});
  const max = Math.max(1, ...Object.values(counts));
  const colorVar = { LOW: "var(--status-good)", REVIEW: "var(--status-warning)", HIGH: "var(--status-serious)", CRITICAL: "var(--status-critical)" };

  document.getElementById("risk-distribution").innerHTML = RISK_LEVELS.map((level) => {
    const count = counts[level];
    const pct = Math.round((count / max) * 100);
    return `
    <div class="risk-bar-row">
      <span class="text-sm" style="color: var(--text-secondary)">${RISK_META[level].label}</span>
      <div class="risk-bar-track">
        <div class="risk-bar-fill" style="width:${pct}%; background:${colorVar[level]}"></div>
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

async function loadDashboard() {
  if (!requireSupabaseConfigured()) return;

  const statTiles = document.getElementById("stat-tiles");
  statTiles.innerHTML = loadingHTML();

  try {
    const [influencers, joined] = await Promise.all([getInfluencers(), getJoinedReels()]);
    renderStatTiles(influencers, joined);
    renderRiskDistribution(joined);
    renderRecentFlags(joined.filter((r) => r.flag !== null));
  } catch (error) {
    statTiles.innerHTML = "";
    document.querySelector("main").insertAdjacentHTML("afterbegin", errorHTML(error));
  }
}

loadDashboard();
