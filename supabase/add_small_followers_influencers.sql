-- Adds 2 more real, small-follower Indian stock-market accounts with a
-- content style (frequent specific picks/calls) that tends to score higher
-- on the Phase 4 rubric. Follower counts are rough placeholders from web
-- research, not live data.

insert into influencers (username, name, profile_url, followers, active) values
  ('stockpicks.in', 'Stock Picks', 'https://www.instagram.com/stockpicks.in/', 97000, true),
  ('india.ka.trader', 'Ashish Kumar', 'https://www.instagram.com/india.ka.trader/', 96000, true)
returning id, username;
