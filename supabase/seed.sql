-- FinSentry Phase 2 seed data.
-- Run AFTER schema.sql, in the Supabase SQL Editor. This is the same dataset
-- that powered the Phase 1 mock-data dashboard (js/mockData.js), now living
-- in the real tables -- so the UI should look identical once db.js points at
-- Supabase instead of the mock arrays.

insert into influencers (id, username, name, profile_url, followers, active, created_at) values
  (1, 'stockguru_raj',     'Raj Malhotra',   'https://instagram.com/stockguru_raj',     245000, true,  '2025-11-02'),
  (2, 'wealthwithanjali',  'Anjali Sharma',  'https://instagram.com/wealthwithanjali',   89000, true,  '2025-11-04'),
  (3, 'themarketwolf',     'Vikram Singh',   'https://instagram.com/themarketwolf',     512000, true,  '2025-10-21'),
  (4, 'niftyqueen',        'Priya Kapoor',   'https://instagram.com/niftyqueen',        156000, true,  '2025-11-10'),
  (5, 'dalalstreetdesi',   'Arjun Mehta',    'https://instagram.com/dalalstreetdesi',   340000, true,  '2025-09-30'),
  (6, 'tradingwithtina',   'Tina D''Souza',  'https://instagram.com/tradingwithtina',    67000, false, '2025-08-15'),
  (7, 'bullishbhai',       'Karan Patel',    'https://instagram.com/bullishbhai',       198000, true,  '2025-10-05'),
  (8, 'moneymindset_in',   'Sneha Reddy',    'https://instagram.com/moneymindset_in',    45000, true,  '2025-12-01');

