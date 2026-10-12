import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enums (mirror the Postgres enums)
// ---------------------------------------------------------------------------
export const CATEGORIES = [
  'heritage_walk',
  'nature_hike',
  'city_trip',
  'food_walk',
  'photo_walk',
  'multi_day_trip',
] as const;
export const DIFFICULTIES = ['easy', 'moderate', 'hard'] as const;
export const APPROVAL_MODES = ['auto', 'manual'] as const;
export const EVENT_STATUSES = ['draft', 'published', 'cancelled', 'completed'] as const;
export const APPLICATION_STATUSES = ['pending', 'approved', 'rejected', 'cancelled', 'attended', 'no_show'] as const;

/** Languages an event can be held in (ISO 639-1). */
export const EVENT_LANGUAGES = ['ar', 'en', 'fr', 'de', 'it', 'es', 'ru'] as const;

export const categorySchema = z.enum(CATEGORIES);
export const difficultySchema = z.enum(DIFFICULTIES);
export const approvalModeSchema = z.enum(APPROVAL_MODES);
export const eventStatusSchema = z.enum(EVENT_STATUSES);
export const applicationStatusSchema = z.enum(APPLICATION_STATUSES);

export type Category = z.infer<typeof categorySchema>;
export type Difficulty = z.infer<typeof difficultySchema>;
export type ApprovalMode = z.infer<typeof approvalModeSchema>;
export type EventStatus = z.infer<typeof eventStatusSchema>;
export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;

// Postgres numeric comes back as a string or number depending on the path.
const numeric = z.union([z.number(), z.string()]).transform((v) => Number(v));
const nullableNumeric = z
  .union([z.number(), z.string(), z.null()])
  .transform((v) => (v === null ? null : Number(v)));

// ---------------------------------------------------------------------------
// Search results (search_events RPC rows) — used by both map and list
// ---------------------------------------------------------------------------
export const eventSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  category: categorySchema,
  city: z.string(),
  city_name_en: z.string(),
  city_name_ar: z.string(),
  area: z.string().nullable(),
  meeting_address: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  start_at: z.string(),
  end_at: z.string().nullable(),
  duration_minutes: z.number(),
  difficulty: difficultySchema,
  distance_km: nullableNumeric,
  price_egp: numeric,
  capacity: z.number(),
  approved_count: z.number(),
  seats_left: z.number(),
  languages: z.array(z.string()),
  women_only: z.boolean(),
  family_friendly: z.boolean(),
  approval_mode: approvalModeSchema,
  cover_url: z.string().nullable(),
  host_id: z.string(),
  host_name: z.string(),
  host_avatar_url: z.string().nullable(),
  host_verified: z.boolean(),
  host_rating: nullableNumeric,
  distance_from_user_km: z.number().nullable(),
  is_featured: z.boolean(),
  total_count: numeric,
});
export type EventSummary = z.infer<typeof eventSummarySchema>;

// ---------------------------------------------------------------------------
// Event detail (events row + relations)
// ---------------------------------------------------------------------------
export const hostSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatar_url: z.string().nullable(),
  host_verified: z.boolean(),
});

export const eventPhotoSchema = z.object({
  id: z.string(),
  url: z.string(),
  sort_order: z.number(),
});

export const eventStopSchema = z.object({
  id: z.string(),
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
  sort_order: z.number(),
});

export const citySchema = z.object({
  slug: z.string(),
  name_en: z.string(),
  name_ar: z.string(),
});
export type City = z.infer<typeof citySchema>;

export const eventDetailSchema = z.object({
  id: z.string(),
  host_id: z.string(),
  title: z.string(),
  description: z.string(),
  category: categorySchema,
  city: z.string(),
  area: z.string().nullable(),
  meeting_lat: z.number(),
  meeting_lng: z.number(),
  meeting_address: z.string(),
  start_at: z.string(),
  end_at: z.string().nullable(),
  duration_minutes: z.number(),
  difficulty: difficultySchema,
  distance_km: nullableNumeric,
  price_egp: numeric,
  includes: z.string().nullable(),
  capacity: z.number(),
  approved_count: z.number(),
  languages: z.array(z.string()),
  women_only: z.boolean(),
  family_friendly: z.boolean(),
  what_to_bring: z.string().nullable(),
  cancellation_policy: z.string().nullable(),
  approval_mode: approvalModeSchema,
  status: eventStatusSchema,
  cover_url: z.string().nullable(),
  created_at: z.string(),
  host: hostSchema,
  city_info: citySchema,
  photos: z.array(eventPhotoSchema),
  stops: z.array(eventStopSchema),
});
export type EventDetail = z.infer<typeof eventDetailSchema>;
export type EventStop = z.infer<typeof eventStopSchema>;

