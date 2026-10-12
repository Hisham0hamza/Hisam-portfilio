-- Masar — sample data: 6 hosts, 8 walkers, 26 events (22 upcoming, 4 completed),
-- applications, route stops, gallery photos and reviews.
--
-- Dates are relative to "today" (Africa/Cairo) so the seed always looks fresh.
-- All demo accounts use the password: masar-demo-123
--
-- Run with:  supabase db reset            (local, runs automatically)
--       or:  psql "$DATABASE_URL" -f supabase/seed.sql
--       or:  paste into the Supabase SQL editor.

set masar.seeding = 'on';

-- Helper: a timestamptz N days from today at HH:MM Cairo time.
create or replace function pg_temp.cairo(days int, hhmm text)
returns timestamptz
language sql
as $$
  select ((now() at time zone 'Africa/Cairo')::date + days + hhmm::time) at time zone 'Africa/Cairo';
$$;

create or replace function pg_temp.pt(lng float8, lat float8)
returns extensions.geography
language sql
as $$
  select extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography;
$$;

-- ---------------------------------------------------------------------------
-- Users (auth.users → profiles via the on_auth_user_created trigger)
-- ---------------------------------------------------------------------------
with people (id, email, full_name) as (
  values
    -- hosts
    ('a0000000-0000-4000-8000-000000000001'::uuid, 'nour@masar.demo',    'Nour El-Din Hassan'),
    ('a0000000-0000-4000-8000-000000000002'::uuid, 'salma@masar.demo',   'Salma Adel'),
    ('a0000000-0000-4000-8000-000000000003'::uuid, 'karim@masar.demo',   'Karim Mostafa'),
    ('a0000000-0000-4000-8000-000000000004'::uuid, 'youssef@masar.demo', 'Youssef Fathy'),
    ('a0000000-0000-4000-8000-000000000005'::uuid, 'mariam@masar.demo',  'Mariam Gamal'),
    ('a0000000-0000-4000-8000-000000000006'::uuid, 'omar@masar.demo',    'Omar Siwi'),
    -- walkers
    ('c0000000-0000-4000-8000-000000000001'::uuid, 'ahmed@masar.demo',   'Ahmed Samir'),
    ('c0000000-0000-4000-8000-000000000002'::uuid, 'laila@masar.demo',   'Laila Hamdy'),
    ('c0000000-0000-4000-8000-000000000003'::uuid, 'hana@masar.demo',    'Hana Mansour'),
    ('c0000000-0000-4000-8000-000000000004'::uuid, 'mahmoud@masar.demo', 'Mahmoud Ezzat'),
    ('c0000000-0000-4000-8000-000000000005'::uuid, 'sara@masar.demo',    'Sara Khaled'),
    ('c0000000-0000-4000-8000-000000000006'::uuid, 'tarek@masar.demo',   'Tarek Nabil'),
    ('c0000000-0000-4000-8000-000000000007'::uuid, 'dina@masar.demo',    'Dina Raafat'),
    ('c0000000-0000-4000-8000-000000000008'::uuid, 'ali@masar.demo',     'Ali Hegazy')
)
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email,
       extensions.crypt('masar-demo-123', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', full_name),
       now(), now(), '', '', '', ''
  from people
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
  from auth.users u
 where u.email like '%@masar.demo'
   and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');

update public.profiles p set
  bio = v.bio, city = v.city, languages = v.languages, interests = v.interests,
  is_host = v.is_host, host_verified = v.verified,
  avatar_url = 'https://i.pravatar.cc/300?u=' || p.id
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'Architect and Islamic Cairo storyteller. Ten years walking the old city.', 'cairo', '{ar,en}'::text[], '{heritage,architecture,history}'::text[], true, true),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'Street photographer. I run women-only sunrise photo walks around Cairo.', 'cairo', '{ar,en}', '{photography,heritage}', true, true),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'Food writer. If it is fried, stuffed or soaked in syrup, I know where to find it.', 'cairo', '{ar,en,fr}', '{food,culture}', true, true),
  ('a0000000-0000-4000-8000-000000000004'::uuid, 'Mountain guide and wilderness first responder. Wadi Degla regular, Sinai at heart.', 'cairo', '{ar,en}', '{hiking,nature,camping}', true, true),
  ('a0000000-0000-4000-8000-000000000005'::uuid, 'Alexandrian born and raised. Sea, history and the best fish in town.', 'alexandria', '{ar,en}', '{heritage,food,sea}', true, false),
  ('a0000000-0000-4000-8000-000000000006'::uuid, 'Desert trips to Siwa and Fayoum with local families and campfires.', 'siwa', '{ar,en,de}', '{desert,camping,stargazing}', true, true),
  ('c0000000-0000-4000-8000-000000000001'::uuid, 'Weekend walker, weekday engineer.', 'cairo', '{ar,en}', '{heritage,hiking}', false, false),
  ('c0000000-0000-4000-8000-000000000002'::uuid, 'Learning Cairo one street at a time.', 'cairo', '{ar,en}', '{photography,food}', false, false),
  ('c0000000-0000-4000-8000-000000000003'::uuid, null, 'giza', '{ar}', '{nature}', false, false),
  ('c0000000-0000-4000-8000-000000000004'::uuid, 'Trail runner.', 'cairo', '{ar,en}', '{hiking}', false, false),
  ('c0000000-0000-4000-8000-000000000005'::uuid, 'Design student. Love old buildings.', 'cairo', '{en,ar}', '{architecture,photography}', false, false),
  ('c0000000-0000-4000-8000-000000000006'::uuid, null, 'alexandria', '{ar}', '{food,sea}', false, false),
  ('c0000000-0000-4000-8000-000000000007'::uuid, 'Expat in Cairo, trying everything.', 'cairo', '{en}', '{culture,food}', false, false),
  ('c0000000-0000-4000-8000-000000000008'::uuid, null, 'cairo', '{ar}', '{desert}', false, false)
) as v (id, bio, city, languages, interests, is_host, verified)
where p.id = v.id;

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------
insert into public.events (
  id, host_id, title, description, category, city, area, meeting_point, meeting_address,
  start_at, end_at, duration_minutes, difficulty, distance_km, price_egp, includes, capacity,
  languages, women_only, family_friendly, what_to_bring, cancellation_policy, approval_mode,
  status, cover_url
) values
-- ======================= CAIRO =======================
('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
 'Al-Muizz Street at Golden Hour',
 'Walk the full length of Al-Muizz li-Din Allah Street from Bab al-Futuh to Bab Zuweila as the sun sets over a thousand years of minarets. We stop at the Qalawun complex, Beit al-Suhaymi and the Al-Aqmar mosque, with stories of the Fatimid and Mamluk city.',
 'heritage_walk', 'cairo', 'Gamaleya', pg_temp.pt(31.2627, 30.0548), 'Bab al-Futuh gate, Al-Muizz Street',
 pg_temp.cairo(3, '16:00'), null, 150, 'easy', 2.5, 0, 'Guiding, Arabic coffee at the end', 20,
 '{ar,en}', false, true, 'Comfortable shoes, water, modest clothing for mosque visits', 'Free event — please cancel in the app if you cannot come.', 'auto',
 'published', 'https://picsum.photos/seed/masar-muizz/1200/800'),

