// Search & filter model shared by the map and list views.
// Pure TypeScript (no React Native imports) so it can be unit-tested in Node.

import { z } from 'zod';

import { categorySchema, difficultySchema, type Category, type Difficulty } from '@/features/events/schemas';

export const DATE_PRESETS = ['any', 'today', 'weekend', 'week', 'custom'] as const;
export const PRICE_FILTERS = ['any', 'free', 'paid'] as const;
export const DURATION_PRESETS = ['any', 'short', 'half_day', 'full_day', 'multi_day'] as const;
export const SORT_OPTIONS = ['soonest', 'nearest', 'popular'] as const;
export const DISTANCE_OPTIONS_KM = [5, 10, 25, 50, 100] as const;

export type DatePreset = (typeof DATE_PRESETS)[number];
export type PriceFilter = (typeof PRICE_FILTERS)[number];
export type DurationPreset = (typeof DURATION_PRESETS)[number];
export type SortOption = (typeof SORT_OPTIONS)[number];

export const searchFiltersSchema = z.object({
  query: z.string().max(100),
  categories: z.array(categorySchema),
  cities: z.array(z.string()),
  datePreset: z.enum(DATE_PRESETS),
  /** yyyy-mm-dd, used when datePreset === 'custom' */
  dateFrom: z.string().nullable(),
  dateTo: z.string().nullable(),
  price: z.enum(PRICE_FILTERS),
  priceMin: z.number().min(0).nullable(),
  priceMax: z.number().min(0).nullable(),
  difficulties: z.array(difficultySchema),
  duration: z.enum(DURATION_PRESETS),
  maxDistanceKm: z.number().positive().nullable(),
  languages: z.array(z.string()),
  womenOnly: z.boolean(),
  familyFriendly: z.boolean(),
  seatsAvailable: z.boolean(),
  sort: z.enum(SORT_OPTIONS),
});
export type SearchFilters = z.infer<typeof searchFiltersSchema>;

export const defaultFilters: SearchFilters = {
  query: '',
  categories: [],
  cities: [],
  datePreset: 'any',
  dateFrom: null,
  dateTo: null,
  price: 'any',
  priceMin: null,
  priceMax: null,
  difficulties: [],
  duration: 'any',
  maxDistanceKm: null,
  languages: [],
  womenOnly: false,
  familyFriendly: false,
  seatsAvailable: false,
  sort: 'soonest',
};

