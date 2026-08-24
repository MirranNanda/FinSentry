-- FinSentry Phase 6 — connect the scraper to Gemini analysis.
--
-- This is the missing link in the pipeline: every other piece (scraper ->
-- Supabase, Gemini -> Supabase, risk scoring -> Supabase, dashboard reading
-- Supabase) already exists from Phases 2-5. What's missing is the "New Reel
-- -> Gemini" arrow in the architecture diagram -- so far that only happened
-- when a human called the analyze-video function manually.
--
-- A Postgres trigger fixes that: the moment a new row lands in `videos`
-- (whether from scrape-reels, a manual insert, anything), it calls the
-- analyze-video Edge Function via pg_net (Supabase's built-in async HTTP
-- extension -- the same mechanism behind their "Database Webhooks" feature).
-- pg_net queues the HTTP call and returns immediately, so inserting a video
-- is never slowed down waiting on Gemini.
--
-- Run this once in the SQL Editor, after analyze-video is deployed.

create extension if not exists pg_net;

create or replace function public.trigger_analyze_video()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://pkrhdcvjbrifbqjmxjyj.supabase.co/functions/v1/analyze-video',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrcmhkY3ZqYnJpZmJxam14anlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NjMyMTgsImV4cCI6MjEwMjUzOTIxOH0.SM4AyFK37Un3gKj-toRFrvViVS-cUiQXaPY4wbSgqD8'
    ),
    body := jsonb_build_object('video_id', new.id)
  );
  return new;
end;
$$;

drop trigger if exists on_video_inserted on videos;

create trigger on_video_inserted
after insert on videos
for each row
execute function public.trigger_analyze_video();

-- To check what these background calls actually did (status code, response
-- body, errors), pg_net logs every request/response here:
--   select * from net._http_response order by created desc limit 20;