('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003',
 'Khan el-Khalili Food Crawl',
 'Eight tastings in three hours: ful and taameya, hawawshi, feteer, sobia, roz bel laban and the legendary El Fishawy tea. Vegetarian options at every stop.',
 'food_walk', 'cairo', 'Khan el-Khalili', pg_temp.pt(31.2622, 30.0477), 'In front of Al-Hussein Mosque',
 pg_temp.cairo(2, '18:30'), null, 180, 'easy', 2, 350, 'All tastings and drinks', 6,
 '{en,ar}', false, false, 'An empty stomach', 'Full refund up to 48 hours before.', 'manual',
 'published', 'https://picsum.photos/seed/masar-khan/1200/800'),

('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
 'Coptic Cairo & the Religions Compound',
 'The Hanging Church, Abu Serga, the Ben Ezra Synagogue and the Mosque of Amr ibn al-As — two thousand years of faith within a few hundred metres.',
 'heritage_walk', 'cairo', 'Old Cairo', pg_temp.pt(31.2300, 30.0053), 'Mar Girgis metro station exit',
 pg_temp.cairo(5, '10:00'), null, 180, 'easy', 2, 200, 'Guiding, entry tickets', 15,
 '{en}', false, true, 'Modest clothing, water', 'Full refund up to 24 hours before.', 'auto',
 'published', 'https://picsum.photos/seed/masar-coptic/1200/800'),

