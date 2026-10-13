# Masar · مسار

Masar is a community app for group walks, heritage tours, nature trips and city trips in Egypt. Hosts publish events. Walkers find them on a map or in a list, filter them, and apply.

**Try it in your browser:** https://hisham0hamza.github.io/Hisam-portfilio/ (demo mode: sample data stored in your browser; tap a demo account on the sign-in screen).

**Status:** Phase 1 (MVP) is built. Phases 2–4 have reserved tables in the database (see [Roadmap](#roadmap)).

| | |
|---|---|
| App | React Native + Expo SDK 57 (TypeScript strict), Expo Router |
| Backend | Supabase: Postgres + PostGIS, Auth, Storage, Edge Functions |
| Data | TanStack Query, Zod at every API boundary |
| Maps | react-native-maps, clustering with supercluster, Mapbox or device geocoder |
| i18n | i18next + expo-localization; Arabic (RTL) and English, defaulting to the device language |

---

## Project structure

```
src/
  app/                      Expo Router routes (screens)
    (tabs)/                 Explore · My Trips · Host · Profile
    event/[id]/             event page, edit, applicants, attendance (check-in), review
    event/new.tsx           create event
    user/[id].tsx           public profile
    sign-in / sign-up / phone / auth/callback
  components/
    ui/                     design system: Text, Button, Chip, Sheet, TextField, DateField, StateView…
    events/                 EventCard (list), EventPreviewCard (map), EventRow
    map/                    EventMap (clustered), MiniMap, LocationPicker, pins
  features/                 one folder per domain: api.ts (Supabase + Zod), hooks.ts (TanStack Query)
    auth/ events/ applications/ search/ profiles/ reviews/ saved/ notifications/
  i18n/                     i18next setup, en.ts / ar.ts (keys are type-checked)
  lib/                      supabase client, env, geo + clustering, images (compress + upload), formatting
  theme/                    tokens (colors, spacing, typography), light/dark ThemeProvider
supabase/
  migrations/               schema, functions/RPCs, RLS, storage, reserved Phase 2–4 tables
  seed.sql                  6 hosts, 8 walkers, 26 events, applications, reviews
  functions/send-push/      Edge Function: notification outbox → Expo push
  cron.sql                  pg_cron jobs (reminders, auto-complete, push delivery)
  tests/                    DB tests: search_events, capacity/concurrency, RLS, reviews
```

## Data model

All tables have Row Level Security enabled.

- `profiles`: one per auth user, created by a trigger. `host_verified` and `is_admin` can only be changed by an admin (column-level grants).
- `events`: `meeting_point geography(Point)`, with generated `meeting_lat` and `meeting_lng` columns. `approved_count` is maintained by a trigger, so seats left = `capacity − approved_count`.
- `event_photos`, `event_stops` (ordered route), `applications` (unique per event + user), `reviews`, `saved_events`
- `cities`: a lookup with English and Arabic names, so a search for "القاهرة" or "Cairo" finds the same events.
- `notifications` (an outbox) and `push_tokens`
- Reserved for later phases: `payments`, `host_ledger`, `host_subscriptions`, `chat_messages`, `badges`, `user_badges`, `follows`, `partners`, `perks`, `event_wall_photos`, `reports`, `emergency_contacts`, `referral_codes`, `app_settings` (commission = 12%)

**Key database functions**

| Function | Purpose |
|---|---|
| `search_events(filters jsonb)` | One query for **both** map and list. It takes text search (title, area, address, city in either language, host name, stop names), every filter, a `bbox` or `center + radius_km`, and `user_lat/lng` + `max_distance_km`, and sorts by soonest, nearest or popular. Uses PostGIS with GIST/btree/trigram indexes. |
| `apply_to_event`, `decide_application`, `cancel_application`, `mark_attendance` | The only write path for applications. A row lock on the event plus a capacity trigger mean an event can't be overbooked, even under concurrent requests. |
| `complete_event`, `cancel_event` | Host status changes. Cancelling notifies everyone who applied. |
| `event_attendees`, `profile_stats`, `can_review` | Safe public reads. Avatars on the event page don't expose applications. |
| `enqueue_event_reminders`, `auto_complete_events` | Scheduled jobs: 24 h / 2 h reminders, and closing events that have ended. |

**RLS summary:** anyone can read published, cancelled and completed events (drafts are visible only to their host). Only the host can edit their events, photos and stops. Users see their own applications, and hosts see applications to their events. Only approved or attended walkers of a **completed** event can review it.

---

## Setup

### 1. Prerequisites

- Node 20+ and npm
- A Supabase project (free tier is fine), **or** the Supabase CLI + Docker for local development
- The **Expo Go** app on your phone (iOS or Android)

### 2. Supabase: database, seed, storage

**Option A: hosted Supabase project**

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push            # runs supabase/migrations/* (enables PostGIS, creates buckets)
```

Then seed the sample data. Either paste `supabase/seed.sql` into **Dashboard → SQL Editor** and run it, or:

```bash
psql "<connection string from Dashboard → Connect>" -f supabase/seed.sql
```

**Option B: local Supabase**

```bash
npx supabase start              # needs Docker
npx supabase db reset           # applies migrations and runs supabase/seed.sql
```

The local API URL and anon key are printed by `supabase start`. Studio runs at http://localhost:54323.

### 3. Auth providers

In **Dashboard → Authentication**:

- **URL configuration:** add `masar://auth/callback` and `exp://**` to *Redirect URLs*.
- **Email:** on by default. To skip email confirmation while testing, turn off *Confirm email*.
- **Phone (OTP):** enable the Phone provider and connect an SMS provider (Twilio, MessageBird, Vonage…). For local testing, `supabase/config.toml` defines the test number `+201000000000` with code `123456`.
- **Google:** create an OAuth client in Google Cloud. Add `https://<project-ref>.supabase.co/auth/v1/callback` as its redirect URI, then paste the client ID and secret into the Google provider.

### 4. Run the app

```bash
cp .env.example .env            # fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
npm install
npx expo start                  # scan the QR code with Expo Go
```

Sign in with any demo account (password **`masar-demo-123`**):

| Role | Email |
|---|---|
| Verified heritage host | `nour@masar.demo` |
| Photo-walk host (women-only events) | `salma@masar.demo` |
| Food host | `karim@masar.demo` |
| Hiking host (Wadi Degla, Sinai) | `youssef@masar.demo` |
| Alexandria host (not verified yet) | `mariam@masar.demo` |
| Siwa / Fayoum host | `omar@masar.demo` |
| Walker who can leave a review | `ahmed@masar.demo` |
| Walkers | `laila@`, `hana@`, `mahmoud@`, `sara@`, `tarek@`, `dina@`, `ali@masar.demo` |

**Verify a host** (admin approval, until the Phase 4 admin dashboard exists):

```sql
update public.profiles set host_verified = true where id = '<user id>';
```

### 5. Push notifications (optional for local testing)

1. `npx eas-cli init` to create an EAS project. Put its id in `EXPO_PUBLIC_EAS_PROJECT_ID`.
2. `npx supabase functions deploy send-push`
3. Enable `pg_cron` and `pg_net`, store `project_url` and `service_role_key` in Vault, then run `supabase/cron.sql` in the SQL editor (instructions are at the top of the file).

Remote push needs a **development build** on Android (`npx expo run:android` or `eas build --profile development`), because Expo Go no longer supports push there. Without push, the rest of the app works the same. Notifications are still written to the `notifications` table.

### 6. Production builds

- Android maps need a Google Maps API key in `app.json` → `android.config.googleMaps.apiKey`.
- `EXPO_PUBLIC_MAPBOX_TOKEN` enables Mapbox place search in the meeting-point picker. Without it, the app uses the device geocoder.
- `EXPO_PUBLIC_SHARE_BASE_URL` turns share links into `https://…/event/<id>` (otherwise `masar://event/<id>`).

---

## Web app

The same codebase runs in the browser (React Native Web). Maps use Leaflet with OpenStreetMap/CARTO tiles, date fields use the browser's pickers, and dialogs use the browser's alert/confirm.

```bash
npx expo start --web                                                  # local dev
WEB_BASE_URL=/Hisam-portfilio npx expo export --platform web          # static build in dist/
```

`.github/workflows/deploy-web.yml` builds and publishes it to GitHub Pages on every push.

**Demo mode.** If Supabase isn't configured (no `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`), the app runs on a built-in demo backend (`src/features/demo/`). It loads the seed data and keeps everything testers do in browser storage. It applies the same rules as the database functions: capacity, approvals, cancellations, and reviews only by attendees. Profile → Settings → *Reset demo data* starts over. Push notifications, phone and Google sign-in aren't available in demo mode.

To point the hosted site at your Supabase project, add the repository secrets `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (Settings → Secrets and variables → Actions) and re-run the *Deploy web app* workflow. Also add `https://hisham0hamza.github.io/Hisam-portfilio/**` to Supabase → Authentication → Redirect URLs.

## Design assets

- **Background:** an original Pharaonic tile (lotus, papyrus, ankh, Eye of Horus, stars, Nile water lines) drawn in `src/theme/pattern.ts`. Web uses the SVG directly; native uses PNG tiles rendered by `node scripts/render-pattern.mjs`.
- **Event photos:** freely licensed photos of each place from Wikimedia Commons in `public/images/events/`, with author and licence in [`CREDITS.md`](public/images/events/CREDITS.md). They're fetched by `scripts/fetch-event-photos.mjs`, which runs in GitHub Actions whenever the script changes. The site serves them from GitHub Pages, and the seed data points there.

## Tests and checks

```bash
npm run typecheck      # tsc --noEmit (strict); unknown translation keys are type errors
npm run lint           # eslint-config-expo
npm run test:unit      # filters → RPC payload, date presets (Fri/Sat weekend), clustering, apply-state logic
npm run test:db        # needs TEST_DATABASE_URL (any Postgres 15+ with PostGIS)
```

The DB tests load the migrations and seed into a throwaway database. They cover:

- **`search_events`:** text search (including Arabic city names, host names and stop names), every filter, empty-array handling, bbox, center+radius, distance limits, sorting (nearest, popular), pagination, and hiding drafts and cancelled events.
- **Applications and capacity:** auto/manual approval, duplicate applications, host-only decisions, service-role writes, **concurrent applicants racing for the last seats** (8 parallel connections, 3 seats), cancel and re-apply, and refusing to shrink capacity below approved seats.
- **RLS:** no direct writes to applications, private application visibility, no self-verification, editing only your own events, and the public attendee list.
- **Reviews:** only attendees of completed events can review, no-shows are excluded, and the host can't be spoofed.
- **Notifications:** outbox rows for applications and decisions, cancellation notices, and reminders sent at most once.

With the Supabase CLI running locally: `TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres npm run test:db`. CI (`.github/workflows/ci.yml`) runs everything against `postgis/postgis:16-3.4`.

---

## Accessibility and RTL

- Every interactive element has a role and label, and live regions announce result counts and errors. Touch targets are at least 44 pt, text scales with the system font size (capped at 1.8×), and color tokens meet AA contrast in light and dark mode.
- Layout uses `start`/`end` and row flipping, so it mirrors correctly in Arabic. Directional icons (chevrons) flip too. Changing the language in Profile → Settings switches the layout direction and restarts the app.

---

## Roadmap

**Phase 2: Monetize** (tables already exist)

- Paymob (cards and wallets) and Fawry checkout through an Edge Function. Write `payments` rows, take `app_settings.commission_rate` (12%), and credit hosts in `host_ledger`.
- Refundable deposit for free events (`events.deposit_egp`) to reduce no-shows.
- Host Pro (`host_subscriptions`, `pro_commission_rate`), with analytics and unlimited events.
- Featured events: `events.featured_until` is already used by `search_events` to rank boosted events first and highlight their map pins.
- Group chat per event over Supabase Realtime (`chat_messages`, RLS limited to the host and approved attendees).
- QR check-in using the per-application `checkin_code`.

**Phase 3: Engage:** km walked, badges and streaks, a photo wall, following hosts, partner perks on the map, referral codes, live-location sharing, emergency contacts, and reports.

**Phase 4: Expand:** multi-day itineraries, self-guided audio routes, corporate packages, and a Next.js admin dashboard (verify hosts, moderate content, KPIs).