// ---------------------------------------------------------------------------
// Date presets (local time). Egypt's weekend is Friday + Saturday.
// ---------------------------------------------------------------------------
function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function parseLocalDate(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toYmd(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dateRangeFor(
  f: Pick<SearchFilters, 'datePreset' | 'dateFrom' | 'dateTo'>,
  now: Date = new Date(),
): { from: Date | null; to: Date | null } {
  switch (f.datePreset) {
    case 'today':
      return { from: now, to: addDays(startOfDay(now), 1) };
    case 'weekend': {
      const day = now.getDay(); // 0 Sun … 5 Fri, 6 Sat
      if (day === 5 || day === 6) {
        const sunday = addDays(startOfDay(now), day === 5 ? 2 : 1);
        return { from: now, to: sunday };
      }
      const friday = addDays(startOfDay(now), (5 - day + 7) % 7);
      return { from: friday, to: addDays(friday, 2) };
    }
    case 'week':
      return { from: now, to: addDays(now, 7) };
    case 'custom': {
      const from = f.dateFrom ? parseLocalDate(f.dateFrom) : null;
      const to = f.dateTo ? addDays(parseLocalDate(f.dateTo), 1) : null;
      return { from: from && from < now ? now : from, to };
    }
    default:
      return { from: null, to: null };
  }
}

// ---------------------------------------------------------------------------
// Duration presets (minutes)
// ---------------------------------------------------------------------------
export function durationRangeFor(preset: DurationPreset): { min: number | null; max: number | null } {
  switch (preset) {
    case 'short':
      return { min: null, max: 120 };
    case 'half_day':
      return { min: 121, max: 300 };
    case 'full_day':
      return { min: 301, max: 1440 };
    case 'multi_day':
      return { min: 1441, max: null };
    default:
      return { min: null, max: null };
  }
}

// ---------------------------------------------------------------------------
// RPC payload
// ---------------------------------------------------------------------------
export type Bbox = { west: number; south: number; east: number; north: number };
export type LatLngLiteral = { lat: number; lng: number };

export type SearchContext = {
  now?: Date;
  userLocation?: LatLngLiteral | null;
  bbox?: Bbox | null;
  limit?: number;
  offset?: number;
};

export type RpcFilters = {
  query?: string;
  categories?: Category[];
  cities?: string[];
  date_from?: string;
  date_to?: string;
  price?: 'free' | 'paid';
  price_min?: number;
  price_max?: number;
  difficulties?: Difficulty[];
  duration_min?: number;
  duration_max?: number;
  languages?: string[];
  women_only?: true;
  family_friendly?: true;
  seats_available?: true;
  user_lat?: number;
  user_lng?: number;
  max_distance_km?: number;
  bbox?: Bbox;
  sort: SortOption;
  limit: number;
  offset: number;
};

/** Builds the `filters` jsonb for `search_events`. Empty values are omitted. */
export function toRpcFilters(filters: SearchFilters, ctx: SearchContext = {}): RpcFilters {
  const f = searchFiltersSchema.parse(filters);
  const out: RpcFilters = {
    sort: f.sort,
    limit: ctx.limit ?? 20,
    offset: ctx.offset ?? 0,
  };

  const q = f.query.trim();
  if (q) out.query = q;
  if (f.categories.length) out.categories = f.categories;
  if (f.cities.length) out.cities = f.cities;
  if (f.difficulties.length) out.difficulties = f.difficulties;
  if (f.languages.length) out.languages = f.languages;

  const { from, to } = dateRangeFor(f, ctx.now);
  if (from) out.date_from = from.toISOString();
  if (to) out.date_to = to.toISOString();

  if (f.price === 'free') out.price = 'free';
  if (f.price === 'paid') {
    out.price = 'paid';
    if (f.priceMin != null) out.price_min = f.priceMin;
    if (f.priceMax != null) out.price_max = f.priceMax;
  }

  const { min, max } = durationRangeFor(f.duration);
  if (min != null) out.duration_min = min;
  if (max != null) out.duration_max = max;

  if (f.womenOnly) out.women_only = true;
  if (f.familyFriendly) out.family_friendly = true;
  if (f.seatsAvailable) out.seats_available = true;

  if (ctx.userLocation) {
    out.user_lat = ctx.userLocation.lat;
    out.user_lng = ctx.userLocation.lng;
    if (f.maxDistanceKm != null) out.max_distance_km = f.maxDistanceKm;
  }
  // "Nearest" without a known location falls back to soonest.
  if (out.sort === 'nearest' && !ctx.userLocation) out.sort = 'soonest';

  if (ctx.bbox) out.bbox = ctx.bbox;
  return out;
}

// ---------------------------------------------------------------------------
// Active filter chips
// ---------------------------------------------------------------------------
export type FilterChip =
  | { id: string; kind: 'category'; value: Category }
  | { id: string; kind: 'city'; value: string }
  | { id: string; kind: 'difficulty'; value: Difficulty }
  | { id: string; kind: 'language'; value: string }
  | { id: string; kind: 'date'; value: DatePreset; from: string | null; to: string | null }
  | { id: string; kind: 'price'; value: PriceFilter; min: number | null; max: number | null }
  | { id: string; kind: 'duration'; value: DurationPreset }
  | { id: string; kind: 'distance'; value: number }
  | { id: string; kind: 'womenOnly' }
  | { id: string; kind: 'familyFriendly' }
  | { id: string; kind: 'seatsAvailable' };

/** Chips for every active filter (search text and sort are not filters). */
export function activeFilterChips(f: SearchFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  f.categories.forEach((value) => chips.push({ id: `category:${value}`, kind: 'category', value }));
  f.cities.forEach((value) => chips.push({ id: `city:${value}`, kind: 'city', value }));
  if (f.datePreset !== 'any') {
    chips.push({ id: 'date', kind: 'date', value: f.datePreset, from: f.dateFrom, to: f.dateTo });
  }
  if (f.price !== 'any') {
    chips.push({ id: 'price', kind: 'price', value: f.price, min: f.priceMin, max: f.priceMax });
  }
  f.difficulties.forEach((value) => chips.push({ id: `difficulty:${value}`, kind: 'difficulty', value }));
  if (f.duration !== 'any') chips.push({ id: 'duration', kind: 'duration', value: f.duration });
  if (f.maxDistanceKm != null) chips.push({ id: 'distance', kind: 'distance', value: f.maxDistanceKm });
  f.languages.forEach((value) => chips.push({ id: `language:${value}`, kind: 'language', value }));
  if (f.womenOnly) chips.push({ id: 'womenOnly', kind: 'womenOnly' });
  if (f.familyFriendly) chips.push({ id: 'familyFriendly', kind: 'familyFriendly' });
  if (f.seatsAvailable) chips.push({ id: 'seatsAvailable', kind: 'seatsAvailable' });
  return chips;
}

export function removeChip(f: SearchFilters, chip: FilterChip): SearchFilters {
  switch (chip.kind) {
    case 'category':
      return { ...f, categories: f.categories.filter((c) => c !== chip.value) };
    case 'city':
      return { ...f, cities: f.cities.filter((c) => c !== chip.value) };
    case 'difficulty':
      return { ...f, difficulties: f.difficulties.filter((d) => d !== chip.value) };
    case 'language':
      return { ...f, languages: f.languages.filter((l) => l !== chip.value) };
    case 'date':
      return { ...f, datePreset: 'any', dateFrom: null, dateTo: null };
    case 'price':
      return { ...f, price: 'any', priceMin: null, priceMax: null };
    case 'duration':
      return { ...f, duration: 'any' };
    case 'distance':
      return { ...f, maxDistanceKm: null };
    case 'womenOnly':
      return { ...f, womenOnly: false };
    case 'familyFriendly':
      return { ...f, familyFriendly: false };
    case 'seatsAvailable':
      return { ...f, seatsAvailable: false };
  }
}

/** Clears all filters but keeps the search text and sort order. */
export function clearFilters(f: SearchFilters): SearchFilters {
  return { ...defaultFilters, query: f.query, sort: f.sort };
}

export function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}