insert into videos (id, influencer_id, reel_url, video_url, thumbnail_url, caption, posted_at, created_at) values
  (101, 1, 'https://instagram.com/reel/rj101', 'https://example.com/video/101.mp4', 'https://picsum.photos/seed/101/400/500', E'3 stocks I''d buy before results season \U0001F680', '2026-08-10', '2026-08-10'),
  (102, 1, 'https://instagram.com/reel/rj102', 'https://example.com/video/102.mp4', 'https://picsum.photos/seed/102/400/500', 'Why I''m holding my Nifty portfolio this week', '2026-08-05', '2026-08-05'),
  (103, 2, 'https://instagram.com/reel/rj103', 'https://example.com/video/103.mp4', 'https://picsum.photos/seed/103/400/500', E'This smallcap could 3x by Diwali \U0001F525', '2026-08-12', '2026-08-12'),
  (104, 2, 'https://instagram.com/reel/rj104', 'https://example.com/video/104.mp4', 'https://picsum.photos/seed/104/400/500', '5 things to check before you invest', '2026-07-28', '2026-07-28'),
  (105, 3, 'https://instagram.com/reel/rj105', 'https://example.com/video/105.mp4', 'https://picsum.photos/seed/105/400/500', 'SELL this stock NOW before it crashes further', '2026-08-13', '2026-08-13'),
  (106, 3, 'https://instagram.com/reel/rj106', 'https://example.com/video/106.mp4', 'https://picsum.photos/seed/106/400/500', 'Target ₹4000 guaranteed, don''t miss this one', '2026-08-08', '2026-08-08'),
  (107, 3, 'https://instagram.com/reel/rj107', 'https://example.com/video/107.mp4', 'https://picsum.photos/seed/107/400/500', 'Market wrap: what moved today', '2026-07-30', '2026-07-30'),
  (108, 4, 'https://instagram.com/reel/rj108', 'https://example.com/video/108.mp4', 'https://picsum.photos/seed/108/400/500', 'Buy before results, price target inside', '2026-08-11', '2026-08-11'),
  (109, 4, 'https://instagram.com/reel/rj109', 'https://example.com/video/109.mp4', 'https://picsum.photos/seed/109/400/500', 'My honest review of index funds', '2026-07-25', '2026-07-25'),
  (110, 5, 'https://instagram.com/reel/rj110', 'https://example.com/video/110.mp4', 'https://picsum.photos/seed/110/400/500', 'This will 100% double by next quarter, trust me', '2026-08-14', '2026-08-14'),
  (111, 5, 'https://instagram.com/reel/rj111', 'https://example.com/video/111.mp4', 'https://picsum.photos/seed/111/400/500', 'Sector rotation explained simply', '2026-08-02', '2026-08-02'),
  (112, 5, 'https://instagram.com/reel/rj112', 'https://example.com/video/112.mp4', 'https://picsum.photos/seed/112/400/500', 'BUY BUY BUY before Monday opening bell', '2026-07-20', '2026-07-20'),
  (113, 6, 'https://instagram.com/reel/rj113', 'https://example.com/video/113.mp4', 'https://picsum.photos/seed/113/400/500', 'Old reel: my 2025 portfolio review', '2026-06-18', '2026-06-18'),
  (114, 7, 'https://instagram.com/reel/rj114', 'https://example.com/video/114.mp4', 'https://picsum.photos/seed/114/400/500', 'Guaranteed multibagger for 2027, target ₹950', '2026-08-13', '2026-08-13'),
  (115, 7, 'https://instagram.com/reel/rj115', 'https://example.com/video/115.mp4', 'https://picsum.photos/seed/115/400/500', 'How I read a balance sheet', '2026-07-29', '2026-07-29'),
  (116, 8, 'https://instagram.com/reel/rj116', 'https://example.com/video/116.mp4', 'https://picsum.photos/seed/116/400/500', 'Budgeting tips for beginners', '2026-08-09', '2026-08-09'),
  (117, 8, 'https://instagram.com/reel/rj117', 'https://example.com/video/117.mp4', 'https://picsum.photos/seed/117/400/500', 'Accumulate this PSU stock, target ₹210 by March', '2026-07-22', '2026-07-22'),
  (118, 1, 'https://instagram.com/reel/rj118', 'https://example.com/video/118.mp4', 'https://picsum.photos/seed/118/400/500', 'Exit this stock immediately, red flags everywhere', '2026-08-14', '2026-08-14'),
  (119, 4, 'https://instagram.com/reel/rj119', 'https://example.com/video/119.mp4', 'https://picsum.photos/seed/119/400/500', 'Why diversification matters', '2026-07-15', '2026-07-15'),
  (120, 2, 'https://instagram.com/reel/rj120', 'https://example.com/video/120.mp4', 'https://picsum.photos/seed/120/400/500', 'This will double, mark my words', '2026-08-15', '2026-08-15');

