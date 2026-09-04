// Reel review page: video preview, Gemini-style analysis panel, evidence,
// and a review action flow that now persists to Supabase (js/db.js).
// Phase 7: also reflects real processing status (pending/processing/failed)
// instead of assuming every video already has a finished analysis, and
// polls while a background analysis is still running.

let currentFlag = null;
let pollTimer = null;

function timestampToSeconds(ts) {
  if (!ts) return 0;
  const [m, s] = ts.split(":").map(Number);
  return m * 60 + s;
}

function wireVideoFallback() {
  const video = document.getElementById("reel-video");
  const fallback = document.getElementById("video-fallback");
  if (!video || !fallback) return;
  const showFallback = () => {
    video.style.display = "none";
    fallback.classList.remove("hidden");
  };
  if (!video.querySelector("source").getAttribute("src")) {
    showFallback();
    return;
  }
  video.addEventListener("error", showFallback);
  video.querySelector("source").addEventListener("error", showFallback);
}

function seekVideo(seconds) {
  const video = document.getElementById("reel-video");
  if (!video) return;
  try {
    video.currentTime = seconds;
    video.play().catch(() => {});
  } catch (e) {
    /* mock video_url may not be a playable source */
  }
}

function scoreBreakdownList(breakdown) {
  if (!breakdown || breakdown.length === 0) {
    return `<p class="text-sm" style="color: var(--text-muted)">No scoring factors triggered.</p>`;
  }
  return `<ul class="flex flex-col gap-1.5">${breakdown
    .map(
      (b) => `
    <li class="flex items-center justify-between text-sm">
      <span style="color: var(--text-secondary)">${escapeHtml(b.reason)}</span>
      <span class="tabular font-semibold" style="color: var(--text-primary)">+${b.points}</span>
    </li>`
    )
    .join("")}</ul>`;
}

function analysisStatusPanel(status, statusError) {
  if (status === "failed") {
    return `<div class="card p-5">
      <div class="flex items-center gap-2 mb-1">
        <span class="w-2 h-2 rounded-full" style="background: var(--status-critical)"></span>
        <p class="font-semibold" style="color: var(--text-primary)">Analysis failed</p>
      </div>
      <p class="text-sm mb-3" style="color: var(--text-secondary)">${escapeHtml(statusError || "Unknown error.")}</p>
      <button id="retry-analysis-btn" class="btn-secondary text-sm px-4 py-2">Retry analysis</button>
      <p id="retry-error" class="text-xs mt-2 hidden" style="color: var(--status-critical)"></p>
    </div>`;
  }
  return `<div class="card p-5">
    ${loadingHTML("Gemini is analyzing this reel — this can take up to a minute…")}
  </div>`;
}

