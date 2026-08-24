// Initializes the shared Supabase client. Depends on the Supabase UMD build
// (loaded via CDN in each HTML page, exposing window.supabase) and on
// js/config.js having been loaded first.

const supabaseConfigured = SUPABASE_URL && !SUPABASE_URL.includes("YOUR-PROJECT-REF");

const supabaseClient = supabaseConfigured
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

function requireSupabaseConfigured() {
  if (supabaseClient) return true;
  const banner = document.createElement("div");
  banner.className = "fixed top-16 left-0 right-0 z-20 text-center text-sm py-2";
  banner.style.background = "var(--status-critical)";
  banner.style.color = "#fff";
  banner.textContent = "Supabase isn't configured yet — fill in js/config.js with your project URL and anon key (see README).";
  document.body.prepend(banner);
  return false;
}
