// Demo implementations of the app's backend calls. They mirror the rules enforced by the
// Postgres functions in supabase/migrations (apply_to_event, decide_application, …) and
// throw the same error codes, so the UI behaves identically.
import type { EventFormValues, EventStatus } from '@/features/events/schemas';
import { toRpcFilters, type SearchContext, type SearchFilters } from '@/features/search/filters';
import { haversineKm } from '@/lib/geo';

import {
  DEMO_PASSWORD,
  cities,
  delay,
  getDb,
  newId,
  persist,
  type DApplication,
  type DemoDb,
  type DEvent,
} from './store';

const fail = (code: string): never => {
  throw new Error(code);
};

const OCCUPYING = ['approved', 'attended'];

function approvedCount(db: DemoDb, eventId: string) {
  return db.applications.filter((a) => a.event_id === eventId && OCCUPYING.includes(a.status)).length;
}

function profile(db: DemoDb, id: string) {
  return db.profiles.find((p) => p.id === id);
}

function uid(db: DemoDb) {
  return db.session?.user_id ?? null;
}

function requireUser(db: DemoDb) {
  return uid(db) ?? fail('not_authenticated');
}

function hostRating(db: DemoDb, hostId: string) {
  const r = db.reviews.filter((x) => x.host_id === hostId);
  return r.length ? Math.round((r.reduce((s, x) => s + x.rating, 0) / r.length) * 10) / 10 : null;
}

function visible(db: DemoDb, e: DEvent) {
  return e.status !== 'draft' || e.host_id === uid(db);
}

