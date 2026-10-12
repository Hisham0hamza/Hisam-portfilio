-- Masar — triggers, RPCs and the search function.
--
-- Error codes raised by RPCs are stable strings (e.g. 'event_full') so the app can
-- translate them; see src/lib/errors.ts.

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger events_updated_at before update on public.events
  for each row execute function public.set_updated_at();
create trigger applications_updated_at before update on public.applications
  for each row execute function public.set_updated_at();

-- Seed scripts set `masar.seeding = on` so they don't fill the notification outbox.
create or replace function public.is_seeding()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('masar.seeding', true), '') = 'on';
$$;

-- ---------------------------------------------------------------------------
-- Profiles: create one for every new auth user
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (
    new.id,
    left(coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      ''
    ), 80),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Events: host bookkeeping and status rules
-- ---------------------------------------------------------------------------
create or replace function public.events_before_write()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if new.host_id <> old.host_id then
      raise exception 'host_cannot_change' using errcode = 'P0001';
    end if;
    if old.status in ('cancelled', 'completed') and new.status <> old.status then
      raise exception 'event_closed' using errcode = 'P0001';
    end if;
  end if;

  -- Publishing requires a future start date.
  if new.status = 'published'
     and (tg_op = 'INSERT' or old.status <> 'published')
     and new.start_at <= now() then
    raise exception 'start_in_past' using errcode = 'P0001';
  end if;

  if new.category = 'multi_day_trip' and new.end_at is null then
    new.end_at := new.start_at + make_interval(mins => new.duration_minutes);
  end if;
  return new;
end;
$$;

create trigger events_before_write
  before insert or update on public.events
  for each row execute function public.events_before_write();

create or replace function public.events_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set is_host = true where id = new.host_id and not is_host;
  return null;
end;
$$;

create trigger events_after_insert
  after insert on public.events
  for each row execute function public.events_after_insert();

-- Notify applicants when an event is cancelled.
create or replace function public.events_after_cancel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_seeding() then
    return null;
  end if;
  insert into public.notifications (user_id, event_id, type, data)
  select a.user_id, new.id, 'event_cancelled', jsonb_build_object('event_title', new.title)
  from public.applications a
  where a.event_id = new.id and a.status in ('pending', 'approved');
  return null;
end;
$$;

create trigger events_after_cancel
  after update of status on public.events
  for each row
  when (new.status = 'cancelled' and old.status is distinct from 'cancelled')
  execute function public.events_after_cancel();

-- ---------------------------------------------------------------------------
-- Applications: capacity enforcement (last line of defence, runs for every write
-- path including the service role) and the approved-seat counter.
-- ---------------------------------------------------------------------------
create or replace function public.applications_enforce_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_capacity int;
  v_taken int;
begin
  if new.status in ('approved', 'attended')
     and (tg_op = 'INSERT' or old.status not in ('approved', 'attended')) then
    -- Row lock on the event serialises concurrent approvals for the same event.
    select capacity into v_capacity from public.events where id = new.event_id for update;
    -- Fresh snapshot (READ COMMITTED): sees seats committed by whoever held the lock.
    select count(*) into v_taken
      from public.applications
     where event_id = new.event_id
       and status in ('approved', 'attended')
       and id <> new.id;
    if v_taken >= v_capacity then
      raise exception 'event_full' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger applications_enforce_capacity
  before insert or update of status on public.applications
  for each row execute function public.applications_enforce_capacity();

create or replace function public.applications_sync_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid := coalesce(new.event_id, old.event_id);
begin
  update public.events e
     set approved_count = (
       select count(*) from public.applications a
        where a.event_id = v_event_id and a.status in ('approved', 'attended')
     )
   where e.id = v_event_id;
  return null;
end;
$$;

create trigger applications_sync_count
  after insert or delete or update of status on public.applications
  for each row execute function public.applications_sync_count();