export const EVENT_DETAIL_SELECT = `
  id, host_id, title, description, category, city, area, meeting_lat, meeting_lng, meeting_address,
  start_at, end_at, duration_minutes, difficulty, distance_km, price_egp, includes, capacity,
  approved_count, languages, women_only, family_friendly, what_to_bring, cancellation_policy,
  approval_mode, status, cover_url, created_at,
  host:profiles!events_host_id_fkey ( id, name, avatar_url, host_verified ),
  city_info:cities ( slug, name_en, name_ar ),
  photos:event_photos ( id, url, sort_order ),
  stops:event_stops ( id, name, lat, lng, sort_order )
`;

// Compact row used by "My Trips" / host lists.
export const eventListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: categorySchema,
  city: z.string(),
  start_at: z.string(),
  end_at: z.string().nullable(),
  duration_minutes: z.number(),
  price_egp: numeric,
  capacity: z.number(),
  approved_count: z.number(),
  status: eventStatusSchema,
  cover_url: z.string().nullable(),
  approval_mode: approvalModeSchema,
});
export type EventListItem = z.infer<typeof eventListItemSchema>;
export const EVENT_LIST_SELECT =
  'id, title, category, city, start_at, end_at, duration_minutes, price_egp, capacity, approved_count, status, cover_url, approval_mode';

// ---------------------------------------------------------------------------
// Event form (create / edit)
// ---------------------------------------------------------------------------
export const MAX_GALLERY_PHOTOS = 8;

export const latLngSchema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
export type LatLng = z.infer<typeof latLngSchema>;

export const stopInputSchema = z.object({
  name: z.string().trim().min(1, 'required').max(120),
  lat: z.number(),
  lng: z.number(),
});
export type StopInput = z.infer<typeof stopInputSchema>;

/** A photo in the form: either already uploaded (remote URL) or a local file to upload on save. */
export const formPhotoSchema = z.object({ uri: z.string(), remote: z.boolean() });
export type FormPhoto = z.infer<typeof formPhotoSchema>;

export const eventFormSchema = z
  .object({
    title: z.string().trim().min(3, 'too_short').max(120, 'too_long'),
    description: z.string().trim().min(20, 'too_short').max(5000, 'too_long'),
    category: categorySchema,
    city: z.string().min(1, 'required'),
    area: z.string().trim().max(80).optional().default(''),
    meetingPoint: latLngSchema.nullable().refine((v) => v !== null, 'pick_on_map'),
    meetingAddress: z.string().trim().min(3, 'required').max(200),
    stops: z.array(stopInputSchema).max(20),
    startAt: z.date(),
    endAt: z.date().nullable(),
    durationMinutes: z.number().int().min(15, 'too_short').max(60 * 24 * 30),
    difficulty: difficultySchema,
    distanceKm: z.number().min(0).max(1000).nullable(),
    priceEgp: z.number().min(0, 'invalid').max(100_000),
    includes: z.string().trim().max(500).optional().default(''),
    capacity: z.number().int().min(1, 'invalid').max(500, 'invalid'),
    languages: z.array(z.string()).min(1, 'required'),
    womenOnly: z.boolean(),
    familyFriendly: z.boolean(),
    whatToBring: z.string().trim().max(500).optional().default(''),
    cancellationPolicy: z.string().trim().max(500).optional().default(''),
    approvalMode: approvalModeSchema,
    cover: formPhotoSchema.nullable(),
    gallery: z.array(formPhotoSchema).max(MAX_GALLERY_PHOTOS, 'too_many'),
  })
  .superRefine((v, ctx) => {
    if (v.category === 'multi_day_trip' && !v.endAt) {
      ctx.addIssue({ code: 'custom', path: ['endAt'], message: 'required' });
    }
    if (v.endAt && v.endAt <= v.startAt) {
      ctx.addIssue({ code: 'custom', path: ['endAt'], message: 'end_before_start' });
    }
  });

export type EventFormInput = z.input<typeof eventFormSchema>;
export type EventFormValues = z.output<typeof eventFormSchema>;

/** Extra check applied only when publishing (drafts may be saved with a past date). */
export function publishIssues(v: EventFormValues, now = new Date()): string[] {
  const issues: string[] = [];
  if (v.startAt <= now) issues.push('startAt');
  return issues;
}

export function toPointWkt(p: LatLng) {
  return `SRID=4326;POINT(${p.lng} ${p.lat})`;
}