('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001',
 'Downtown Belle Époque Architecture Walk',
 'Khedival Cairo''s Paris-on-the-Nile: Talaat Harb, Emad El-Din, the Cosmopolitan Hotel and hidden passages full of Art Deco details.',
 'heritage_walk', 'cairo', 'Downtown', pg_temp.pt(31.2408, 30.0490), 'Talaat Harb Square, by the statue',
 pg_temp.cairo(6, '17:00'), null, 120, 'easy', 3, 150, 'Guiding, printed map', 18,
 '{ar,en}', false, true, 'Camera', 'Full refund up to 24 hours before.', 'auto',
 'published', 'https://picsum.photos/seed/masar-downtown/1200/800'),

('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000002',
 'Women''s Sunrise Photo Walk in Zamalek',
 'A calm, women-only morning shooting the Nile, the Cairo Tower and Zamalek''s villas in the soft first light. Composition tips for phones and cameras.',
 'photo_walk', 'cairo', 'Zamalek', pg_temp.pt(31.2243, 30.0459), 'Cairo Tower main gate',
 pg_temp.cairo(4, '06:00'), null, 120, 'easy', 3, 100, 'Coffee and photo critique', 6,
 '{ar,en}', true, false, 'Phone or camera, charged battery', 'Full refund up to 24 hours before.', 'manual',
 'published', 'https://picsum.photos/seed/masar-zamalek/1200/800'),

('b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000004',
 'Wadi Degla Canyon Hike',
 'A 10 km loop through the limestone canyon of Wadi Degla protectorate, looking for fossils and desert foxes. Steady pace with regular breaks.',
 'nature_hike', 'cairo', 'Maadi', pg_temp.pt(31.3200, 29.9580), 'Wadi Degla main gate (protectorate entrance)',
 pg_temp.cairo(3, '07:00'), null, 240, 'moderate', 10, 0, 'Guide, first aid', 30,
 '{ar,en}', false, false, '2L water, snacks, hat, sunscreen, hiking shoes', 'Free event — please cancel if you can''t make it.', 'auto',
 'published', 'https://picsum.photos/seed/masar-degla/1200/800'),

('b0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000004',
 'Al-Azhar Park Family Walk & Picnic',
 'An easy loop around Al-Azhar Park with views of the Citadel and the Ayyubid wall, then a picnic on the lawns. Kids welcome.',
 'nature_hike', 'cairo', 'Al-Darb al-Ahmar', pg_temp.pt(31.2640, 30.0410), 'Al-Azhar Park main gate, Salah Salem',
 pg_temp.cairo(8, '15:00'), null, 150, 'easy', 3, 0, 'Games for kids', 40,
 '{ar}', false, true, 'Picnic blanket, snacks, park entry ticket', 'Free event.', 'auto',
 'published', 'https://picsum.photos/seed/masar-azhar/1200/800'),

('b0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001',
 'The Citadel & Sultan Hassan',
 'From the Mosque of Sultan Hassan and Al-Rifai to the Citadel of Salah al-Din and the Muhammad Ali Mosque, with the best view in Cairo.',
 'heritage_walk', 'cairo', 'Citadel', pg_temp.pt(31.2565, 30.0320), 'Sultan Hassan Mosque entrance',
 pg_temp.cairo(10, '09:30'), null, 210, 'moderate', 4, 250, 'Guiding, entry tickets', 15,
 '{ar,en}', false, true, 'Water, modest clothing', 'Full refund up to 24 hours before.', 'auto',
 'published', 'https://picsum.photos/seed/masar-citadel/1200/800'),

('b0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000002',
 'Bab Zuweila & the Tentmakers'' Street',
 'Climb the minarets of Bab Zuweila, then photograph the appliqué artisans of Al-Khayamiya, Cairo''s last covered market.',
 'photo_walk', 'cairo', 'Al-Darb al-Ahmar', pg_temp.pt(31.2577, 30.0428), 'Bab Zuweila gate',
 pg_temp.cairo(12, '10:00'), null, 150, 'easy', 1.5, 180, 'Entry to Bab Zuweila', 12,
 '{ar,en}', false, false, 'Camera, small cash for purchases', 'Full refund up to 24 hours before.', 'auto',
 'published', 'https://picsum.photos/seed/masar-zuweila/1200/800'),

