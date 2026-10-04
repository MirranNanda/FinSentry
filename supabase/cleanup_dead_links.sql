-- One-off cleanup: removes every video currently stuck on a dead/expired
-- Instagram link. These have no analyses row (analyze-video only writes one
-- on success), so deleting them is a clean no-op everywhere else in the
-- schema -- nothing cascades, nothing else references them.
--
-- Safe to re-run; matches by the exact error analyze-video writes when the
-- video_url download itself fails (as opposed to a Gemini-side error).

delete from videos
where status = 'failed'
  and status_error ilike '%Couldn''t download video%'
returning id, reel_url;