insert into analyses (id, video_id, is_financial_content, stock, ticker, recommendation, price_target, future_prediction, certainty, risk_score, risk_level, evidence, "timestamp", score_breakdown, created_at) values
  (1001, 101, true,  'Tata Motors',        'TATAMOTORS', 'BUY',  '₹1000', true,  'HIGH',   65, 'HIGH',     'Buy Tata Motors before the results, I''m expecting a big jump.', '00:32',
    '[{"reason":"BUY/SELL recommendation","points":25},{"reason":"Price target given","points":15},{"reason":"Future prediction","points":15},{"reason":"High certainty language","points":10}]', '2026-08-10'),
  (1002, 102, true,  null,                 null,         'HOLD', null,    false, 'LOW',     10, 'LOW',      'I''m just holding my current positions, nothing new to add.', '00:12', '[]', '2026-08-05'),
  (1003, 103, true,  'Suzlon Energy',      'SUZLON',     'BUY',  null,    true,  'HIGH',    50, 'REVIEW',   'This smallcap could triple by Diwali, huge potential here.', '00:18',
    '[{"reason":"BUY/SELL recommendation","points":25},{"reason":"Future prediction","points":15},{"reason":"High certainty language","points":10}]', '2026-08-12'),
  (1004, 104, true,  null,                 null,         'HOLD', null,    false, 'LOW',      5, 'LOW',      'Generic investing education, no specific stock mentioned.', '00:05', '[]', '2026-07-28'),
  (1005, 105, true,  'Vodafone Idea',      'IDEA',       'SELL', null,    true,  'HIGH',    60, 'REVIEW',   'Sell this stock NOW before it crashes even further, trust me.', '00:09',
    '[{"reason":"BUY/SELL recommendation","points":25},{"reason":"Future prediction","points":15},{"reason":"High certainty / urgent language","points":20}]', '2026-08-13'),
  (1006, 106, true,  'Adani Enterprises',  'ADANIENT',   'BUY',  '₹4000', true,  'HIGH',    85, 'CRITICAL', 'Target ₹4000 guaranteed, this is a sure-shot multibagger, don''t miss it.', '00:41',
    '[{"reason":"BUY/SELL recommendation","points":25},{"reason":"Price target given","points":15},{"reason":"Future prediction","points":15},{"reason":"High certainty language","points":10},{"reason":"Urgent / guaranteed-return language","points":20}]', '2026-08-08'),
  (1007, 107, false, null,                 null,         null,   null,    false, 'LOW',      0, 'LOW',      'General market recap, no recommendation made.', null, '[]', '2026-07-30'),
  (1008, 108, true,  'Reliance Industries','RELIANCE',   'BUY',  '₹3200', true,  'MEDIUM',  55, 'REVIEW',   'Buy before results, I see this touching ₹3200 soon.', '00:27',
    '[{"reason":"BUY/SELL recommendation","points":25},{"reason":"Price target given","points":15},{"reason":"Future prediction","points":15}]', '2026-08-11'),
  (1009, 109, true,  null,                 null,         'HOLD', null,    false, 'LOW',      8, 'LOW',      'Educational content about index funds, no stock picks.', '00:15', '[]', '2026-07-25'),
  (1010, 110, true,  'Paytm',              'PAYTM',      'BUY',  null,    true,  'HIGH',    75, 'HIGH',     'This will 100% double by next quarter, trust me on this one.', '00:22',
    '[{"reason":"BUY/SELL recommendation","points":25},{"reason":"Future prediction","points":15},{"reason":"High certainty language","points":10},{"reason":"Urgent / guaranteed-return language","points":25}]', '2026-08-14'),
  (1011, 111, true,  null,                 null,         null,   null,    false, 'LOW',      0, 'LOW',      'Educational content on sector rotation.', null, '[]', '2026-08-02'),
  (1012, 112, true,  'Yes Bank',           'YESBANK',    'BUY',  '₹35',   true,  'HIGH',    90, 'CRITICAL', 'BUY BUY BUY before Monday opening bell, target ₹35 confirmed, don''t wait.', '00:08',
    '[{"reason":"BUY/SELL recommendation","points":25},{"reason":"Price target given","points":15},{"reason":"Future prediction","points":15},{"reason":"High certainty language","points":10},{"reason":"Urgent / guaranteed-return language","points":25}]', '2026-07-20'),
  (1013, 113, true,  null,                 null,         'HOLD', null,    false, 'LOW',     12, 'LOW',      'Portfolio review, mostly reflective commentary.', '00:19', '[]', '2026-06-18'),
  (1014, 114, true,  'Tata Power',         'TATAPOWER',  'BUY',  '₹950',  true,  'HIGH',    88, 'CRITICAL', 'Guaranteed multibagger for 2027, target ₹950 locked in, don''t miss out.', '00:36',
    '[{"reason":"BUY/SELL recommendation","points":25},{"reason":"Price target given","points":15},{"reason":"Future prediction","points":15},{"reason":"High certainty language","points":10},{"reason":"Urgent / guaranteed-return language","points":23}]', '2026-08-13'),
  (1015, 115, true,  null,                 null,         null,   null,    false, 'LOW',      0, 'LOW',      'Educational content on reading balance sheets.', null, '[]', '2026-07-29'),
  (1016, 116, false, null,                 null,         null,   null,    false, 'LOW',      0, 'LOW',      'Personal finance / budgeting tips, no stock content.', null, '[]', '2026-08-09'),
  (1017, 117, true,  'IRFC',               'IRFC',       'BUY',  '₹210',  true,  'MEDIUM',  55, 'REVIEW',   'Accumulate this PSU stock, I expect ₹210 by March.', '00:24',
    '[{"reason":"BUY/SELL recommendation","points":25},{"reason":"Price target given","points":15},{"reason":"Future prediction","points":15}]', '2026-07-22'),
  (1018, 118, true,  'Zomato',             'ZOMATO',     'SELL', null,    true,  'HIGH',    62, 'HIGH',     'Exit this stock immediately, red flags everywhere, get out now.', '00:14',
    '[{"reason":"BUY/SELL recommendation","points":25},{"reason":"Future prediction","points":15},{"reason":"High certainty / urgent language","points":22}]', '2026-08-14'),
  (1019, 119, true,  null,                 null,         null,   null,    false, 'LOW',      0, 'LOW',      'General diversification advice, no specific stock.', null, '[]', '2026-07-15'),
  (1020, 120, true,  'Infosys',            'INFY',       'BUY',  null,    true,  'HIGH',    65, 'HIGH',     'This will double, mark my words, get in before everyone else does.', '00:11',
    '[{"reason":"BUY/SELL recommendation","points":25},{"reason":"Future prediction","points":15},{"reason":"High certainty language","points":10},{"reason":"Urgent language","points":15}]', '2026-08-15');