('b0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000003',
 'Sayeda Zeinab Late-Night Street Food',
 'Koshary, kebda Iskandarani, mombar and a sweet finish with basbousa — Cairo eats after dark.',
 'food_walk', 'cairo', 'Sayeda Zeinab', pg_temp.pt(31.2421, 30.0293), 'Sayeda Zeinab Mosque square',
 pg_temp.cairo(9, '20:00'), null, 150, 'easy', 1.5, 300, 'All food and drinks', 10,
 '{ar,en}', false, false, 'Wet wipes', 'Full refund up to 48 hours before.', 'manual',
 'published', 'https://picsum.photos/seed/masar-sayeda/1200/800'),

-- ======================= GIZA =======================
('b0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000004',
 'Pyramids Desert Plateau Walk',
 'A desert walk across the Giza plateau to the panorama point, away from the crowds, finishing at the Sphinx.',
 'nature_hike', 'giza', 'Giza Plateau', pg_temp.pt(31.1342, 29.9792), 'Pyramids main gate (Mena House side)',
 pg_temp.cairo(7, '07:30'), null, 210, 'moderate', 8, 400, 'Guide, plateau entry ticket', 20,
 '{en,ar}', false, true, 'Hat, sunscreen, 2L water', 'Full refund up to 48 hours before.', 'auto',
 'published', 'https://picsum.photos/seed/masar-pyramids/1200/800'),

('b0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000001',
 'Saqqara & Dahshur Day Trip',
 'The Step Pyramid of Djoser, the Serapeum and the Bent and Red Pyramids of Dahshur — the pyramids before Giza.',
 'city_trip', 'giza', 'Saqqara', pg_temp.pt(31.2165, 29.8713), 'Saqqara ticket office',
 pg_temp.cairo(11, '08:00'), null, 540, 'moderate', 6, 950, 'Transport from Cairo, lunch, entry tickets', 14,
 '{en}', false, true, 'Hat, water, cash for tips', '50% refund up to 72 hours before.', 'manual',
 'published', 'https://picsum.photos/seed/masar-saqqara/1200/800'),

-- ======================= ALEXANDRIA =======================
('b0000000-0000-4000-8000-000000000013', 'a0000000-0000-4000-8000-000000000005',
 'Qaitbay Citadel & Anfoushi Sea Walk',
 'From the Citadel of Qaitbay, built on the ruins of the Pharos lighthouse, along the fishermen''s harbour of Anfoushi.',
 'heritage_walk', 'alexandria', 'Anfoushi', pg_temp.pt(29.8856, 31.2140), 'Qaitbay Citadel gate',
 pg_temp.cairo(4, '16:30'), null, 150, 'easy', 3, 150, 'Guiding, citadel entry', 20,
 '{ar,en}', false, true, 'Light jacket (sea breeze)', 'Full refund up to 24 hours before.', 'auto',
 'published', 'https://picsum.photos/seed/masar-qaitbay/1200/800'),

('b0000000-0000-4000-8000-000000000014', 'a0000000-0000-4000-8000-000000000005',
 'Alexandria Seafood & Sweets Walk',
 'Fried fish in Anfoushi, Mohamed Ahmed''s ful, Délices pastries and Sabry ice-cream — Alexandria by the mouthful.',
 'food_walk', 'alexandria', 'Raml Station', pg_temp.pt(29.9030, 31.2006), 'Raml Station tram stop',
 pg_temp.cairo(5, '13:00'), null, 210, 'easy', 3.5, 450, 'All tastings', 12,
 '{ar}', false, false, 'Appetite', 'Full refund up to 48 hours before.', 'manual',
 'published', 'https://picsum.photos/seed/masar-alexfood/1200/800'),

('b0000000-0000-4000-8000-000000000015', 'a0000000-0000-4000-8000-000000000005',
 'Montazah Gardens Sunset Walk',
 'An easy stroll through the royal gardens of Montazah to the palace and the sea at sunset.',
 'nature_hike', 'alexandria', 'Montazah', pg_temp.pt(30.0164, 31.2885), 'Montazah main gate',
 pg_temp.cairo(13, '16:00'), null, 120, 'easy', 4, 0, null, 25,
 '{ar,en}', false, true, 'Garden entry ticket', 'Free event.', 'auto',
 'published', 'https://picsum.photos/seed/masar-montazah/1200/800'),

