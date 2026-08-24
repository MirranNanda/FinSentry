-- FinSentry Phase 7 — automation: processing status, error handling, retries,
-- and scheduled runs.
--
-- Safe to run now: adds status tracking to `videos` and activates a retry
-- job for stuck/failed analyses (it only re-processes videos already in your
-- database -- it never scrapes new Instagram content, so it costs nothing
-- until something actually fails).
--
-- NOT run automatically: the scraper's own schedule, at the bottom of this
-- file, commented out. Your watchlist still has Phase 1's fictional seed
-- usernames -- activate that block once `influencers.profile_url` points at
-- real accounts you actually want monitored.

-- ---- Processing status on videos ----------------------------------------

alter table videos add column if not exists status text not null default 'pending'
  check (status in ('pending', 'processing', 'complete', 'failed'));
alter table videos add column if not exists status_error text;
alter table videos add column if not exists retry_count integer not null default 0;

-- Backfill: anything that already has an analysis is done; leave the rest 'pending'.
update videos set status = 'complete'
where status = 'pending' and id in (select video_id from analyses);

-- ---- Retry job for stuck/failed analyses ---------------------------------
-- Runs every 15 minutes. Picks up:
--   - status = 'failed'   (analyze-video ran and errored)
--   - status = 'pending'/'processing' for over 10 minutes (the trigger's
--     fire-and-forget call never landed, or the function never finished)
-- Caps at 3 attempts per video (retry_count) so a permanently-broken video
-- (e.g. a dead video_url) doesn't retry forever, and processes at most 20
-- per run so one run can't monopolize Gemini/Apify quota.

create extension if not exists pg_cron;

create or replace function public.retry_stuck_analyses()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
begin
  for v in
    select id from videos
    where retry_count < 3
      and (
        status = 'failed'
        or (status in ('pending', 'processing') and created_at < now() - interval '10 minutes')
      )
    order by created_at
    limit 20
  loop
    update videos set retry_count = retry_count + 1 where id = v.id;
    perform net.http_post(
      url := 'https://pkrhdcvjbrifbqjmxjyj.supabase.co/functions/v1/analyze-video',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrcmhkY3ZqYnJpZmJxam14anlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NjMyMTgsImV4cCI6MjEwMjUzOTIxOH0.SM4AyFK37Un3gKj-toRFrvViVS-cUiQXaPY4wbSgqD8'
      ),
      body := jsonb_build_object('video_id', v.id)
    );
  end loop;
end;
$$;

select cron.unschedule('retry-stuck-analyses') where exists (select 1 from cron.job where jobname = 'retry-stuck-analyses');
select cron.schedule('retry-stuck-analyses', '*/15 * * * *', $$select public.retry_stuck_analyses();$$);

-- ---- Scheduled scraper runs (INACTIVE -- read the note above) -----------
-- Every line below is commented out on purpose (a /* */ block comment
-- doesn't work here -- the '*/' inside the cron expression '0 */6 * * *'
-- would prematurely close it). To activate once your watchlist has real
-- Instagram accounts: select this whole block, remove the leading "-- " from
-- each line, paste into a new query, and run it. Adjust '0 */6 * * *'
-- (every 6 hours) to taste.
--
-- To pause it again later: select cron.unschedule('scrape-watchlist');
--
-- select cron.schedule(
--   'scrape-watchlist',
--   '0 */6 * * *',
--   $$
--   select net.http_post(
--     url := 'https://pkrhdcvjbrifbqjmxjyj.supabase.co/functions/v1/scrape-reels',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrcmhkY3ZqYnJpZmJxam14anlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NjMyMTgsImV4cCI6MjEwMjUzOTIxOH0.SM4AyFK37Un3gKj-toRFrvViVS-cUiQXaPY4wbSgqD8'
--     ),
--     body := jsonb_build_object('all', true)
--   );
--   $$
-- );