function listItem(db: DemoDb, e: DEvent) {
  return {
    id: e.id,
    title: e.title,
    category: e.category,
    city: e.city,
    start_at: e.start_at,
    end_at: e.end_at,
    duration_minutes: e.duration_minutes,
    price_egp: e.price_egp,
    capacity: e.capacity,
    approved_count: approvedCount(db, e.id),
    status: e.status,
    cover_url: e.cover_url,
    approval_mode: e.approval_mode,
  };
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
type Listener = (userId: string | null) => void;
const listeners = new Set<Listener>();

export const auth = {
  async currentUserId() {
    return uid(await getDb());
  },
  onChange(fn: Listener) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  async signIn(email: string, password: string) {
    const db = await getDb();
    await delay(200);
    const acc = db.accounts.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
    if (!acc || acc.password !== password) fail('invalid_credentials');
    db.session = { user_id: acc!.user_id };
    await persist();
    listeners.forEach((l) => l(acc!.user_id));
  },
  async signUp(name: string, email: string, password: string) {
    const db = await getDb();
    await delay(200);
    if (db.accounts.some((a) => a.email.toLowerCase() === email.trim().toLowerCase())) fail('User already registered');
    const id = newId();
    db.accounts.push({ email: email.trim(), password, user_id: id });
    db.profiles.push({
      id,
      name: name.trim(),
      avatar_url: null,
      bio: null,
      city: null,
      languages: [],
      interests: [],
      is_host: false,
      host_verified: false,
      created_at: new Date().toISOString(),
    });
    db.session = { user_id: id };
    await persist();
    listeners.forEach((l) => l(id));
  },
  async signOut() {
    const db = await getDb();
    db.session = null;
    await persist();
    listeners.forEach((l) => l(null));
  },
  demoPassword: DEMO_PASSWORD,
};

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------
export async function searchEvents(filters: SearchFilters, ctx: SearchContext) {
  const db = await getDb();
  await delay();
  const f = toRpcFilters(filters, ctx);
  const from = f.date_from ? new Date(f.date_from) : new Date();
  const to = f.date_to ? new Date(f.date_to) : null;
  const q = f.query?.toLowerCase();
  const user = f.user_lat != null && f.user_lng != null ? { lat: f.user_lat, lng: f.user_lng } : null;

  const rows = db.events
    .filter((e) => e.status === 'published')
    .map((e) => {
      const host = profile(db, e.host_id)!;
      const city = cities.find((c) => c.slug === e.city)!;
      const count = approvedCount(db, e.id);
      const dist = user ? haversineKm(user, { lat: e.meeting_lat, lng: e.meeting_lng }) : null;
      return { e, host, city, count, dist };
    })
    .filter(({ e, host, city, count, dist }) => {
      const start = new Date(e.start_at);
      if (start < from || (to && start >= to)) return false;
      if (q) {
        const stops = db.stops.filter((s) => s.event_id === e.id).map((s) => s.name);
        const hay = [e.title, e.area, e.meeting_address, city.name_en, city.name_ar, host.name, ...stops];
        if (!hay.some((h) => h?.toLowerCase().includes(q))) return false;
      }
      if (f.categories && !f.categories.includes(e.category)) return false;
      if (f.cities && !f.cities.includes(e.city)) return false;
      if (f.difficulties && !f.difficulties.includes(e.difficulty)) return false;
      if (f.languages && !e.languages.some((l) => f.languages!.includes(l))) return false;
      if (f.price === 'free' && e.price_egp !== 0) return false;
      if (f.price === 'paid' && e.price_egp <= 0) return false;
      if (f.price_min != null && e.price_egp < f.price_min) return false;
      if (f.price_max != null && e.price_egp > f.price_max) return false;
      if (f.duration_min != null && e.duration_minutes < f.duration_min) return false;
      if (f.duration_max != null && e.duration_minutes > f.duration_max) return false;
      if (f.women_only && !e.women_only) return false;
      if (f.family_friendly && !e.family_friendly) return false;
      if (f.seats_available && count >= e.capacity) return false;
      if (f.bbox) {
        const b = f.bbox;
        if (e.meeting_lat < b.south || e.meeting_lat > b.north || e.meeting_lng < b.west || e.meeting_lng > b.east) return false;
      }
      if (f.max_distance_km != null && dist != null && dist > f.max_distance_km) return false;
      return true;
    })
    .sort((a, b) => {
      if (f.sort === 'nearest' && a.dist != null && b.dist != null && a.dist !== b.dist) return a.dist - b.dist;
      if (f.sort === 'popular' && a.count !== b.count) return b.count - a.count;
      return a.e.start_at.localeCompare(b.e.start_at);
    });

  const page = rows.slice(f.offset, f.offset + f.limit).map(({ e, host, city, count, dist }) => ({
    id: e.id,
    title: e.title,
    category: e.category,
    city: e.city,
    city_name_en: city.name_en,
    city_name_ar: city.name_ar,
    area: e.area,
    meeting_address: e.meeting_address,
    lat: e.meeting_lat,
    lng: e.meeting_lng,
    start_at: e.start_at,
    end_at: e.end_at,
    duration_minutes: e.duration_minutes,
    difficulty: e.difficulty,
    distance_km: e.distance_km,
    price_egp: e.price_egp,
    capacity: e.capacity,
    approved_count: count,
    seats_left: Math.max(e.capacity - count, 0),
    languages: e.languages,
    women_only: e.women_only,
    family_friendly: e.family_friendly,
    approval_mode: e.approval_mode,
    cover_url: e.cover_url,
    host_id: host.id,
    host_name: host.name,
    host_avatar_url: host.avatar_url,
    host_verified: host.host_verified,
    host_rating: hostRating(db, host.id),
    distance_from_user_km: dist,
    is_featured: false,
    total_count: rows.length,
  }));
  return page;
}

export async function getCities() {
  return cities;
}

// ---------------------------------------------------------------------------
// Event page
// ---------------------------------------------------------------------------
export async function getEvent(id: string) {
  const db = await getDb();
  await delay();
  const e = db.events.find((x) => x.id === id);
  if (!e || !visible(db, e)) return null;
  const host = profile(db, e.host_id)!;
  return {
    ...e,
    approved_count: approvedCount(db, e.id),
    host: { id: host.id, name: host.name, avatar_url: host.avatar_url, host_verified: host.host_verified },
    city_info: cities.find((c) => c.slug === e.city)!,
    photos: db.photos.filter((p) => p.event_id === id).map(({ id: pid, url, sort_order }) => ({ id: pid, url, sort_order })),
    stops: db.stops.filter((s) => s.event_id === id).map(({ id: sid, name, lat, lng, sort_order }) => ({ id: sid, name, lat, lng, sort_order })),
  };
}

export async function getAttendees(eventId: string) {
  const db = await getDb();
  return db.applications
    .filter((a) => a.event_id === eventId && OCCUPYING.includes(a.status))
    .map((a) => {
      const p = profile(db, a.user_id)!;
      return { user_id: p.id, name: p.name, avatar_url: p.avatar_url };
    });
}

// ---------------------------------------------------------------------------
// Hosting
// ---------------------------------------------------------------------------
export async function getHostedEvents(hostId: string, statuses?: EventStatus[]) {
  const db = await getDb();
  await delay();
  return db.events
    .filter((e) => e.host_id === hostId && visible(db, e) && (!statuses || statuses.includes(e.status)))
    .sort((a, b) => b.start_at.localeCompare(a.start_at))
    .map((e) => listItem(db, e));
}

export async function saveEvent(params: {
  id?: string;
  hostId: string;
  values: EventFormValues;
  status: EventStatus;
  coverUrl: string | null;
  galleryUrls: string[];
}) {
  const db = await getDb();
  await delay(250);
  const me = requireUser(db);
  const { values: v, status } = params;
  const existing = params.id ? db.events.find((e) => e.id === params.id) : undefined;
  if (existing && existing.host_id !== me) fail('not_host');
  if (existing && ['cancelled', 'completed'].includes(existing.status) && status !== existing.status) fail('event_closed');
  if (status === 'published' && (!existing || existing.status !== 'published') && v.startAt <= new Date()) fail('start_in_past');
  if (existing && v.capacity < approvedCount(db, existing.id)) fail('events_not_overbooked');

  const row: DEvent = {
    id: existing?.id ?? newId(),
    host_id: me,
    title: v.title,
    description: v.description,
    category: v.category,
    city: v.city,
    area: v.area || null,
    meeting_lat: v.meetingPoint!.lat,
    meeting_lng: v.meetingPoint!.lng,
    meeting_address: v.meetingAddress,
    start_at: v.startAt.toISOString(),
    end_at: v.endAt
      ? v.endAt.toISOString()
      : v.category === 'multi_day_trip'
        ? new Date(v.startAt.getTime() + v.durationMinutes * 60000).toISOString()
        : null,
    duration_minutes: v.durationMinutes,
    difficulty: v.difficulty,
    distance_km: v.distanceKm,
    price_egp: v.priceEgp,
    includes: v.includes || null,
    capacity: v.capacity,
    languages: v.languages,
    women_only: v.womenOnly,
    family_friendly: v.familyFriendly,
    what_to_bring: v.whatToBring || null,
    cancellation_policy: v.cancellationPolicy || null,
    approval_mode: v.approvalMode,
    status,
    cover_url: params.coverUrl,
    created_at: existing?.created_at ?? new Date().toISOString(),
  };

  if (existing) db.events[db.events.indexOf(existing)] = row;
  else db.events.push(row);

  db.stops = db.stops.filter((s) => s.event_id !== row.id);
  v.stops.forEach((s, i) => db.stops.push({ id: newId(), event_id: row.id, name: s.name, lat: s.lat, lng: s.lng, sort_order: i + 1 }));
  db.photos = db.photos.filter((p) => p.event_id !== row.id);
  params.galleryUrls.forEach((url, i) => db.photos.push({ id: newId(), event_id: row.id, url, sort_order: i + 1 }));

  const me_profile = profile(db, me);
  if (me_profile) me_profile.is_host = true;
  await persist();
  return row.id;
}

function notify(_db: DemoDb, _userId: string, _type: string) {
  // Push notifications are not simulated in the demo.
}

function hostEvent(db: DemoDb, eventId: string) {
  const e = db.events.find((x) => x.id === eventId);
  if (!e || e.host_id !== uid(db)) fail('not_host');
  return e!;
}

export async function cancelEvent(eventId: string) {
  const db = await getDb();
  const e = hostEvent(db, eventId);
  if (!['draft', 'published'].includes(e.status)) fail('event_closed');
  e.status = 'cancelled';
  db.applications.filter((a) => a.event_id === eventId && ['pending', 'approved'].includes(a.status)).forEach((a) => notify(db, a.user_id, 'event_cancelled'));
  await persist();
}

export async function completeEvent(eventId: string) {
  const db = await getDb();
  const e = hostEvent(db, eventId);
  if (e.status !== 'published') fail('not_published');
  if (new Date(e.start_at) > new Date()) fail('too_early');
  e.status = 'completed';
  await persist();
}

export async function deleteDraft(eventId: string) {
  const db = await getDb();
  const e = hostEvent(db, eventId);
  if (e.status !== 'draft') return;
  db.events = db.events.filter((x) => x.id !== eventId);
  await persist();
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------
function appRow(a: DApplication) {
  const { id, event_id, user_id, status, message, created_at, decided_at } = a;
  return { id, event_id, user_id, status, message, created_at, decided_at };
}

export async function getMyApplication(eventId: string, userId: string) {
  const db = await getDb();
  const a = db.applications.find((x) => x.event_id === eventId && x.user_id === userId);
  return a ? appRow(a) : null;
}

export async function applyToEvent(eventId: string, message: string | null) {
  const db = await getDb();
  await delay(250);
  const me = requireUser(db);
  const e = db.events.find((x) => x.id === eventId);
  if (!e || e.status !== 'published') fail('event_not_open');
  if (new Date(e!.start_at) <= new Date()) fail('event_started');
  if (e!.host_id === me) fail('own_event');
  const existing = db.applications.find((a) => a.event_id === eventId && a.user_id === me);
  if (existing) {
    if (['pending', 'approved', 'attended'].includes(existing.status)) fail('already_applied');
    if (existing.status !== 'cancelled') fail('not_allowed');
  }
  if (approvedCount(db, eventId) >= e!.capacity) fail('event_full');

  const status = e!.approval_mode === 'auto' ? 'approved' : 'pending';
  const now = new Date().toISOString();
  const row: DApplication = existing ?? { id: newId(), event_id: eventId, user_id: me, status, message: null, created_at: now, decided_at: null };
  Object.assign(row, { status, message: message?.trim() || null, created_at: now, decided_at: status === 'approved' ? now : null });
  if (!existing) db.applications.push(row);
  notify(db, e!.host_id, 'application_received');
  await persist();
  return appRow(row);
}

export async function cancelApplication(eventId: string) {
  const db = await getDb();
  const me = requireUser(db);
  const a = db.applications.find((x) => x.event_id === eventId && x.user_id === me) ?? fail('not_found');
  if (!['pending', 'approved'].includes(a.status)) fail('not_cancellable');
  const e = db.events.find((x) => x.id === eventId)!;
  if (new Date(e.start_at) <= new Date()) fail('event_started');
  a.status = 'cancelled';
  await persist();
  return appRow(a);
}

export async function decideApplication(applicationId: string, approve: boolean) {
  const db = await getDb();
  await delay();
  const a = db.applications.find((x) => x.id === applicationId) ?? fail('not_found');
  const e = hostEvent(db, a.event_id);
  if (a.status !== 'pending') fail('not_pending');
  if (approve && approvedCount(db, e.id) >= e.capacity) fail('event_full');
  a.status = approve ? 'approved' : 'rejected';
  a.decided_at = new Date().toISOString();
  notify(db, a.user_id, `application_${a.status}`);
  await persist();
  return appRow(a);
}

export async function markAttendance(applicationId: string, attended: boolean) {
  const db = await getDb();
  const a = db.applications.find((x) => x.id === applicationId) ?? fail('not_found');
  const e = hostEvent(db, a.event_id);
  if (new Date(e.start_at).getTime() > Date.now() + 2 * 3600_000) fail('too_early');
  if (!['approved', 'attended', 'no_show'].includes(a.status)) fail('not_approved');
  if (attended && a.status === 'no_show' && approvedCount(db, e.id) >= e.capacity) fail('event_full');
  a.status = attended ? 'attended' : 'no_show';
  await persist();
  return appRow(a);
}

export async function getApplicants(eventId: string) {
  const db = await getDb();
  await delay();
  hostEvent(db, eventId);
  return db.applications
    .filter((a) => a.event_id === eventId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((a) => {
      const p = profile(db, a.user_id)!;
      return { ...appRow(a), user: { id: p.id, name: p.name, avatar_url: p.avatar_url, city: p.city } };
    });
}

export async function getMyTrips(userId: string) {
  const db = await getDb();
  await delay();
  return db.applications
    .filter((a) => a.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((a) => ({ ...appRow(a), event: listItem(db, db.events.find((e) => e.id === a.event_id)!) }));
}

export async function getPendingCounts(eventIds: string[]) {
  const db = await getDb();
  return db.applications
    .filter((a) => eventIds.includes(a.event_id) && a.status === 'pending')
    .reduce<Record<string, number>>((acc, a) => {
      acc[a.event_id] = (acc[a.event_id] ?? 0) + 1;
      return acc;
    }, {});
}

// ---------------------------------------------------------------------------
// Saved
// ---------------------------------------------------------------------------
export async function getSavedEvents(userId: string) {
  const db = await getDb();
  return db.saved
    .filter((s) => s.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .flatMap((s) => {
      const e = db.events.find((x) => x.id === s.event_id);
      return e && visible(db, e) ? [listItem(db, e)] : [];
    });
}

export async function setSaved(userId: string, eventId: string, saved: boolean) {
  const db = await getDb();
  db.saved = db.saved.filter((s) => !(s.user_id === userId && s.event_id === eventId));
  if (saved) db.saved.push({ user_id: userId, event_id: eventId, created_at: new Date().toISOString() });
  await persist();
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------
export async function getProfile(id: string) {
  const db = await getDb();
  await delay();
  return profile(db, id) ?? null;
}

export async function getProfileStats(id: string) {
  const db = await getDb();
  const reviews = db.reviews.filter((r) => r.host_id === id);
  return {
    events_attended: db.applications.filter((a) => {
      const e = db.events.find((x) => x.id === a.event_id);
      return a.user_id === id && (a.status === 'attended' || (a.status === 'approved' && e?.status === 'completed'));
    }).length,
    events_hosted: db.events.filter((e) => e.host_id === id && ['published', 'completed'].includes(e.status)).length,
    rating_avg: reviews.length ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 100) / 100 : null,
    rating_count: reviews.length,
  };
}

export async function updateProfile(
  id: string,
  values: { name: string; bio: string; city: string | null; languages: string[]; interests: string[] },
  avatarUrl?: string,
) {
  const db = await getDb();
  if (uid(db) !== id) fail('not_allowed');
  const p = profile(db, id) ?? fail('not_found');
  Object.assign(p, { name: values.name, bio: values.bio || null, city: values.city, languages: values.languages, interests: values.interests });
  if (avatarUrl) p.avatar_url = avatarUrl;
  await persist();
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------
function reviewRow(db: DemoDb, r: DemoDb['reviews'][number]) {
  const p = profile(db, r.reviewer_id)!;
  const e = db.events.find((x) => x.id === r.event_id);
  return {
    id: r.id,
    event_id: r.event_id,
    rating: r.rating,
    comment: r.comment,
    created_at: r.created_at,
    reviewer: { id: p.id, name: p.name, avatar_url: p.avatar_url },
    event: e ? { id: e.id, title: e.title } : null,
  };
}

export async function getEventReviews(eventId: string) {
  const db = await getDb();
  return db.reviews.filter((r) => r.event_id === eventId).sort((a, b) => b.created_at.localeCompare(a.created_at)).map((r) => reviewRow(db, r));
}

export async function getHostReviews(hostId: string) {
  const db = await getDb();
  return db.reviews.filter((r) => r.host_id === hostId).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 30).map((r) => reviewRow(db, r));
}

export async function canReview(eventId: string) {
  const db = await getDb();
  const me = uid(db);
  const e = db.events.find((x) => x.id === eventId);
  return Boolean(
    me && e?.status === 'completed' && db.applications.some((a) => a.event_id === eventId && a.user_id === me && OCCUPYING.includes(a.status)),
  );
}

export async function getMyReview(eventId: string, reviewerId: string) {
  const db = await getDb();
  const r = db.reviews.find((x) => x.event_id === eventId && x.reviewer_id === reviewerId);
  return r ? reviewRow(db, r) : null;
}

export async function submitReview(eventId: string, reviewerId: string, values: { rating: number; comment: string }, existingId?: string) {
  const db = await getDb();
  await delay();
  if (!(await canReview(eventId))) fail('new row violates row-level security policy');
  const existing = existingId ? db.reviews.find((r) => r.id === existingId && r.reviewer_id === reviewerId) : undefined;
  if (existing) {
    existing.rating = values.rating;
    existing.comment = values.comment || null;
  } else {
    const e = db.events.find((x) => x.id === eventId)!;
    db.reviews.push({ id: newId(), event_id: eventId, reviewer_id: reviewerId, host_id: e.host_id, rating: values.rating, comment: values.comment || null, created_at: new Date().toISOString() });
  }
  await persist();
}