('b0000000-0000-4000-8000-000000000016', 'a0000000-0000-4000-8000-000000000005',
 'Bibliotheca & Roman Alexandria',
 'The new Library of Alexandria, the Roman Amphitheatre of Kom el-Dikka and Pompey''s Pillar.',
 'heritage_walk', 'alexandria', 'Shatby', pg_temp.pt(29.9092, 31.2089), 'Bibliotheca Alexandrina plaza',
 pg_temp.cairo(14, '10:00'), null, 240, 'easy', 5, 250, 'Guiding, entry tickets', 15,
 '{en,fr}', false, true, 'Comfortable shoes', 'Full refund up to 24 hours before.', 'auto',
 'published', 'https://picsum.photos/seed/masar-bibalex/1200/800'),

-- ======================= FAYOUM =======================
('b0000000-0000-4000-8000-000000000017', 'a0000000-0000-4000-8000-000000000006',
 'Wadi El Rayan Waterfalls & Magic Lake',
 'Day trip to the only waterfalls in Egypt''s Western Desert, sandboarding on the dunes and sunset at the Magic Lake.',
 'city_trip', 'fayoum', 'Wadi El Rayan', pg_temp.pt(30.4183, 29.1919), 'Wadi El Rayan protectorate gate',
 pg_temp.cairo(6, '09:00'), null, 600, 'moderate', 5, 850, 'Transport from Cairo, lunch, sandboards', 20,
 '{ar,en}', false, true, 'Swimwear, towel, sunscreen', '50% refund up to 72 hours before.', 'auto',
 'published', 'https://picsum.photos/seed/masar-rayan/1200/800'),

('b0000000-0000-4000-8000-000000000018', 'a0000000-0000-4000-8000-000000000006',
 'Tunis Village Pottery Weekend',
 'Two days in the potters'' village on Lake Qarun: a pottery workshop, a sunset walk on the lake shore and a night in an eco-lodge.',
 'multi_day_trip', 'fayoum', 'Tunis Village', pg_temp.pt(30.5464, 29.4122), 'Tunis Village main square',
 pg_temp.cairo(15, '10:00'), pg_temp.cairo(16, '17:00'), 1860, 'easy', 6, 2200, 'Lodge, meals, pottery workshop', 12,
 '{ar,en}', false, true, 'Overnight bag, warm layer', '50% refund up to 7 days before.', 'manual',
 'published', 'https://picsum.photos/seed/masar-tunis/1200/800'),

('b0000000-0000-4000-8000-000000000019', 'a0000000-0000-4000-8000-000000000006',
 'Wadi Al-Hitan Fossils & Stargazing',
 'Walk among 40-million-year-old whale skeletons at the UNESCO site, then camp under the darkest skies near Cairo.',
 'multi_day_trip', 'fayoum', 'Wadi Al-Hitan', pg_temp.pt(30.0434, 29.2708), 'Wadi Al-Hitan visitor centre',
 pg_temp.cairo(9, '14:00'), pg_temp.cairo(10, '11:00'), 1260, 'moderate', 8, 1800, 'Camping gear, dinner, breakfast, telescope', 16,
 '{ar,en}', false, false, 'Sleeping bag, headlamp, warm jacket', '50% refund up to 7 days before.', 'auto',
 'published', 'https://picsum.photos/seed/masar-hitan/1200/800'),

-- ======================= SIWA =======================
('b0000000-0000-4000-8000-000000000020', 'a0000000-0000-4000-8000-000000000006',
 'Siwa Oasis 4-Day Escape',
 'Salt lakes, the Shali fortress, Cleopatra''s spring, the Great Sand Sea and a Bedouin dinner under the stars.',
 'multi_day_trip', 'siwa', 'Siwa Town', pg_temp.pt(25.5195, 29.2032), 'Shali fortress, Siwa market square',
 pg_temp.cairo(18, '09:00'), pg_temp.cairo(21, '18:00'), 4860, 'moderate', 25, 6500, 'Eco-lodge, all meals, 4x4 safari', 10,
 '{ar,en,de}', false, true, 'Swimwear, scarf, warm layer for nights', '50% refund up to 14 days before.', 'manual',
 'published', 'https://picsum.photos/seed/masar-siwa/1200/800'),

