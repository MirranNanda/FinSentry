-- Replaces the fictional Phase 1 seed influencers with real accounts, and
-- cleans up leftover test rows from Phase 3/4/5/6/7 testing. Deleting an
-- influencer cascades to its videos -> analyses -> flags (see schema.sql),
-- so this wipes the current dashboard content; it repopulates once these
-- real accounts are actually scraped and analyzed.
--
-- Follower counts below are rough figures from web research at the time of
-- writing, not live data -- this field isn't kept in sync automatically, so
-- treat it as informational only.

delete from influencers where id in (1, 2, 3, 4, 5, 6, 7, 8, 9);
delete from videos where id in (121, 127, 128); -- redundant if cascade already caught them; harmless either way

insert into influencers (username, name, profile_url, followers, active) values
  ('financewithsharan', 'Sharan Hegde', 'https://www.instagram.com/financewithsharan/', 2900000, true),
  ('ankurwarikoo', 'Ankur Warikoo', 'https://www.instagram.com/ankurwarikoo/', 3700000, true),
  ('ca_rachanaranade', 'CA Rachana Ranade', 'https://www.instagram.com/ca_rachanaranade/', 1500000, true),
  ('pranjalkamra', 'Pranjal Kamra', 'https://www.instagram.com/pranjalkamra/', 900000, true),
  ('rajshamani', 'Raj Shamani', 'https://www.instagram.com/rajshamani/', 3000000, true),
  ('iamnehanagar', 'Neha Nagar', 'https://www.instagram.com/iamnehanagar/', 900000, true),
  ('nikhilkamathcio', 'Nikhil Kamath', 'https://www.instagram.com/nikhilkamathcio/', 1700000, true)
returning id, username;