-- Outbox rows for application events; the send-push edge function delivers them.
create or replace function public.applications_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_name text;
begin
  if public.is_seeding() then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.status = old.status then
    return null;
  end if;

  select * into v_event from public.events where id = new.event_id;
  select name into v_name from public.profiles where id = new.user_id;

  -- New (or renewed) application → tell the host.
  if new.status in ('pending', 'approved')
     and (tg_op = 'INSERT' or old.status in ('cancelled')) then
    insert into public.notifications (user_id, event_id, type, data)
    values (v_event.host_id, v_event.id, 'application_received', jsonb_build_object(
      'event_title', v_event.title,
      'applicant_name', v_name,
      'application_id', new.id,
      'auto_approved', new.status = 'approved'
    ));
  -- Host decided → tell the walker.
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status in ('approved', 'rejected') then
    insert into public.notifications (user_id, event_id, type, data)
    values (new.user_id, v_event.id, 'application_' || new.status::text,
            jsonb_build_object('event_title', v_event.title));
  end if;
  return null;
end;
$$;

create trigger applications_notify
  after insert or update of status on public.applications
  for each row execute function public.applications_notify();

-- Reviews always point at the event's real host.
create or replace function public.reviews_set_host()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select host_id into new.host_id from public.events where id = new.event_id;
  return new;
end;
$$;

create trigger reviews_set_host
  before insert on public.reviews
  for each row execute function public.reviews_set_host();

-- ---------------------------------------------------------------------------
-- Application RPCs (the only write path for walkers and hosts)
-- ---------------------------------------------------------------------------
create or replace function public.apply_to_event(p_event_id uuid, p_message text default null)
returns public.applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_event public.events;
  v_app public.applications;
  v_status public.application_status;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_event from public.events where id = p_event_id for update;
  if not found or v_event.status <> 'published' then
    raise exception 'event_not_open' using errcode = 'P0001';
  end if;
  if v_event.start_at <= now() then
    raise exception 'event_started' using errcode = 'P0001';
  end if;
  if v_event.host_id = v_uid then
    raise exception 'own_event' using errcode = 'P0001';
  end if;
  if v_event.approved_count >= v_event.capacity then
    raise exception 'event_full' using errcode = 'P0001';
  end if;

  v_status := case when v_event.approval_mode = 'auto' then 'approved' else 'pending' end;

  select * into v_app from public.applications
   where event_id = p_event_id and user_id = v_uid
   for update;

  if found then
    if v_app.status in ('pending', 'approved', 'attended') then
      raise exception 'already_applied' using errcode = 'P0001';
    elsif v_app.status <> 'cancelled' then
      raise exception 'not_allowed' using errcode = 'P0001';
    end if;
    update public.applications
       set status = v_status,
           message = nullif(trim(p_message), ''),
           decided_at = case when v_status = 'approved' then now() end,
           created_at = now()
     where id = v_app.id
    returning * into v_app;
  else
    insert into public.applications (event_id, user_id, status, message, decided_at)
    values (p_event_id, v_uid, v_status, nullif(trim(p_message), ''),
            case when v_status = 'approved' then now() end)
    returning * into v_app;
  end if;

  return v_app;
end;
$$;

create or replace function public.decide_application(p_application_id uuid, p_approve boolean)
returns public.applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app public.applications;
  v_host uuid;
begin
  select * into v_app from public.applications where id = p_application_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  select host_id into v_host from public.events where id = v_app.event_id;
  if v_host is distinct from auth.uid() then
    raise exception 'not_host' using errcode = 'P0001';
  end if;
  if v_app.status <> 'pending' then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;

  update public.applications
     set status = case when p_approve then 'approved'::public.application_status
                       else 'rejected'::public.application_status end,
         decided_at = now()
   where id = p_application_id
  returning * into v_app;
  return v_app;
end;
$$;

create or replace function public.cancel_application(p_event_id uuid)
returns public.applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app public.applications;
  v_start timestamptz;
begin
  select * into v_app from public.applications
   where event_id = p_event_id and user_id = auth.uid()
   for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_app.status not in ('pending', 'approved') then
    raise exception 'not_cancellable' using errcode = 'P0001';
  end if;
  select start_at into v_start from public.events where id = p_event_id;
  if v_start <= now() then
    raise exception 'event_started' using errcode = 'P0001';
  end if;

  update public.applications set status = 'cancelled' where id = v_app.id
  returning * into v_app;
  return v_app;
end;
$$;

-- Host check-in. Allowed from 2 hours before the start.
create or replace function public.mark_attendance(p_application_id uuid, p_attended boolean)
returns public.applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app public.applications;
  v_event public.events;
