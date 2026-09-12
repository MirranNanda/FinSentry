-- Activates the daily scraper schedule: once a day, scrape-reels checks
-- every active influencer and saves at most 5 new Reels (newest first),
-- entirely inside Supabase's own infrastructure via pg_cron -- this keeps
-- running whether or not VS Code, your laptop, or any Claude session is
-- open. Each new Reel still triggers analyze-video automatically (the
-- Phase 6 trigger), so this is the "add + analyze 5 a day, on its own"
-- pipeline end to end.
--
-- 5/day is deliberately conservative: it fits comfortably inside Gemini's
-- free-tier cap of 20 analyses/day, leaving headroom for the existing
-- retry job to also clear anything that fails the same day.
--
-- max_refresh: 3/day. Separately from max_new, scrape-reels also refreshes
-- up to this many already-seen Reels whose stored video_url has gone dead,
-- using the fresh link Apify just returned for the same still-published
-- Reel -- the only way a dead link ever gets fixed (retrying the same URL
-- never will). 5 new + 3 refreshed = 8/day, still comfortably under
-- Gemini's 20/day cap alongside the retry job.
--
-- Requires scrape-reels to be redeployed first (it now accepts max_new and
-- max_refresh).
--
-- To pause later:  select cron.unschedule('scrape-watchlist-daily');
-- To change the time: re-run this file with a different cron expression
-- (the schedule call below replaces the existing job of the same name).

select cron.unschedule('scrape-watchlist-daily')
where exists (select 1 from cron.job where jobname = 'scrape-watchlist-daily');

select cron.schedule(
  'scrape-watchlist-daily',
  '0 9 * * *',  -- 09:00 UTC daily
  $$
  select net.http_post(
    url := 'https://pkrhdcvjbrifbqjmxjyj.supabase.co/functions/v1/scrape-reels',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrcmhkY3ZqYnJpZmJxam14anlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NjMyMTgsImV4cCI6MjEwMjUzOTIxOH0.SM4AyFK37Un3gKj-toRFrvViVS-cUiQXaPY4wbSgqD8'
    ),
    body := jsonb_build_object('all', true, 'max_new', 5, 'max_refresh', 3)
  );
  $$
);