function renderReelContent(reel) {
  const { video, influencer, analysis, flag } = reel;
  currentFlag = flag;
  clearTimeout(pollTimer);

  // Tolerate the Phase 7 columns not existing yet (before phase7_automation.sql runs).
  const status = video.status || (analysis ? "complete" : "pending");

  const colorVar = { LOW: "var(--status-good)", REVIEW: "var(--status-warning)", HIGH: "var(--status-serious)", CRITICAL: "var(--status-critical)" };
  const riskColor = analysis ? colorVar[analysis.risk_level] : "var(--text-muted)";

  document.getElementById("reel-content").innerHTML = `
  <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">

    <!-- Left: video + influencer info -->
    <section class="lg:col-span-2 flex flex-col gap-4">
      <div class="video-frame relative" style="aspect-ratio: 9/16">
        <video id="reel-video" class="w-full h-full object-cover" controls preload="metadata" poster="${escapeHtml(video.thumbnail_url)}">
          <source src="${escapeHtml(video.video_url || "")}" type="video/mp4" />
        </video>
        <div id="video-fallback" class="hidden absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-cover bg-center" style="background-image: url('${escapeHtml(video.thumbnail_url || "")}')">
          <div class="rounded-lg px-4 py-3" style="background: rgba(0,0,0,0.6)">
            <p class="text-sm font-medium text-white">Video preview unavailable</p>
            <p class="text-xs text-white/70 mt-1">Instagram's video links are short-lived and don't always embed elsewhere. See the evidence and timestamp below.</p>
          </div>
        </div>
      </div>
      <p class="text-xs text-center" style="color: var(--text-muted)">Video playback depends on Instagram's CDN link still being valid — evidence and analysis below don't.</p>

      <div class="card p-4 flex flex-col gap-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold shrink-0" style="background: var(--series-blue)">${influencer.username.charAt(0).toUpperCase()}</div>
          <div class="min-w-0">
            <p class="font-semibold truncate" style="color: var(--text-primary)">@${escapeHtml(influencer.username)}</p>
            <p class="text-xs truncate" style="color: var(--text-secondary)">${escapeHtml(influencer.name)} · ${formatFollowers(influencer.followers)} followers</p>
          </div>
        </div>
        <p class="text-sm" style="color: var(--text-secondary)">${escapeHtml(video.caption)}</p>
        <div class="flex items-center justify-between text-xs pt-2 border-t hairline" style="color: var(--text-muted)">
          <span>Posted ${formatDate(video.posted_at)} · ${timeAgo(video.posted_at)}</span>
          <a href="${escapeHtml(video.reel_url)}" target="_blank" rel="noopener noreferrer" class="nav-link">View on Instagram ↗</a>
        </div>
      </div>
    </section>

    <!-- Right: analysis -->
    <section class="lg:col-span-3 flex flex-col gap-4">

      ${
        status !== "complete"
          ? analysisStatusPanel(status, video.status_error)
          : !analysis || !analysis.is_financial_content
          ? `<div class="card p-5">
              <p class="font-semibold" style="color: var(--text-primary)">Not flagged as financial content</p>
              <p class="text-sm mt-1" style="color: var(--text-secondary)">Gemini did not detect a stock recommendation in this reel.</p>
            </div>`
          : `
      <div class="card p-5">
        <div class="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <p class="text-xs" style="color: var(--text-muted)">Stock identified</p>
            <p class="text-xl font-semibold" style="color: var(--text-primary)">${escapeHtml(analysis.stock || "—")} <span class="text-sm font-normal" style="color: var(--text-muted)">${analysis.ticker ? "· " + escapeHtml(analysis.ticker) : ""}</span></p>
          </div>
          <div class="flex items-center gap-2">
            ${recommendationBadge(analysis.recommendation)}
            ${riskBadge(analysis.risk_level)}
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div class="card p-3" style="background: var(--surface-2)">
            <p class="text-[11px]" style="color: var(--text-muted)">Price target</p>
            <p class="tabular font-semibold text-sm mt-0.5" style="color: var(--text-primary)">${escapeHtml(analysis.price_target || "None")}</p>
          </div>
          <div class="card p-3" style="background: var(--surface-2)">
            <p class="text-[11px]" style="color: var(--text-muted)">Future prediction</p>
            <p class="font-semibold text-sm mt-0.5" style="color: var(--text-primary)">${analysis.future_prediction ? "Yes" : "No"}</p>
          </div>
          <div class="card p-3" style="background: var(--surface-2)">
            <p class="text-[11px]" style="color: var(--text-muted)">Certainty</p>
            <p class="font-semibold text-sm mt-0.5" style="color: var(--text-primary)">${escapeHtml(analysis.certainty)}</p>
          </div>
          <div class="card p-3 flex items-center justify-between" style="background: var(--surface-2)">
            <span class="text-[11px]" style="color: var(--text-muted)">Risk score</span>
            ${riskGaugeSVG(analysis.risk_score, { size: 40, strokeWidth: 4 })}
          </div>
        </div>

        <div class="mb-5">
          <p class="text-sm font-semibold mb-2" style="color: var(--text-primary)">Why FinSentry flagged this</p>
          ${scoreBreakdownList(analysis.score_breakdown)}
        </div>

        <div class="rounded-lg p-4" style="background: var(--surface-2); border: 1px solid var(--border)">
          <p class="text-[11px] mb-1.5" style="color: var(--text-muted)">Evidence</p>
          <p class="text-sm italic" style="color: var(--text-primary)">"${escapeHtml(analysis.evidence)}"</p>
          ${
            analysis.timestamp
              ? `<button onclick="seekVideo(${timestampToSeconds(analysis.timestamp)})" class="mt-3 text-xs font-medium inline-flex items-center gap-1 nav-link">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                  Jump to ${escapeHtml(analysis.timestamp)}
                </button>`
              : ""
          }
        </div>
      </div>`
      }

      ${flag ? renderReviewPanel(flag) : ""}
    </section>
  </div>`;

  wireVideoFallback();
  if (flag) wireReviewActions();

  if (status === "failed") {
    document.getElementById("retry-analysis-btn").addEventListener("click", async (e) => {
      e.target.disabled = true;
      e.target.textContent = "Retrying…";
      const errorEl = document.getElementById("retry-error");
      try {
        await retryAnalysis(video.id);
        const refreshed = await getVideoWithDetails(video.id);
        renderReelContent(refreshed);
      } catch (error) {
        errorEl.textContent = `Retry failed: ${(error && error.message) || error}`;
        errorEl.classList.remove("hidden");
        e.target.disabled = false;
        e.target.textContent = "Retry analysis";
      }
    });
  } else if (status === "pending" || status === "processing") {
    pollTimer = setTimeout(async () => {
      try {
        const refreshed = await getVideoWithDetails(video.id);
        if (refreshed) renderReelContent(refreshed);
      } catch {
        /* keep the current view; next natural page load will pick it up */
      }
    }, 5000);
  }
}