begin
  select * into v_app from public.applications where id = p_application_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  select * into v_event from public.events where id = v_app.event_id;
  if v_event.host_id is distinct from auth.uid() then
    raise exception 'not_host' using errcode = 'P0001';
  end if;
  if v_event.start_at > now() + interval '2 hours' then
    raise exception 'too_early' using errcode = 'P0001';
  end if;
  if v_app.status not in ('approved', 'attended', 'no_show') then
    raise exception 'not_approved' using errcode = 'P0001';
  end if;

  update public.applications
     set status = case when p_attended then 'attended'::public.application_status
                       else 'no_show'::public.application_status end
   where id = p_application_id
  returning * into v_app;
  return v_app;
end;
$$;

create or replace function public.complete_event(p_event_id uuid)
returns public.events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
begin
  select * into v_event from public.events where id = p_event_id for update;
  if not found or v_event.host_id is distinct from auth.uid() then
    raise exception 'not_host' using errcode = 'P0001';
  end if;
  if v_event.status <> 'published' then
    raise exception 'not_published' using errcode = 'P0001';
  end if;
  if v_event.start_at > now() then
    raise exception 'too_early' using errcode = 'P0001';
  end if;
  update public.events set status = 'completed' where id = p_event_id returning * into v_event;
  return v_event;
end;
$$;

create or replace function public.cancel_event(p_event_id uuid)
returns public.events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
begin
  select * into v_event from public.events where id = p_event_id for update;
  if not found or v_event.host_id is distinct from auth.uid() then
    raise exception 'not_host' using errcode = 'P0001';
  end if;
  if v_event.status not in ('draft', 'published') then
    raise exception 'event_closed' using errcode = 'P0001';
  end if;
  update public.events set status = 'cancelled' where id = p_event_id returning * into v_event;
  return v_event;
end;
$$;

-- ---------------------------------------------------------------------------
-- Read helpers
-- ---------------------------------------------------------------------------

-- Public attendee list (avatars on the event page) without exposing applications.
create or replace function public.event_attendees(p_event_id uuid)
returns table (user_id uuid, name text, avatar_url text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name, p.avatar_url
    from public.applications a
    join public.profiles p on p.id = a.user_id
    join public.events e on e.id = a.event_id
   where a.event_id = p_event_id
     and a.status in ('approved', 'attended')
     and e.status <> 'draft'
   order by a.decided_at nulls last, a.created_at;
$$;

create or replace function public.profile_stats(p_user_id uuid)
returns table (events_attended int, events_hosted int, rating_avg numeric, rating_count int)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::int
       from public.applications a
       join public.events e on e.id = a.event_id
      where a.user_id = p_user_id
        and (a.status = 'attended' or (a.status = 'approved' and e.status = 'completed'))),
    (select count(*)::int from public.events
      where host_id = p_user_id and status in ('published', 'completed')),
    (select round(avg(rating)::numeric, 2) from public.reviews where host_id = p_user_id),
    (select count(*)::int from public.reviews where host_id = p_user_id);
$$;

-- Can the current user review this event?
create or replace function public.can_review(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.applications a
      join public.events e on e.id = a.event_id
     where a.event_id = p_event_id
       and a.user_id = auth.uid()
       and a.status in ('approved', 'attended')
       and e.status = 'completed'
  );
$$;

