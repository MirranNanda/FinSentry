// Flagged-content table: search, risk-level filter, reviewed filter, sort,
// plus an optional ?influencer=<id> pre-filter linked from the influencers page.
// Fetches once from Supabase on load, then filters/sorts client-side.

let activeInfluencerId = getQueryParam("influencer") ? Number(getQueryParam("influencer")) : null;
let allFlaggedReels = [];

async function renderInfluencerChip() {
  const chip = document.getElementById("influencer-filter-chip");
  if (!activeInfluencerId) {
    chip.classList.add("hidden");
    return;
  }
  const influencer = await getInfluencerById(activeInfluencerId);
  if (!influencer) {
    activeInfluencerId = null;
    chip.classList.add("hidden");
    return;
  }
  chip.classList.remove("hidden");
  chip.innerHTML = `
    <span class="badge badge-neutral">
      Filtered to @${escapeHtml(influencer.username)}
      <button id="clear-influencer-filter" class="ml-1 font-bold" aria-label="Clear filter">×</button>
    </span>`;
  document.getElementById("clear-influencer-filter").addEventListener("click", () => {
    activeInfluencerId = null;
    const url = new URL(window.location.href);
    url.searchParams.delete("influencer");
    window.history.replaceState({}, "", url);
    renderInfluencerChip();
    applyFlaggedView();
  });
}

function flaggedRow(row) {
  const { video, influencer, analysis, flag } = row;
  return `
  <tr>
    <td class="px-4 py-3" style="color: var(--text-primary)">@${escapeHtml(influencer.username)}</td>
    <td class="px-4 py-3" style="color: var(--text-secondary)">
      ${escapeHtml(analysis.stock || "—")}
      ${analysis.ticker ? `<span class="text-xs" style="color: var(--text-muted)"> · ${escapeHtml(analysis.ticker)}</span>` : ""}
    </td>
    <td class="px-4 py-3">${recommendationBadge(analysis.recommendation)}</td>
    <td class="px-4 py-3 tabular" style="color: var(--text-secondary)">${escapeHtml(analysis.price_target || "—")}</td>
    <td class="px-4 py-3 tabular font-semibold" style="color: var(--text-primary)">${analysis.risk_score}</td>
    <td class="px-4 py-3">${riskBadge(analysis.risk_level)}</td>
    <td class="px-4 py-3">${reviewedBadge(flag.reviewed)}</td>
    <td class="px-4 py-3 tabular" style="color: var(--text-muted)">${formatDate(video.posted_at)}</td>
    <td class="px-4 py-3 text-right">
      <a href="reel.html?id=${video.id}" class="text-sm nav-link font-medium">Review →</a>
    </td>
  </tr>`;
}

function applyFlaggedView() {
  const query = document.getElementById("search-input").value.trim().toLowerCase();
  const riskFilter = document.getElementById("risk-filter").value;
  const reviewedFilter = document.getElementById("reviewed-filter").value;
  const sort = document.getElementById("sort-select").value;

  let rows = allFlaggedReels.filter((row) => {
    if (activeInfluencerId && row.influencer.id !== activeInfluencerId) return false;
    if (riskFilter !== "all" && row.analysis.risk_level !== riskFilter) return false;
    if (reviewedFilter === "pending" && row.flag.reviewed) return false;
    if (reviewedFilter === "reviewed" && !row.flag.reviewed) return false;
    if (query) {
      const haystack = [row.influencer.username, row.influencer.name, row.analysis.stock, row.analysis.ticker]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  rows = rows.sort((a, b) => {
    if (sort === "score-desc") return b.analysis.risk_score - a.analysis.risk_score;
    if (sort === "score-asc") return a.analysis.risk_score - b.analysis.risk_score;
    if (sort === "date-desc") return new Date(b.video.posted_at) - new Date(a.video.posted_at);
    if (sort === "date-asc") return new Date(a.video.posted_at) - new Date(b.video.posted_at);
    return 0;
  });

  const tbody = document.getElementById("flagged-body");
  const empty = document.getElementById("empty-state");
  const count = document.getElementById("result-count");

  count.textContent = `${rows.length} flagged reel${rows.length === 1 ? "" : "s"}`;

  if (rows.length === 0) {
    tbody.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  tbody.innerHTML = rows.map(flaggedRow).join("");
}

async function loadFlagged() {
  if (!requireSupabaseConfigured()) return;

  const tbody = document.getElementById("flagged-body");
  tbody.innerHTML = `<tr><td colspan="9">${loadingHTML()}</td></tr>`;

  try {
    allFlaggedReels = await getFlaggedReels();

    document.getElementById("search-input").addEventListener("input", debounce(applyFlaggedView, 120));
    document.getElementById("risk-filter").addEventListener("change", applyFlaggedView);
    document.getElementById("reviewed-filter").addEventListener("change", applyFlaggedView);
    document.getElementById("sort-select").addEventListener("change", applyFlaggedView);

    await renderInfluencerChip();
    applyFlaggedView();
  } catch (error) {
    tbody.innerHTML = "";
    document.querySelector("main").insertAdjacentHTML("afterbegin", errorHTML(error));
  }
}

loadFlagged();