insert into flags (id, analysis_id, severity, reason, reviewed, review_notes, created_at) values
  (1,  1001, 'HIGH',     'BUY call with price target and high certainty ahead of results.', false, null, '2026-08-10'),
  (2,  1003, 'REVIEW',   'Future prediction on a smallcap without disclosed holding info.', false, null, '2026-08-12'),
  (3,  1005, 'REVIEW',   'Urgent SELL language, potential panic-inducing content.', true, 'Reviewed — commentary is opinion-based, monitoring for repeat pattern.', '2026-08-13'),
  (4,  1006, 'CRITICAL', 'Guaranteed-return language with explicit price target.', false, null, '2026-08-08'),
  (5,  1008, 'REVIEW',   'BUY call with price target ahead of results.', true, 'Low follower reach, deprioritized.', '2026-08-11'),
  (6,  1010, 'HIGH',     'Guaranteed-return language (''100% double'') with urgency.', false, null, '2026-08-14'),
  (7,  1012, 'CRITICAL', 'Explicit price target with guaranteed-return and urgency language.', false, null, '2026-07-20'),
  (8,  1014, 'CRITICAL', 'Guaranteed multibagger claim with explicit long-term price target.', false, null, '2026-08-13'),
  (9,  1017, 'REVIEW',   'BUY call with specific price target and timeline.', true, 'Confirmed as promotional content, escalated to compliance.', '2026-07-22'),
  (10, 1018, 'HIGH',     'Urgent SELL language (''exit immediately'').', false, null, '2026-08-14'),
  (11, 1020, 'HIGH',     'Future prediction with urgent buy-now language.', false, null, '2026-08-15');

-- Bump the identity sequences past the explicit IDs above so future inserts
-- (from the app, the scraper, Gemini, etc.) don't collide with seed rows.
select setval(pg_get_serial_sequence('influencers', 'id'), (select max(id) from influencers));
select setval(pg_get_serial_sequence('videos', 'id'), (select max(id) from videos));
select setval(pg_get_serial_sequence('analyses', 'id'), (select max(id) from analyses));
select setval(pg_get_serial_sequence('flags', 'id'), (select max(id) from flags));
