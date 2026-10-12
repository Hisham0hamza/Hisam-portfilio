-- Masar — Row Level Security and grants.
-- Every table has RLS enabled. Writes that need cross-row checks (applications,
-- attendance, status changes) go through SECURITY DEFINER RPCs instead of policies.

alter table public.cities enable row level security;
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_photos enable row level security;
alter table public.event_stops enable row level security;
alter table public.applications enable row level security;
alter table public.reviews enable row level security;
alter table public.saved_events enable row level security;
alter table public.push_tokens enable row level security;
alter table public.notifications enable row level security;
alter table public.app_settings enable row level security;

-- Helper used by several policies.
create or replace function public.is_event_host(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.events where id = p_event_id and host_id = auth.uid());
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------------
-- cities / app_settings: public read-only
-- ---------------------------------------------------------------------------
create policy "cities are public" on public.cities for select using (true);
create policy "settings are public" on public.app_settings for select using (true);

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "profiles are public" on public.profiles for select using (true);
create policy "users update own profile" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- host_verified / is_admin are only changeable by admins (service role or SQL).
revoke update on public.profiles from anon, authenticated;
grant update (name, avatar_url, bio, city, languages, interests, is_host)
  on public.profiles to authenticated;
revoke insert, delete on public.profiles from anon, authenticated;

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
create policy "published events are public" on public.events for select
  using (status <> 'draft' or host_id = auth.uid());
create policy "hosts create events" on public.events for insert to authenticated
  with check (host_id = auth.uid());
create policy "hosts update own events" on public.events for update to authenticated
  using (host_id = auth.uid()) with check (host_id = auth.uid());
create policy "hosts delete own drafts" on public.events for delete to authenticated
  using (host_id = auth.uid() and status = 'draft');

-- approved_count and featured_until are system-managed.
revoke insert, update on public.events from anon, authenticated;
grant insert (host_id, title, description, category, city, area, meeting_point, meeting_address,
              start_at, end_at, duration_minutes, difficulty, distance_km, price_egp, includes,
              capacity, languages, women_only, family_friendly, what_to_bring,
              cancellation_policy, approval_mode, status, cover_url)
  on public.events to authenticated;
grant update (title, description, category, city, area, meeting_point, meeting_address,
              start_at, end_at, duration_minutes, difficulty, distance_km, price_egp, includes,
              capacity, languages, women_only, family_friendly, what_to_bring,
              cancellation_policy, approval_mode, status, cover_url)
  on public.events to authenticated;

-- ---------------------------------------------------------------------------
-- event_photos / event_stops: readable with the event, writable by its host
-- ---------------------------------------------------------------------------
create policy "photos readable with event" on public.event_photos for select
  using (exists (select 1 from public.events e where e.id = event_id));
create policy "hosts manage photos" on public.event_photos for all to authenticated
  using (public.is_event_host(event_id)) with check (public.is_event_host(event_id));

create policy "stops readable with event" on public.event_stops for select
  using (exists (select 1 from public.events e where e.id = event_id));
create policy "hosts manage stops" on public.event_stops for all to authenticated
  using (public.is_event_host(event_id)) with check (public.is_event_host(event_id));

-- ---------------------------------------------------------------------------
-- applications: own rows + rows for events you host. Writes only via RPC.
-- ---------------------------------------------------------------------------
create policy "users see own applications" on public.applications for select to authenticated
  using (user_id = auth.uid());
create policy "hosts see applications to their events" on public.applications for select to authenticated
  using (public.is_event_host(event_id));
revoke insert, update, delete on public.applications from anon, authenticated;

-- ---------------------------------------------------------------------------
-- reviews: public read; only approved/attended attendees of completed events write
-- ---------------------------------------------------------------------------
create policy "reviews are public" on public.reviews for select using (true);
create policy "attendees review completed events" on public.reviews for insert to authenticated
  with check (
    reviewer_id = auth.uid()
    and exists (
      select 1
        from public.applications a
        join public.events e on e.id = a.event_id
       where a.event_id = reviews.event_id
         and a.user_id = auth.uid()
         and a.status in ('approved', 'attended')
         and e.status = 'completed'
    )
  );
create policy "reviewers edit own review" on public.reviews for update to authenticated
  using (reviewer_id = auth.uid()) with check (reviewer_id = auth.uid());
create policy "reviewers delete own review" on public.reviews for delete to authenticated
  using (reviewer_id = auth.uid());
revoke update on public.reviews from anon, authenticated;
grant update (rating, comment) on public.reviews to authenticated;

-- ---------------------------------------------------------------------------
-- saved_events / push_tokens / notifications: private to the user
-- ---------------------------------------------------------------------------
create policy "users manage saved events" on public.saved_events for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "users manage push tokens" on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "users read own notifications" on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy "users mark notifications read" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, delete, update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ---------------------------------------------------------------------------
-- Function privileges: RPCs for signed-in users only; internals locked down.
-- ---------------------------------------------------------------------------
revoke execute on function public.apply_to_event(uuid, text) from public, anon;
revoke execute on function public.decide_application(uuid, boolean) from public, anon;
revoke execute on function public.cancel_application(uuid) from public, anon;
revoke execute on function public.mark_attendance(uuid, boolean) from public, anon;
revoke execute on function public.complete_event(uuid) from public, anon;
revoke execute on function public.cancel_event(uuid) from public, anon;
revoke execute on function public.can_review(uuid) from public, anon;
grant execute on function public.apply_to_event(uuid, text) to authenticated;
grant execute on function public.decide_application(uuid, boolean) to authenticated;
grant execute on function public.cancel_application(uuid) to authenticated;
grant execute on function public.mark_attendance(uuid, boolean) to authenticated;
grant execute on function public.complete_event(uuid) to authenticated;
grant execute on function public.cancel_event(uuid) to authenticated;
grant execute on function public.can_review(uuid) to authenticated;

grant execute on function public.search_events(jsonb) to anon, authenticated;
grant execute on function public.event_attendees(uuid) to anon, authenticated;
grant execute on function public.profile_stats(uuid) to anon, authenticated;

revoke execute on function public.enqueue_event_reminders() from public, anon, authenticated;
revoke execute on function public.auto_complete_events() from public, anon, authenticated;
