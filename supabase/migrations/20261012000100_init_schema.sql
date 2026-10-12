-- Masar — Phase 1 core schema
-- Extensions, enums, lookup tables and the core domain tables.

create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.event_category as enum (
  'heritage_walk',
  'nature_hike',
  'city_trip',
  'food_walk',
  'photo_walk',
  'multi_day_trip'
);

create type public.difficulty_level as enum ('easy', 'moderate', 'hard');

create type public.approval_mode as enum ('auto', 'manual');

create type public.event_status as enum ('draft', 'published', 'cancelled', 'completed');

create type public.application_status as enum (
  'pending',
  'approved',
  'rejected',
  'cancelled',
  'attended',
  'no_show'
);

-- ---------------------------------------------------------------------------
-- Cities (lookup; bilingual names so search works in Arabic and English)
-- ---------------------------------------------------------------------------
create table public.cities (
  slug text primary key,
  name_en text not null,
  name_ar text not null,
  center extensions.geography(Point, 4326) not null,
  sort_order int not null default 0
);

insert into public.cities (slug, name_en, name_ar, center, sort_order) values
  ('cairo',       'Cairo',       'القاهرة',     extensions.st_point(31.2357, 30.0444, 4326)::extensions.geography, 1),
  ('giza',        'Giza',        'الجيزة',      extensions.st_point(31.2089, 29.9870, 4326)::extensions.geography, 2),
  ('alexandria',  'Alexandria',  'الإسكندرية',  extensions.st_point(29.9187, 31.2001, 4326)::extensions.geography, 3),
  ('fayoum',      'Fayoum',      'الفيوم',      extensions.st_point(30.8418, 29.3084, 4326)::extensions.geography, 4),
  ('siwa',        'Siwa',        'سيوة',        extensions.st_point(25.5195, 29.2032, 4326)::extensions.geography, 5),
  ('dahab',       'Dahab',       'دهب',         extensions.st_point(34.5136, 28.4927, 4326)::extensions.geography, 6),
  ('south_sinai', 'South Sinai', 'جنوب سيناء',  extensions.st_point(33.9750, 28.5560, 4326)::extensions.geography, 7),
  ('luxor',       'Luxor',       'الأقصر',      extensions.st_point(32.6396, 25.6872, 4326)::extensions.geography, 8),
  ('aswan',       'Aswan',       'أسوان',       extensions.st_point(32.8998, 24.0889, 4326)::extensions.geography, 9),
  ('red_sea',     'Red Sea',     'البحر الأحمر', extensions.st_point(33.8116, 27.2579, 4326)::extensions.geography, 10);

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 80),
  avatar_url text,
  bio text check (char_length(bio) <= 1000),
  city text references public.cities (slug) on update cascade,
  languages text[] not null default '{}',
  interests text[] not null default '{}',
  is_host boolean not null default false,
  host_verified boolean not null default false,  -- manual admin approval
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_name_trgm_idx on public.profiles using gin (name extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '' check (char_length(description) <= 5000),
  category public.event_category not null,
  city text not null references public.cities (slug) on update cascade,
  area text,
  meeting_point extensions.geography(Point, 4326) not null,
  -- Plain coordinates for API clients (PostgREST returns geography as hex WKB).
  meeting_lat double precision generated always as (extensions.st_y(meeting_point::extensions.geometry)) stored,
  meeting_lng double precision generated always as (extensions.st_x(meeting_point::extensions.geometry)) stored,
  meeting_address text not null default '',
  start_at timestamptz not null,
  end_at timestamptz,                         -- set for multi-day trips
  duration_minutes int not null check (duration_minutes > 0 and duration_minutes <= 60 * 24 * 30),
  difficulty public.difficulty_level not null default 'easy',
  distance_km numeric(6, 2) check (distance_km >= 0),
  price_egp numeric(10, 2) not null default 0 check (price_egp >= 0),
  includes text,
  capacity int not null check (capacity between 1 and 500),
  approved_count int not null default 0 check (approved_count >= 0),  -- maintained by trigger
  languages text[] not null default '{ar}',
  women_only boolean not null default false,
  family_friendly boolean not null default false,
  what_to_bring text,
  cancellation_policy text,
  approval_mode public.approval_mode not null default 'auto',
  status public.event_status not null default 'draft',
  cover_url text,
  -- Phase 2 (featured boost). Kept here so search can already order by it.
  featured_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_end_after_start check (end_at is null or end_at > start_at),
  constraint events_not_overbooked check (approved_count <= capacity)
);

create index events_meeting_point_gix on public.events using gist (meeting_point);
create index events_start_at_idx on public.events (start_at);
create index events_status_idx on public.events (status);
create index events_city_idx on public.events (city);
create index events_category_idx on public.events (category);
create index events_host_idx on public.events (host_id);
create index events_status_start_idx on public.events (status, start_at);
create index events_title_trgm_idx on public.events using gin (title extensions.gin_trgm_ops);
create index events_languages_gin on public.events using gin (languages);

-- ---------------------------------------------------------------------------
-- Photos and route stops
-- ---------------------------------------------------------------------------
create table public.event_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index event_photos_event_idx on public.event_photos (event_id, sort_order);

create table public.event_stops (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  location extensions.geography(Point, 4326) not null,
  lat double precision generated always as (extensions.st_y(location::extensions.geometry)) stored,
  lng double precision generated always as (extensions.st_x(location::extensions.geometry)) stored,
  sort_order int not null default 0
);
create index event_stops_event_idx on public.event_stops (event_id, sort_order);

-- ---------------------------------------------------------------------------
-- Applications
-- ---------------------------------------------------------------------------
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.application_status not null default 'pending',
  message text check (char_length(message) <= 1000),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);
create index applications_user_idx on public.applications (user_id, status);
create index applications_event_idx on public.applications (event_id, status);

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  host_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 2000),
  created_at timestamptz not null default now(),
  unique (event_id, reviewer_id)
);
create index reviews_host_idx on public.reviews (host_id);
create index reviews_event_idx on public.reviews (event_id);

-- ---------------------------------------------------------------------------
-- Saved events
-- ---------------------------------------------------------------------------
create table public.saved_events (
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
create index saved_events_event_idx on public.saved_events (event_id);

-- ---------------------------------------------------------------------------
-- Push tokens and the notification outbox
-- ---------------------------------------------------------------------------
create table public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text,
  locale text,
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  type text not null,  -- application_received | application_approved | application_rejected | event_reminder_24h | event_reminder_2h | event_cancelled
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  read_at timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unsent_idx on public.notifications (created_at) where sent_at is null;
-- A reminder is only ever sent once per user per event.
create unique index notifications_reminder_once
  on public.notifications (user_id, event_id, type)
  where type in ('event_reminder_24h', 'event_reminder_2h');

-- ---------------------------------------------------------------------------
-- Platform settings (commission etc. — used from Phase 2)
-- ---------------------------------------------------------------------------
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.app_settings (key, value) values
  ('commission_rate', '0.12'::jsonb),
  ('pro_commission_rate', '0.08'::jsonb);
