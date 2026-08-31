-- Adds 8 more real finance influencers to reach 15 total (on top of the 7
-- from replace_influencers.sql). Same caveat as before: follower counts are
-- rough placeholders from web research, not live data.

insert into influencers (username, name, profile_url, followers, active) values
  ('shreyaakapoor_', 'Shreya Kapoor', 'https://www.instagram.com/shreyaakapoor_/', 500000, true),
  ('anushkarathod98', 'Anushka Rathod', 'https://www.instagram.com/anushkarathod98/', 300000, true),
  ('akshat.world', 'Akshat Shrivastava', 'https://www.instagram.com/akshat.world/', 1000000, true),
  ('financebyanmoll', 'Anmol Sharma', 'https://www.instagram.com/financebyanmoll/', 200000, true),
  ('msbvision', 'Mehar Sindhu Batra', 'https://www.instagram.com/msbvision/', 200000, true),
  ('dhruvtuli10', 'Dhruv Tuli', 'https://www.instagram.com/dhruvtuli10/', 200000, true),
  ('hardikbhatia.in', 'Hardik Bhatia', 'https://www.instagram.com/hardikbhatia.in/', 200000, true),
  ('ji_nitinjoshi', 'Nitin Joshi', 'https://www.instagram.com/ji_nitinjoshi/', 200000, true)
returning id, username;