-- ---------------------------------------------------------------------------
-- search_events — one query for both the map and the list.
--
-- filters (all optional):
--   query            text   title / place / city / host name
--   categories       text[]
--   cities           text[]
--   date_from        timestamptz (default now())
--   date_to          timestamptz
--   price            'free' | 'paid'
--   price_min        numeric
--   price_max        numeric
--   difficulties     text[]
--   duration_min     int (minutes)
--   duration_max     int (minutes)
--   languages        text[]   (overlap)
--   women_only       boolean  (true = only women-only events)
--   family_friendly  boolean  (true = only family-friendly events)
--   seats_available  boolean
--   user_lat/user_lng           distance column + "nearest" sort
--   max_distance_km             radius around the user
--   bbox {west,south,east,north}  map viewport
--   center {lat,lng} + radius_km  alternative to bbox
--   sort             'soonest' | 'nearest' | 'popular'
--   limit, offset
-- ---------------------------------------------------------------------------
create or replace function public.search_events(filters jsonb default '{}'::jsonb)
returns table (
  id uuid,
  title text,
  category public.event_category,
  city text,
  city_name_en text,
  city_name_ar text,
  area text,
  meeting_address text,
  lat double precision,
  lng double precision,
  start_at timestamptz,
  end_at timestamptz,
  duration_minutes int,
  difficulty public.difficulty_level,
  distance_km numeric,
  price_egp numeric,
  capacity int,
  approved_count int,
  seats_left int,
  languages text[],
  women_only boolean,
  family_friendly boolean,
  approval_mode public.approval_mode,
  cover_url text,
  host_id uuid,
  host_name text,
  host_avatar_url text,
  host_verified boolean,
  host_rating numeric,
  distance_from_user_km double precision,
  is_featured boolean,
  total_count bigint
)
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  f jsonb := coalesce(filters, '{}'::jsonb);
  v_query text := nullif(trim(f ->> 'query'), '');
  v_like text;
  v_categories public.event_category[];
  v_cities text[];
  v_difficulties public.difficulty_level[];
  v_languages text[];
  v_date_from timestamptz := coalesce((f ->> 'date_from')::timestamptz, now());
  v_date_to timestamptz := (f ->> 'date_to')::timestamptz;
  v_price text := f ->> 'price';
  v_price_min numeric := (f ->> 'price_min')::numeric;
  v_price_max numeric := (f ->> 'price_max')::numeric;
  v_duration_min int := (f ->> 'duration_min')::int;
  v_duration_max int := (f ->> 'duration_max')::int;
  v_women_only boolean := coalesce((f ->> 'women_only')::boolean, false);
  v_family boolean := coalesce((f ->> 'family_friendly')::boolean, false);
  v_seats boolean := coalesce((f ->> 'seats_available')::boolean, false);
  v_user geography;
  v_max_km double precision := (f ->> 'max_distance_km')::double precision;
  v_bbox geography;
  v_center geography;
  v_radius_km double precision := (f ->> 'radius_km')::double precision;
  v_sort text := coalesce(f ->> 'sort', 'soonest');
  v_limit int := least(greatest(coalesce((f ->> 'limit')::int, 50), 1), 500);
  v_offset int := greatest(coalesce((f ->> 'offset')::int, 0), 0);
