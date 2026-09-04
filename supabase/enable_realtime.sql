-- Enables Supabase Realtime on the tables the dashboard and flagged-content
-- pages now subscribe to (js/db.js: subscribeToTableChanges), so those
-- pages silently re-fetch and re-render as the background analysis
-- pipeline (Phase 6/7) writes new data, instead of requiring a manual
-- reload.

alter publication supabase_realtime add table videos;
alter publication supabase_realtime add table analyses;
alter publication supabase_realtime add table flags;
