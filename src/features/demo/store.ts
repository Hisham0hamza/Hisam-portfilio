// In-browser demo backend: the seeded data plus everything testers do, persisted in
// AsyncStorage (localStorage on web). Used when no Supabase project is configured.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import type {
  ApplicationStatus,
  ApprovalMode,
  Category,
  Difficulty,
  EventStatus,
} from '@/features/events/schemas';

import seed from './seed.json';

export const DEMO_PASSWORD = 'masar-demo-123';
const STORAGE_KEY = 'masar.demo.v2';

/** Event photos ship with the web build (public/images/events, served by GitHub Pages). */
const HOSTED_SITE = 'https://hisham0hamza.github.io/Hisam-portfilio';

function assetUrl(path: string | null) {
  if (!path || !path.startsWith('/')) return path;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}${(process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '')}${path}`;
  }
  return `${HOSTED_SITE}${path}`;
}

export type DProfile = {
  id: string;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  languages: string[];
  interests: string[];
  is_host: boolean;
  host_verified: boolean;
  created_at: string;
};

export type DEvent = {
  id: string;
  host_id: string;
  title: string;
  description: string;
  category: Category;
  city: string;
  area: string | null;
  meeting_lat: number;
  meeting_lng: number;
  meeting_address: string;
  start_at: string;
  end_at: string | null;
  duration_minutes: number;
  difficulty: Difficulty;
  distance_km: number | null;
  price_egp: number;
  includes: string | null;
  capacity: number;
  languages: string[];
  women_only: boolean;
  family_friendly: boolean;
  what_to_bring: string | null;
  cancellation_policy: string | null;
  approval_mode: ApprovalMode;
  status: EventStatus;
  cover_url: string | null;
  created_at: string;
};

export type DPhoto = { id: string; event_id: string; url: string; sort_order: number };
export type DStop = { id: string; event_id: string; name: string; lat: number; lng: number; sort_order: number };
export type DApplication = {
  id: string;
  event_id: string;
  user_id: string;
  status: ApplicationStatus;
  message: string | null;
  created_at: string;
  decided_at: string | null;
};
export type DReview = {
  id: string;
  event_id: string;
  reviewer_id: string;
  host_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};
export type DAccount = { email: string; password: string; user_id: string };

export type DemoDb = {
  version: 2;
  accounts: DAccount[];
  profiles: DProfile[];
  events: DEvent[];
  photos: DPhoto[];
  stops: DStop[];
  applications: DApplication[];
  reviews: DReview[];
  saved: { user_id: string; event_id: string; created_at: string }[];
  session: { user_id: string } | null;
};

export const cities = seed.cities;

let counter = 0;
export function newId() {
  counter += 1;
  const rand = Math.random().toString(16).slice(2, 10).padEnd(8, '0');
  const time = Date.now().toString(16).slice(-12).padStart(12, '0');
  return `${rand}-${String(counter % 10000).padStart(4, '0')}-4000-8000-${time}`;
}

/** Builds a fresh database from seed.json with dates moved so "today" is today. */
export function freshDb(): DemoDb {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const at = (offset: number | null) => (offset == null ? null : new Date(today.getTime() + offset).toISOString());
  const now = new Date().toISOString();

  const events: DEvent[] = seed.events.map((e) => ({
    ...(e as unknown as Omit<DEvent, 'start_at' | 'end_at' | 'created_at'>),
    cover_url: assetUrl(e.cover_url),
    start_at: at(e.start_offset)!,
    end_at: at(e.end_offset),
    created_at: now,
  }));

  return {
    version: 2,
    accounts: seed.accounts.map((a) => ({ ...a, password: DEMO_PASSWORD })),
    profiles: seed.profiles.map((p) => ({ ...(p as Omit<DProfile, 'created_at'>), created_at: now })),
    events,
    photos: seed.photos.map((p) => ({ ...p, url: assetUrl(p.url)!, id: newId() })),
    stops: seed.stops.map((s) => ({ ...s, id: newId() })),
    applications: seed.applications.map((a) => ({
      ...(a as Omit<DApplication, 'id' | 'created_at' | 'decided_at'>),
      id: newId(),
      created_at: now,
      decided_at: a.status === 'pending' ? null : now,
    })),
    reviews: seed.reviews.map((r) => ({ ...r, id: newId(), created_at: now })),
    saved: [],
    session: null,
  };
}

let db: DemoDb | null = null;
let loading: Promise<DemoDb> | null = null;

export function getDb(): Promise<DemoDb> {
  if (db) return Promise.resolve(db);
  loading ??= (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as DemoDb) : null;
      db = parsed?.version === 2 ? parsed : freshDb();
    } catch {
      db = freshDb();
    }
    return db;
  })();
  return loading;
}

export async function persist() {
  if (!db) return;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // storage full or unavailable — the demo keeps working in memory
  }
}

export async function resetDemo() {
  const session = db?.session ?? null;
  db = { ...freshDb(), session };
  loading = Promise.resolve(db);
  await persist();
}

/** Small artificial latency so loading states are visible like with a real backend. */
export const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));