function renderReviewPanel(flag) {
  return `
  <div class="card p-5" id="review-panel">
    <div class="flex items-center justify-between mb-3">
      <p class="font-semibold" style="color: var(--text-primary)">Human review</p>
      ${reviewedBadge(flag.reviewed)}
    </div>
    <p class="text-sm mb-3" style="color: var(--text-secondary)"><span class="font-medium" style="color: var(--text-primary)">Flag reason:</span> ${escapeHtml(flag.reason)}</p>
    <textarea id="review-notes" rows="3" placeholder="Add review notes…"
      class="w-full text-sm p-3 rounded-lg border hairline focus:outline-none mb-3"
      style="background: var(--surface-2); color: var(--text-primary)">${escapeHtml(flag.review_notes || "")}</textarea>
    <div class="flex items-center gap-2 flex-wrap">
      <button id="mark-reviewed" class="btn-primary btn-glow-good text-sm px-4 py-2">
        ${flag.reviewed ? "Mark as pending" : "Confirm reviewed"}
      </button>
      <button id="save-notes" class="btn-secondary text-sm px-4 py-2">Save notes</button>
      <p id="save-confirmation" class="text-xs hidden" style="color: var(--status-good)">Saved.</p>
      <p id="save-error" class="text-xs hidden" style="color: var(--status-critical)"></p>
    </div>
    <p class="text-xs mt-3" style="color: var(--text-muted)">FinSentry produces a review-priority score only — it does not determine SEBI rule violations.</p>
  </div>`;
}

function wireReviewActions() {
  const confirmEl = document.getElementById("save-confirmation");
  const errorEl = document.getElementById("save-error");
  const showConfirmation = () => {
    errorEl.classList.add("hidden");
    confirmEl.classList.remove("hidden");
    clearTimeout(showConfirmation._t);
    showConfirmation._t = setTimeout(() => confirmEl.classList.add("hidden"), 2000);
  };
  const showError = (error) => {
    confirmEl.classList.add("hidden");
    errorEl.textContent = `Couldn't save: ${(error && error.message) || error}`;
    errorEl.classList.remove("hidden");
  };

  document.getElementById("mark-reviewed").addEventListener("click", async (e) => {
    e.target.disabled = true;
    try {
      const updated = await updateFlag(currentFlag.id, { reviewed: !currentFlag.reviewed });
      currentFlag = updated;
      const id = Number(getQueryParam("id"));
      const reel = await getVideoWithDetails(id);
      renderReelContent(reel);
    } catch (error) {
      showError(error);
      e.target.disabled = false;
    }
  });

  document.getElementById("save-notes").addEventListener("click", async (e) => {
    e.target.disabled = true;
    try {
      const notes = document.getElementById("review-notes").value;
      currentFlag = await updateFlag(currentFlag.id, { review_notes: notes });
      showConfirmation();
    } catch (error) {
      showError(error);
    } finally {
      e.target.disabled = false;
    }
  });
}

async function loadReel() {
  if (!requireSupabaseConfigured()) return;

  const id = Number(getQueryParam("id"));
  const content = document.getElementById("reel-content");
  content.innerHTML = loadingHTML();

  try {
    const reel = await getVideoWithDetails(id);
    if (!reel) {
      content.innerHTML = "";
      document.getElementById("not-found").classList.remove("hidden");
      return;
    }
    renderReelContent(reel);
  } catch (error) {
    content.innerHTML = "";
    document.querySelector("main").insertAdjacentHTML("beforeend", errorHTML(error));
  }
}

loadReel();
