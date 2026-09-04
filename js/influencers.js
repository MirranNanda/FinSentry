// Influencers page: search, status filter, sort, and card grid.
// Fetches once from Supabase on load, then filters/sorts client-side.

let allInfluencers = [];
let allJoinedReels = [];

function influencerStats(influencer) {
  const reels = allJoinedReels.filter((r) => r.influencer && r.influencer.id === influencer.id);
  const flagged = reels.filter((r) => r.flag !== null);
  const critical = flagged.filter((r) => r.analysis.risk_level === "CRITICAL").length;
  const analyzed = reels.filter((r) => r.analysis);
  const avgRisk = analyzed.length ? Math.round(analyzed.reduce((sum, r) => sum + r.analysis.risk_score, 0) / analyzed.length) : null;
  return { reelCount: reels.length, flagCount: flagged.length, critical, avgRisk };
}

function influencerCard(influencer) {
  const stats = influencerStats(influencer);
  const initial = influencer.username.charAt(0).toUpperCase();
  const gauge =
    stats.avgRisk === null
      ? `<div class="risk-gauge-placeholder" title="No analyzed reels yet">—</div>`
      : riskGaugeSVG(stats.avgRisk, { size: 48, strokeWidth: 5 });
  return `
  <a href="flagged.html?influencer=${influencer.id}" class="card p-4 flex flex-col gap-3 interactive">
    <div class="flex items-center gap-3">
      <div class="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold shrink-0" style="background: var(--series-blue)">${initial}</div>
      <div class="min-w-0 flex-1">
        <p class="font-semibold truncate" style="color: var(--text-primary)">@${escapeHtml(influencer.username)}</p>
        <p class="text-xs truncate" style="color: var(--text-secondary)">${escapeHtml(influencer.name)}</p>
      </div>
      <span class="badge ${influencer.active ? "badge-good" : "badge-neutral"} shrink-0">${influencer.active ? "Active" : "Inactive"}</span>
    </div>
    <div class="flex items-center gap-3 pt-2 border-t hairline">
      <div class="flex-1 grid grid-cols-3 gap-2 text-center">
        <div>
          <p class="tabular font-semibold text-sm" style="color: var(--text-primary)">${formatFollowers(influencer.followers)}</p>
          <p class="text-[11px]" style="color: var(--text-muted)">Followers</p>
        </div>
        <div>
          <p class="tabular font-semibold text-sm" style="color: var(--text-primary)">${stats.reelCount}</p>
          <p class="text-[11px]" style="color: var(--text-muted)">Reels</p>
        </div>
        <div>
          <p class="tabular font-semibold text-sm" style="color: ${stats.flagCount > 0 ? "var(--status-critical)" : "var(--text-primary)"}">${stats.flagCount}</p>
          <p class="text-[11px]" style="color: var(--text-muted)">Flagged</p>
        </div>
      </div>
      <div class="shrink-0" title="Average risk score across analyzed reels">${gauge}</div>
    </div>
  </a>`;
}

function applyInfluencerView() {
  const query = document.getElementById("search-input").value.trim().toLowerCase();
  const status = document.getElementById("status-filter").value;
  const sort = document.getElementById("sort-select").value;

  let list = allInfluencers.filter((i) => {
    const matchesQuery = !query || i.username.toLowerCase().includes(query) || i.name.toLowerCase().includes(query);
    const matchesStatus = status === "all" || (status === "active" ? i.active : !i.active);
    return matchesQuery && matchesStatus;
  });

  const withStats = list.map((i) => ({ influencer: i, stats: influencerStats(i) }));

  withStats.sort((a, b) => {
    if (sort === "followers-desc") return b.influencer.followers - a.influencer.followers;
    if (sort === "followers-asc") return a.influencer.followers - b.influencer.followers;
    if (sort === "name-asc") return a.influencer.name.localeCompare(b.influencer.name);
    if (sort === "flags-desc") return b.stats.flagCount - a.stats.flagCount;
    return 0;
  });

  const grid = document.getElementById("influencer-grid");
  const empty = document.getElementById("empty-state");

  if (withStats.length === 0) {
    grid.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  grid.innerHTML = withStats.map((w) => influencerCard(w.influencer)).join("");
}

async function loadInfluencers() {
  if (!requireSupabaseConfigured()) return;

  const grid = document.getElementById("influencer-grid");
  grid.innerHTML = loadingHTML();

  try {
    [allInfluencers, allJoinedReels] = await Promise.all([getInfluencers(), getJoinedReels()]);

    document.getElementById("search-input").addEventListener("input", debounce(applyInfluencerView, 120));
    document.getElementById("status-filter").addEventListener("change", applyInfluencerView);
    document.getElementById("sort-select").addEventListener("change", applyInfluencerView);

    applyInfluencerView();
  } catch (error) {
    grid.innerHTML = "";
    document.querySelector("main").insertAdjacentHTML("afterbegin", errorHTML(error));
  }
}

loadInfluencers();