('b0000000-0000-4000-8000-000000000021', 'a0000000-0000-4000-8000-000000000006',
 'Siwa Salt Lakes Float & Sunset',
 'Float in the turquoise salt pools, then catch the sunset at Fatnas island.',
 'nature_hike', 'siwa', 'Salt Lakes', pg_temp.pt(25.4950, 29.1650), 'Salt lakes car park',
 pg_temp.cairo(19, '14:00'), null, 240, 'easy', 3, 600, 'Transport within Siwa, tea', 15,
 '{ar,en}', false, true, 'Swimwear, towel, fresh water to rinse', 'Full refund up to 48 hours before.', 'auto',
 'published', 'https://picsum.photos/seed/masar-salt/1200/800'),

-- ======================= SINAI =======================
('b0000000-0000-4000-8000-000000000022', 'a0000000-0000-4000-8000-000000000004',
 'Dahab Blue Hole Coastal Hike',
 'A coastal trail from the Blue Hole towards Ras Abu Galum with snorkelling breaks along the reef.',
 'nature_hike', 'dahab', 'Blue Hole', pg_temp.pt(34.5379, 28.5722), 'Blue Hole car park',
 pg_temp.cairo(16, '08:00'), null, 300, 'moderate', 12, 300, 'Guide, snorkel gear', 12,
 '{en,ar}', false, false, 'Swimwear, water shoes, 3L water', 'Full refund up to 48 hours before.', 'auto',
 'published', 'https://picsum.photos/seed/masar-bluehole/1200/800'),

('b0000000-0000-4000-8000-000000000023', 'a0000000-0000-4000-8000-000000000004',
 'Mount Sinai Sunrise Trek',
 'Night ascent of Mount Sinai via the camel path, sunrise at the summit and descent by the 3,750 Steps of Repentance to St. Catherine''s Monastery.',
 'nature_hike', 'south_sinai', 'St. Catherine', pg_temp.pt(33.9750, 28.5560), 'St. Catherine''s Monastery car park',
 pg_temp.cairo(17, '01:00'), null, 420, 'hard', 14, 700, 'Bedouin guide, tea at the summit', 8,
 '{en,ar}', false, false, 'Headlamp, warm jacket, gloves, 2L water', 'Full refund up to 72 hours before.', 'manual',
 'published', 'https://picsum.photos/seed/masar-sinai/1200/800'),

-- ======================= COMPLETED (for reviews) =======================
('b0000000-0000-4000-8000-000000000024', 'a0000000-0000-4000-8000-000000000001',
 'Al-Muizz by Night',
 'The lit-up mosques and sabils of Al-Muizz after dark.',
 'heritage_walk', 'cairo', 'Gamaleya', pg_temp.pt(31.2614, 30.0497), 'Qalawun complex',
 pg_temp.cairo(-10, '19:00'), null, 120, 'easy', 2, 0, null, 20,
 '{ar,en}', false, true, null, null, 'auto',
 'completed', 'https://picsum.photos/seed/masar-muizznight/1200/800'),

('b0000000-0000-4000-8000-000000000025', 'a0000000-0000-4000-8000-000000000004',
 'Wadi Degla Sunset Hike',
 'Short canyon hike timed for sunset over the cliffs.',
 'nature_hike', 'cairo', 'Maadi', pg_temp.pt(31.3200, 29.9580), 'Wadi Degla main gate',
 pg_temp.cairo(-6, '15:00'), null, 180, 'moderate', 7, 0, null, 25,
 '{ar,en}', false, false, null, null, 'auto',
 'completed', 'https://picsum.photos/seed/masar-deglasunset/1200/800'),

('b0000000-0000-4000-8000-000000000026', 'a0000000-0000-4000-8000-000000000003',
 'Downtown Cafés & Bakeries',
 'Groppi, Café Riche, Le Grillon and a few bakeries locals swear by.',
 'food_walk', 'cairo', 'Downtown', pg_temp.pt(31.2402, 30.0478), 'Groppi, Talaat Harb Square',
 pg_temp.cairo(-3, '11:00'), null, 150, 'easy', 2, 250, 'Tastings and coffee', 10,
 '{en,ar}', false, false, null, null, 'auto',
 'completed', 'https://picsum.photos/seed/masar-cafes/1200/800')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Route stops
