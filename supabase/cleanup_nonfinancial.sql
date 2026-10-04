-- One-off cleanup: removes every video already analyzed as NOT financial
-- content, now that analyze-video discards these automatically going
-- forward (see the Phase 7.2 comment in
-- supabase/functions/analyze-video/index.ts). None of these have a flag
-- (LOW-risk content never gets one), so deleting the video just cascades
-- to its one analyses row -- nothing else is affected.
--
-- Safe to re-run.

delete from videos
where id in (select video_id from analyses where is_financial_content = false)
returning id, reel_url;
