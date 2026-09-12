-- Swaps out 2 watchlist influencers whose accounts Apify returns zero Reels
-- for (likely private, deleted, or simply inactive -- confirmed via repeat
-- ad-hoc scrape-reels checks, not a one-off Apify hiccup) for 2 other real,
-- small-follower Indian stock-market accounts that are still actively
-- posting.
--
-- Deactivates rather than deletes the old two: they already have videos/
-- analyses on file (ids 204-208), and `active = false` just excludes them
-- from future `all: true` scrape runs without touching that history.

update influencers set active = false
where username in ('intraday_trading_tips_01', 'everyday_intraday_tips');

insert into influencers (username, name, profile_url, followers, active) values
  ('sharemarketmentor', 'Share Market Mentor', 'https://www.instagram.com/sharemarketmentor/', 90000, true),
  ('traderdost', 'Vishal Kumar', 'https://www.instagram.com/traderdost/', 141000, true)
returning id, username;