-- ---------------------------------------------------------------------------
insert into public.event_stops (event_id, name, location, sort_order) values
  ('b0000000-0000-4000-8000-000000000001', 'Bab al-Futuh',             pg_temp.pt(31.2627, 30.0548), 1),
  ('b0000000-0000-4000-8000-000000000001', 'Al-Aqmar Mosque',          pg_temp.pt(31.2620, 30.0525), 2),
  ('b0000000-0000-4000-8000-000000000001', 'Beit al-Suhaymi',          pg_temp.pt(31.2632, 30.0520), 3),
  ('b0000000-0000-4000-8000-000000000001', 'Qalawun Complex',          pg_temp.pt(31.2614, 30.0497), 4),
  ('b0000000-0000-4000-8000-000000000001', 'Bab Zuweila',              pg_temp.pt(31.2577, 30.0428), 5),
  ('b0000000-0000-4000-8000-000000000003', 'The Hanging Church',       pg_temp.pt(31.2300, 30.0053), 1),
  ('b0000000-0000-4000-8000-000000000003', 'Abu Serga Church',         pg_temp.pt(31.2310, 30.0060), 2),
  ('b0000000-0000-4000-8000-000000000003', 'Ben Ezra Synagogue',       pg_temp.pt(31.2318, 30.0057), 3),
  ('b0000000-0000-4000-8000-000000000003', 'Mosque of Amr ibn al-As',  pg_temp.pt(31.2335, 30.0102), 4),
  ('b0000000-0000-4000-8000-000000000004', 'Cosmopolitan Hotel',       pg_temp.pt(31.2425, 30.0500), 1),
  ('b0000000-0000-4000-8000-000000000004', 'Emad El-Din Street',       pg_temp.pt(31.2462, 30.0520), 2),
  ('b0000000-0000-4000-8000-000000000004', 'Cinema Radio',             pg_temp.pt(31.2410, 30.0505), 3),
  ('b0000000-0000-4000-8000-000000000008', 'Sultan Hassan Mosque',     pg_temp.pt(31.2565, 30.0320), 1),
  ('b0000000-0000-4000-8000-000000000008', 'Al-Rifai Mosque',          pg_temp.pt(31.2575, 30.0325), 2),
  ('b0000000-0000-4000-8000-000000000008', 'Muhammad Ali Mosque',      pg_temp.pt(31.2599, 30.0287), 3),
  ('b0000000-0000-4000-8000-000000000013', 'Qaitbay Citadel',          pg_temp.pt(29.8856, 31.2140), 1),
  ('b0000000-0000-4000-8000-000000000013', 'Anfoushi fishing harbour', pg_temp.pt(29.8890, 31.2050), 2),
  ('b0000000-0000-4000-8000-000000000016', 'Bibliotheca Alexandrina',  pg_temp.pt(29.9092, 31.2089), 1),
  ('b0000000-0000-4000-8000-000000000016', 'Kom el-Dikka Amphitheatre', pg_temp.pt(29.9040, 31.1945), 2),
  ('b0000000-0000-4000-8000-000000000016', 'Pompey''s Pillar',         pg_temp.pt(29.8963, 31.1825), 3),
  ('b0000000-0000-4000-8000-000000000023', 'Elijah''s Basin',           pg_temp.pt(33.9730, 28.5410), 1),
  ('b0000000-0000-4000-8000-000000000023', 'Summit chapel',             pg_temp.pt(33.9755, 28.5394), 2);

-- ---------------------------------------------------------------------------
-- Gallery photos
-- ---------------------------------------------------------------------------
insert into public.event_photos (event_id, url, sort_order)
select e.id, 'https://picsum.photos/seed/' || replace(e.id::text, '-', '') || '-' || g || '/1200/800', g
  from public.events e
  cross join generate_series(1, 3) g
 where e.id in (
   'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003',
   'b0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000017',
   'b0000000-0000-4000-8000-000000000020', 'b0000000-0000-4000-8000-000000000023'
 );