begin
  if v_query is not null then
    v_like := '%' || replace(replace(replace(v_query, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  if jsonb_typeof(f -> 'categories') = 'array' and jsonb_array_length(f -> 'categories') > 0 then
    v_categories := array(select jsonb_array_elements_text(f -> 'categories'))::public.event_category[];
  end if;
  if jsonb_typeof(f -> 'cities') = 'array' and jsonb_array_length(f -> 'cities') > 0 then
    v_cities := array(select jsonb_array_elements_text(f -> 'cities'));
  end if;
  if jsonb_typeof(f -> 'difficulties') = 'array' and jsonb_array_length(f -> 'difficulties') > 0 then
    v_difficulties := array(select jsonb_array_elements_text(f -> 'difficulties'))::public.difficulty_level[];
  end if;
  if jsonb_typeof(f -> 'languages') = 'array' and jsonb_array_length(f -> 'languages') > 0 then
    v_languages := array(select jsonb_array_elements_text(f -> 'languages'));
  end if;

  if f ? 'user_lat' and f ? 'user_lng' then
    v_user := st_point((f ->> 'user_lng')::float8, (f ->> 'user_lat')::float8, 4326)::geography;
  end if;
  if jsonb_typeof(f -> 'bbox') = 'object' then
    v_bbox := st_makeenvelope(
      (f -> 'bbox' ->> 'west')::float8, (f -> 'bbox' ->> 'south')::float8,
      (f -> 'bbox' ->> 'east')::float8, (f -> 'bbox' ->> 'north')::float8, 4326
    )::geography;
  end if;
  if jsonb_typeof(f -> 'center') = 'object' and v_radius_km is not null then
    v_center := st_point((f -> 'center' ->> 'lng')::float8, (f -> 'center' ->> 'lat')::float8, 4326)::geography;
  end if;

  return query
  with matched as (
    select e.*,
           c.name_en as c_name_en,
           c.name_ar as c_name_ar,
           p.name as p_name,
           p.avatar_url as p_avatar,
           p.host_verified as p_verified,
           case when v_user is not null
                then st_distance(e.meeting_point, v_user) / 1000.0 end as dist_km,
           coalesce(e.featured_until > now(), false) as featured
      from public.events e
      join public.profiles p on p.id = e.host_id
      join public.cities c on c.slug = e.city
     where e.status = 'published'
       and e.start_at >= v_date_from
       and (v_date_to is null or e.start_at < v_date_to)
       and (v_like is null
            or e.title ilike v_like
            or e.area ilike v_like
            or e.meeting_address ilike v_like
            or c.name_en ilike v_like
            or c.name_ar ilike v_like
            or p.name ilike v_like
            or exists (select 1 from public.event_stops s
                        where s.event_id = e.id and s.name ilike v_like))
       and (v_categories is null or e.category = any (v_categories))
       and (v_cities is null or e.city = any (v_cities))
       and (v_difficulties is null or e.difficulty = any (v_difficulties))
       and (v_languages is null or e.languages && v_languages)
       and (v_price is distinct from 'free' or e.price_egp = 0)
       and (v_price is distinct from 'paid' or e.price_egp > 0)
       and (v_price_min is null or e.price_egp >= v_price_min)
       and (v_price_max is null or e.price_egp <= v_price_max)
       and (v_duration_min is null or e.duration_minutes >= v_duration_min)
       and (v_duration_max is null or e.duration_minutes <= v_duration_max)
       and (not v_women_only or e.women_only)
       and (not v_family or e.family_friendly)
       and (not v_seats or e.approved_count < e.capacity)
       and (v_bbox is null or e.meeting_point && v_bbox)
       and (v_center is null or st_dwithin(e.meeting_point, v_center, v_radius_km * 1000))
       and (v_user is null or v_max_km is null or st_dwithin(e.meeting_point, v_user, v_max_km * 1000))
  )
  select m.id, m.title, m.category, m.city, m.c_name_en, m.c_name_ar, m.area, m.meeting_address,
         st_y(m.meeting_point::geometry), st_x(m.meeting_point::geometry),
         m.start_at, m.end_at, m.duration_minutes, m.difficulty, m.distance_km, m.price_egp,
         m.capacity, m.approved_count, greatest(m.capacity - m.approved_count, 0),
         m.languages, m.women_only, m.family_friendly, m.approval_mode, m.cover_url,
         m.host_id, m.p_name, m.p_avatar, m.p_verified,
         (select round(avg(r.rating)::numeric, 1) from public.reviews r where r.host_id = m.host_id),
         m.dist_km, m.featured,
         count(*) over ()
    from matched m
   order by
     m.featured desc,
     case when v_sort = 'nearest' then m.dist_km end asc nulls last,
     case when v_sort = 'popular' then m.approved_count end desc nulls last,
     m.start_at asc,
     m.id
   limit v_limit offset v_offset;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reminders (scheduled every 15 minutes by pg_cron — see supabase/cron.sql)
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_event_reminders()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int := 0;
  v_rows int;
begin
  insert into public.notifications (user_id, event_id, type, data)
  select a.user_id, e.id, 'event_reminder_24h', jsonb_build_object('event_title', e.title, 'start_at', e.start_at)
    from public.events e
    join public.applications a on a.event_id = e.id and a.status = 'approved'
   where e.status = 'published'
     and e.start_at > now() + interval '2 hours'
     and e.start_at <= now() + interval '24 hours'
  on conflict (user_id, event_id, type)
    where type in ('event_reminder_24h', 'event_reminder_2h') do nothing;
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  insert into public.notifications (user_id, event_id, type, data)
  select a.user_id, e.id, 'event_reminder_2h', jsonb_build_object('event_title', e.title, 'start_at', e.start_at)
    from public.events e
    join public.applications a on a.event_id = e.id and a.status = 'approved'
   where e.status = 'published'
     and e.start_at > now()
     and e.start_at <= now() + interval '2 hours'
  on conflict (user_id, event_id, type)
    where type in ('event_reminder_24h', 'event_reminder_2h') do nothing;
  get diagnostics v_rows = row_count;
  return v_count + v_rows;
end;
$$;

-- Events that ended more than 12 hours ago are completed automatically, which opens
-- reviews even if the host forgets to close the event (scheduled in supabase/cron.sql).
create or replace function public.auto_complete_events()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows int;
begin
  update public.events
     set status = 'completed'
   where status = 'published'
     and coalesce(end_at, start_at + make_interval(mins => duration_minutes)) < now() - interval '12 hours';
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;
