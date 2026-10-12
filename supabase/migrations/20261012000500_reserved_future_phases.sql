-- Masar — tables reserved for Phases 2–4.
-- They exist now so later features plug in without reshaping Phase 1 data.
-- RLS is enabled everywhere; policies are intentionally narrow until each feature ships.

-- ---------------------------------------------------------------------------
-- Phase 2: payments, payouts, subscriptions, chat, QR check-in
-- ---------------------------------------------------------------------------
create type public.payment_status as enum ('initiated', 'paid', 'failed', 'refunded', 'partially_refunded');
create type public.payment_provider as enum ('paymob', 'fawry');
create type public.payment_kind as enum ('ticket', 'deposit', 'subscription', 'featured_boost');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  event_id uuid references public.events (id) on delete set null,
  application_id uuid references public.applications (id) on delete set null,
  kind public.payment_kind not null,
  provider public.payment_provider not null,
  provider_ref text,
  amount_egp numeric(10, 2) not null check (amount_egp >= 0),
  commission_rate numeric(5, 4) not null default 0.12,
  commission_egp numeric(10, 2) not null default 0,
  status public.payment_status not null default 'initiated',
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_user_idx on public.payments (user_id);
create index payments_event_idx on public.payments (event_id);

-- Double-entry-style ledger of what each host is owed / has been paid.
create table public.host_ledger (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete restrict,
  payment_id uuid references public.payments (id) on delete set null,
  entry_type text not null check (entry_type in ('earning', 'refund', 'payout', 'adjustment')),
  amount_egp numeric(10, 2) not null,  -- positive = owed to host, negative = paid out / clawed back
  note text,
  created_at timestamptz not null default now()
);
create index host_ledger_host_idx on public.host_ledger (host_id, created_at);

create table public.host_subscriptions (
  host_id uuid primary key references public.profiles (id) on delete cascade,
  plan text not null default 'pro',
  current_period_end timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.events
  add column deposit_egp numeric(10, 2) check (deposit_egp >= 0);  -- refundable deposit for free events

alter table public.applications
  add column checkin_code uuid not null default gen_random_uuid(),  -- QR check-in token
  add column checked_in_at timestamptz;

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index chat_messages_event_idx on public.chat_messages (event_id, created_at);

-- ---------------------------------------------------------------------------
-- Phase 3: gamification, photo wall, follows, partners/perks, referrals, safety
-- ---------------------------------------------------------------------------
create table public.badges (
  id text primary key,
  name_en text not null,
  name_ar text not null,
  description_en text,
  description_ar text,
  icon text
);

create table public.user_badges (
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge_id text not null references public.badges (id) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  host_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, host_id),
  check (follower_id <> host_id)
);
create index follows_host_idx on public.follows (host_id);

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'cafe',
  city text references public.cities (slug),
  location extensions.geography(Point, 4326),
  address text,
  logo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index partners_location_gix on public.partners using gist (location);

create table public.perks (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  title_en text not null,
  title_ar text not null,
  discount_percent int check (discount_percent between 1 and 100),
  valid_until timestamptz,
  active boolean not null default true
);

create table public.event_wall_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  url text not null,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('event', 'user', 'review')),
  target_id uuid not null,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'reviewing', 'closed')),
  created_at timestamptz not null default now()
);

create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  phone text not null,
  created_at timestamptz not null default now()
);

create table public.referral_codes (
  code text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS (narrow defaults)
-- ---------------------------------------------------------------------------
alter table public.payments enable row level security;
alter table public.host_ledger enable row level security;
alter table public.host_subscriptions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.follows enable row level security;
alter table public.partners enable row level security;
alter table public.perks enable row level security;
alter table public.event_wall_photos enable row level security;
alter table public.reports enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.referral_codes enable row level security;

-- Payments are written by edge functions (service role) only.
create policy "users read own payments" on public.payments for select to authenticated
  using (user_id = auth.uid());
create policy "hosts read own ledger" on public.host_ledger for select to authenticated
  using (host_id = auth.uid());
create policy "hosts read own subscription" on public.host_subscriptions for select to authenticated
  using (host_id = auth.uid());

-- Chat: host + approved/attended attendees.
create or replace function public.is_event_member(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_event_host(p_event_id) or exists (
    select 1 from public.applications
     where event_id = p_event_id and user_id = auth.uid() and status in ('approved', 'attended')
  );
$$;

create policy "members read chat" on public.chat_messages for select to authenticated
  using (public.is_event_member(event_id));
create policy "members write chat" on public.chat_messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_event_member(event_id));

create policy "badges are public" on public.badges for select using (true);
create policy "user badges are public" on public.user_badges for select using (true);

create policy "follows are public" on public.follows for select using (true);
create policy "users manage own follows" on public.follows for insert to authenticated
  with check (follower_id = auth.uid());
create policy "users remove own follows" on public.follows for delete to authenticated
  using (follower_id = auth.uid());

create policy "active partners are public" on public.partners for select using (active);
create policy "active perks are public" on public.perks for select using (active);

create policy "wall photos readable by members" on public.event_wall_photos for select to authenticated
  using (public.is_event_member(event_id));
create policy "members post wall photos" on public.event_wall_photos for insert to authenticated
  with check (user_id = auth.uid() and public.is_event_member(event_id));

create policy "users file reports" on public.reports for insert to authenticated
  with check (reporter_id = auth.uid());
create policy "users see own reports" on public.reports for select to authenticated
  using (reporter_id = auth.uid());

create policy "users manage emergency contacts" on public.emergency_contacts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "users read own referral code" on public.referral_codes for select to authenticated
  using (user_id = auth.uid());

-- QR codes must not be readable by other walkers; hosts already only see their events' rows.
