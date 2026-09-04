// Shared formatting, badge, and search/filter/sort helpers used across pages.

const RISK_LEVELS = ["LOW", "REVIEW", "HIGH", "CRITICAL"];

const RISK_META = {
  LOW: { status: "good", icon: "check", label: "Low" },
  REVIEW: { status: "warning", icon: "dot", label: "Review" },
  HIGH: { status: "serious", icon: "triangle", label: "High" },
  CRITICAL: { status: "critical", icon: "octagon", label: "Critical" },
};

function riskLevelColorVar(level) {
  return { LOW: "var(--status-good)", REVIEW: "var(--status-warning)", HIGH: "var(--status-serious)", CRITICAL: "var(--status-critical)" }[level] || "var(--text-muted)";
}

const RISK_ICON_SVG = {
  check: '<path d="M4 8.5 6.5 11 12 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  dot: '<circle cx="8" cy="8" r="3.2" fill="currentColor"/>',
  triangle: '<path d="M8 4 13.5 12.5h-11z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><line x1="8" y1="7.2" x2="8" y2="9.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="8" cy="11" r="0.7" fill="currentColor"/>',
  octagon: '<path d="M5.2 3.5h5.6L14 6.7v5.6L10.8 15.5H5.2L2 12.3V6.7z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><line x1="8" y1="6" x2="8" y2="9.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="8" cy="11.4" r="0.7" fill="currentColor"/>',
};

// Returns an HTML string for a risk-level badge: colored dot + icon + neutral-ink text.
// Color never carries meaning alone -- icon + label always ship together.
function riskBadge(level) {
  const meta = RISK_META[level] || RISK_META.LOW;
  return `<span class="badge badge-${meta.status}">
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">${RISK_ICON_SVG[meta.icon]}</svg>
    ${meta.label}
  </span>`;
}

function recommendationBadge(rec) {
  if (!rec) return `<span class="badge badge-neutral">—</span>`;
  const cls = rec === "BUY" ? "badge-good-solid" : rec === "SELL" ? "badge-critical-solid" : "badge-neutral";
  return `<span class="badge ${cls}">${rec}</span>`;
}

function reviewedBadge(reviewed) {
  return reviewed
    ? `<span class="badge badge-neutral"><svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">${RISK_ICON_SVG.check}</svg>Reviewed</span>`
    : `<span class="badge badge-warning">Pending review</span>`;
}

function formatFollowers(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function timeAgo(iso) {
  if (!iso) return "—";
  const then = new Date(iso + "T00:00:00").getTime();
  const now = Date.now();
  const days = Math.floor((now - then) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function debounce(fn, delay = 150) {
  let handle;
  return (...args) => {
    clearTimeout(handle);
    handle = setTimeout(() => fn(...args), delay);
  };
}

function loadingHTML(label = "Loading…") {
  return `<div class="flex items-center justify-center gap-2 py-10 text-sm" style="color: var(--text-muted)">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 0.8s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
    ${label}
  </div>
  <style>@keyframes spin { to { transform: rotate(360deg); } }</style>`;
}

function errorHTML(error) {
  const message = (error && error.message) || String(error);
  return `<div class="text-sm p-4 rounded-lg" style="background: var(--status-critical-tint); color: var(--status-critical); border: 1px solid var(--status-critical)">
    Couldn't load data from Supabase: ${escapeHtml(message)}.
    <br/>Check that <code>js/config.js</code> has your project URL/anon key, and that <code>supabase/schema.sql</code> + <code>supabase/seed.sql</code> have been run in the SQL Editor.
  </div>`;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