-- ---------------------------------------------------------------------------
-- Applications
-- ---------------------------------------------------------------------------
insert into public.applications (event_id, user_id, status, message, decided_at) values
  -- Khan el-Khalili food crawl: full (6/6) + one pending
  ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'approved', null, now()),
  ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'approved', 'Vegetarian here!', now()),
  ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003', 'approved', null, now()),
  ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000004', 'approved', null, now()),
  ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000005', 'approved', null, now()),
  ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000006', 'approved', null, now()),
  ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000007', 'pending', 'Any chance a seat opens up?', null),
  -- Al-Muizz golden hour
  ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'approved', null, now()),
  ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000005', 'approved', null, now()),
  ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000007', 'approved', null, now()),
  ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000008', 'approved', null, now()),
  -- Zamalek women's photo walk (manual)
  ('b0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000002', 'approved', null, now()),
  ('b0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000003', 'pending', 'First photo walk for me', null),
  ('b0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000005', 'pending', null, null),
  -- Wadi Degla canyon
  ('b0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001', 'approved', null, now()),
  ('b0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000004', 'approved', null, now()),
  ('b0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000006', 'approved', null, now()),
  ('b0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000008', 'approved', null, now()),
  ('b0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000002', 'cancelled', null, now()),
  -- Mount Sinai (manual)
  ('b0000000-0000-4000-8000-000000000023', 'c0000000-0000-4000-8000-000000000004', 'approved', null, now()),
  ('b0000000-0000-4000-8000-000000000023', 'c0000000-0000-4000-8000-000000000008', 'pending', 'I have done Kilimanjaro', null),
  -- Siwa (manual)
  ('b0000000-0000-4000-8000-000000000020', 'c0000000-0000-4000-8000-000000000007', 'approved', null, now()),
  ('b0000000-0000-4000-8000-000000000020', 'c0000000-0000-4000-8000-000000000005', 'rejected', null, now()),
  -- Wadi El Rayan
  ('b0000000-0000-4000-8000-000000000017', 'c0000000-0000-4000-8000-000000000003', 'approved', null, now()),
  ('b0000000-0000-4000-8000-000000000017', 'c0000000-0000-4000-8000-000000000006', 'approved', null, now()),
  -- Completed events: attendance
  ('b0000000-0000-4000-8000-000000000024', 'c0000000-0000-4000-8000-000000000001', 'attended', null, now()),
  ('b0000000-0000-4000-8000-000000000024', 'c0000000-0000-4000-8000-000000000002', 'attended', null, now()),
  ('b0000000-0000-4000-8000-000000000024', 'c0000000-0000-4000-8000-000000000005', 'attended', null, now()),
  ('b0000000-0000-4000-8000-000000000024', 'c0000000-0000-4000-8000-000000000006', 'no_show', null, now()),
  ('b0000000-0000-4000-8000-000000000025', 'c0000000-0000-4000-8000-000000000004', 'attended', null, now()),
  ('b0000000-0000-4000-8000-000000000025', 'c0000000-0000-4000-8000-000000000008', 'attended', null, now()),
  ('b0000000-0000-4000-8000-000000000025', 'c0000000-0000-4000-8000-000000000001', 'attended', null, now()),
  ('b0000000-0000-4000-8000-000000000026', 'c0000000-0000-4000-8000-000000000007', 'attended', null, now()),
  ('b0000000-0000-4000-8000-000000000026', 'c0000000-0000-4000-8000-000000000002', 'attended', null, now()),
  -- Ahmed attended the cafés walk but hasn't reviewed it, so the review flow can be tried.
  ('b0000000-0000-4000-8000-000000000026', 'c0000000-0000-4000-8000-000000000001', 'attended', null, now())
on conflict (event_id, user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------
insert into public.reviews (event_id, reviewer_id, host_id, rating, comment) values
  ('b0000000-0000-4000-8000-000000000024', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 5, 'Nour brings every building to life. Already booked the next one.'),
  ('b0000000-0000-4000-8000-000000000024', 'c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 5, 'تجربة رائعة، شرح ممتع جداً والمكان ساحر بالليل.'),
  ('b0000000-0000-4000-8000-000000000024', 'c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 4, 'Great stories, a bit crowded near Qalawun.'),
  ('b0000000-0000-4000-8000-000000000025', 'c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000004', 5, 'Perfect pace and a stunning sunset.'),
  ('b0000000-0000-4000-8000-000000000025', 'c0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000004', 4, 'يوسف منظم جداً. محتاجين مية أكتر المرة الجاية!'),
  ('b0000000-0000-4000-8000-000000000026', 'c0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000003', 5, 'I would never have found half of these places on my own.'),
  ('b0000000-0000-4000-8000-000000000026', 'c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003', 4, 'Delicious. Groppi was a highlight.')
on conflict (event_id, reviewer_id) do nothing;

reset masar.seeding;

select
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.events) as events,
  (select count(*) from public.applications) as applications,
  (select count(*) from public.reviews) as reviews;
