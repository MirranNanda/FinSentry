-- Adds 5 more real, active Instagram accounts focused on specific stock
-- calls / intraday tips / technical analysis -- content that naturally
-- scores higher on the Phase 4 rubric than general financial education,
-- since it more often includes explicit BUY/SELL calls and price targets.
-- Follower counts are rough placeholders from web research, not live data.

insert into influencers (username, name, profile_url, followers, active) values
  ('abhishekkarofficial', 'Abhishek Kar', 'https://www.instagram.com/abhishekkarofficial/', 4000000, true),
  ('theintradayexpert', 'The Intraday Expert', 'https://www.instagram.com/theintradayexpert/', 100000, true),
  ('banknifty_hero', 'Banknifty Hero', 'https://www.instagram.com/banknifty_hero/', 600000, true),
  ('intraday_trading_tips_01', 'Intraday Trading Tips', 'https://www.instagram.com/intraday_trading_tips_01/', 27000, true),
  ('everyday_intraday_tips', 'Everyday Intraday Tips', 'https://www.instagram.com/everyday_intraday_tips/', 50000, true)
returning id, username;
