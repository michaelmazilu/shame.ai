-- Replace placeholder deed_templates with all 16 punishments.
-- Weights: DM rituals = 5 each (50 total), action rituals scaled from server weights (50 total).

delete from public.deed_templates where id in (
  'a0000001-0000-4000-8000-000000000001',
  'a0000001-0000-4000-8000-000000000002',
  'a0000001-0000-4000-8000-000000000003'
);

insert into public.deed_templates (id, deed_type, params, weight) values
  -- DM Rituals (10)
  ('b0000001-0000-4000-8000-000000000001', 'love_declaration', '{"name":"Love Declaration","emoji":"💌","description":"Cringe love confession to a complete stranger","category":"dm","prompt":"Write an extremely over-the-top, painfully earnest love confession DM to a stranger. Like someone who is deeply in love after seeing one profile photo. Be dramatic, poetic, and embarrassingly sincere. 2-3 sentences max."}'::jsonb, 5),
  ('b0000001-0000-4000-8000-000000000002', 'fan_account', '{"name":"Superfan","emoji":"🤩","description":"Pretend you are their #1 fan who knows everything about them","category":"dm","prompt":"Write a DM as if you are someones deranged superfan. Reference imaginary things like your Tuesday posts or that thing you said in your story last week changed my life. Be uncomfortably enthusiastic. 2-3 sentences max."}'::jsonb, 5),
  ('b0000001-0000-4000-8000-000000000003', 'wrong_number', '{"name":"Wrong Number","emoji":"📱","description":"Send something clearly meant for someone else","category":"dm","prompt":"Write a DM that is obviously meant for a different person. Something deeply personal or bizarre that would be mortifying if sent to the wrong person. 2-3 sentences max."}'::jsonb, 5),
  ('b0000001-0000-4000-8000-000000000004', 'time_traveler', '{"name":"Time Traveler","emoji":"⏰","description":"Claim you are from the future with an urgent warning","category":"dm","prompt":"Write a DM as a time traveler from the year 2087 with an urgent, cryptic, and ridiculous warning for this person. Be vague enough to be creepy but specific enough to be funny. Dead serious tone. 2-3 sentences max."}'::jsonb, 5),
  ('b0000001-0000-4000-8000-000000000005', 'job_interview', '{"name":"HR Department","emoji":"💼","description":"Treat the DM like a formal corporate communication","category":"dm","prompt":"Write a DM in the style of a formal HR email or corporate memo. Reference the incident, your quarterly review, or the dress code violation. Use corporate jargon. Dead serious. 2-3 sentences max."}'::jsonb, 5),
  ('b0000001-0000-4000-8000-000000000006', 'conspiracy', '{"name":"Conspiracy Drop","emoji":"🔺","description":"Share a wild conspiracy theory as if they are the key","category":"dm","prompt":"Write a DM revealing a completely absurd conspiracy theory and implying this person is somehow connected to it. Be paranoid, urgent, and reference fake evidence. 2-3 sentences max."}'::jsonb, 5),
  ('b0000001-0000-4000-8000-000000000007', 'breakup', '{"name":"The Breakup","emoji":"💔","description":"Send a dramatic breakup text to someone you do not know","category":"dm","prompt":"Write a dramatic breakup DM to a complete stranger as if you had a long relationship. Reference shared memories that never happened. Be emotional, hurt, and theatrical. 2-3 sentences max."}'::jsonb, 5),
  ('b0000001-0000-4000-8000-000000000008', 'life_advice', '{"name":"Unsolicited Wisdom","emoji":"🧘","description":"Drop bizarre life advice completely unprompted","category":"dm","prompt":"Write a DM giving extremely specific, bizarre, and completely unsolicited life advice. The advice should be oddly specific and make no sense. 2-3 sentences max."}'::jsonb, 5),
  ('b0000001-0000-4000-8000-000000000009', 'roommate', '{"name":"Bad Roommate","emoji":"🏠","description":"Passive-aggressive note from a roommate they do not have","category":"dm","prompt":"Write a passive-aggressive roommate note as a DM. Complain about something specific and petty like your dishes, the thermostat, or what you did to the bathroom. 2-3 sentences max."}'::jsonb, 5),
  ('b0000001-0000-4000-8000-00000000000a', 'prophet', '{"name":"The Prophet","emoji":"🔮","description":"Deliver a mysterious prophecy about their future","category":"dm","prompt":"Write a DM delivering a deeply mysterious and oddly specific prophecy about this persons near future. Mix mundane details with dramatic cosmic language. 2-3 sentences max."}'::jsonb, 5),
  -- Action Rituals (6)
  ('b0000002-0000-4000-8000-000000000001', 'love_confession', '{"name":"Love Confession DM","emoji":"❤️","description":"AI-generated love confession DM to a mutual","category":"dm"}'::jsonb, 12),
  ('b0000002-0000-4000-8000-000000000002', 'reel_comment', '{"name":"Comment on Random Reel","emoji":"💬","description":"Find a trending reel and drop an embarrassing comment","category":"comment"}'::jsonb, 10),
  ('b0000002-0000-4000-8000-000000000003', 'send_reel', '{"name":"Send Random Reel via DM","emoji":"🎬","description":"Send a random reel to the victim via DM","category":"reel"}'::jsonb, 10),
  ('b0000002-0000-4000-8000-000000000004', 'story_upload', '{"name":"AI Image to Story","emoji":"🎨","description":"Generate an AI image about the victim and post to your story","category":"story"}'::jsonb, 8),
  ('b0000002-0000-4000-8000-000000000005', 'reel_to_story', '{"name":"Repost Reel to Story","emoji":"📲","description":"Grab a random reel and repost it to your story","category":"story"}'::jsonb, 5),
  ('b0000002-0000-4000-8000-000000000006', 'ai_video_story', '{"name":"AI Video to Story","emoji":"🎬","description":"Generate an AI video about the victim and post to your story","category":"story"}'::jsonb, 5)
on conflict (id) do nothing;
