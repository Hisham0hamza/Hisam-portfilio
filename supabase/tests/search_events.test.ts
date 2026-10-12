import type { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ADMIN_URL, actAs, actAsAdmin, connect, createEvent, createUser, resetTestDatabase } from './helpers';

type Row = {
  id: string;
  title: string;
  category: string;
  city: string;
  price_egp: string;
  seats_left: number;
  approved_count: number;
  women_only: boolean;
  family_friendly: boolean;
  languages: string[];
  difficulty: string;
  duration_minutes: number;
  start_at: Date;
  lat: number;
  lng: number;
  distance_from_user_km: number | null;
  total_count: string;
};

const TAHRIR = { user_lat: 30.0444, user_lng: 31.2357 };

describe.skipIf(!ADMIN_URL)('search_events', () => {
  let db: Client;

  const search = async (filters: Record<string, unknown> = {}) => {
    const { rows } = await db.query<Row>('select * from public.search_events($1::jsonb)', [JSON.stringify(filters)]);
    return rows;
  };

  beforeAll(async () => {
    await resetTestDatabase('search');
    db = await connect();
    await actAs(db, null); // search as an anonymous visitor
  }, 60_000);

  afterAll(async () => {
    await db?.end();
  });

  it('returns only upcoming published events', async () => {
    const rows = await search({ limit: 500 });
    expect(rows.length).toBe(23);
    expect(rows.every((r) => new Date(r.start_at) > new Date())).toBe(true);
    expect(rows.map((r) => r.title)).not.toContain('Al-Muizz by Night'); // completed
  });

  it('hides drafts and cancelled events', async () => {
    await actAsAdmin(db);
    const host = await createUser(db, 'Draft Host');
    await createEvent(db, host, { title: 'Secret draft walk', status: 'draft' });
    const cancelled = await createEvent(db, host, { title: 'Cancelled walk' });
    await db.query(`update events set status = 'cancelled' where id = $1`, [cancelled]);
    await actAs(db, null);

    const titles = (await search({ query: 'walk', limit: 500 })).map((r) => r.title);
    expect(titles).not.toContain('Secret draft walk');
    expect(titles).not.toContain('Cancelled walk');
  });

  it('defaults to sorting by soonest start', async () => {
    const rows = await search();
    const times = rows.map((r) => new Date(r.start_at).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  describe('text search', () => {
    it('matches the title, case-insensitively', async () => {
      const rows = await search({ query: 'muizz' });
      expect(rows.map((r) => r.title)).toEqual(['Al-Muizz Street at Golden Hour']);
    });

    it('matches city names in Arabic', async () => {
      const rows = await search({ query: 'الإسكندرية' });
      expect(rows.length).toBe(4);
      expect(rows.every((r) => r.city === 'alexandria')).toBe(true);
    });

    it('matches the host name', async () => {
      const rows = await search({ query: 'Omar Siwi' });
      expect(rows.length).toBe(5);
    });

    it('matches route stop names', async () => {
      const rows = await search({ query: 'Ben Ezra' });
      expect(rows.map((r) => r.title)).toEqual(['Coptic Cairo & the Religions Compound']);
    });

    it('treats LIKE wildcards literally', async () => {
      expect(await search({ query: '%' })).toHaveLength(0);
      expect(await search({ query: '_' })).toHaveLength(0);
    });
  });

  describe('filters', () => {
    it('filters by category and city', async () => {
      const rows = await search({ categories: ['food_walk'], cities: ['cairo'] });
      expect(rows.map((r) => r.title).sort()).toEqual([
        'Khan el-Khalili Food Crawl',
        'Sayeda Zeinab Late-Night Street Food',
      ]);
    });

    it('treats empty arrays as "no filter"', async () => {
      const all = await search({ limit: 500 });
      const empty = await search({ categories: [], cities: [], languages: [], difficulties: [], limit: 500 });
      expect(empty.length).toBe(all.length);
    });

    it('filters free and paid events', async () => {
      const free = await search({ price: 'free', limit: 500 });
      const paid = await search({ price: 'paid', limit: 500 });
      expect(free.every((r) => Number(r.price_egp) === 0)).toBe(true);
      expect(paid.every((r) => Number(r.price_egp) > 0)).toBe(true);
      expect(free.length + paid.length).toBe(23);
    });

    it('filters by price range', async () => {
      const rows = await search({ price_min: 200, price_max: 400, limit: 500 });
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => Number(r.price_egp) >= 200 && Number(r.price_egp) <= 400)).toBe(true);
    });

    it('filters by difficulty', async () => {
      const rows = await search({ difficulties: ['hard'] });
      expect(rows.map((r) => r.title)).toEqual(['Mount Sinai Sunrise Trek']);
    });

    it('filters by duration', async () => {
      const multiDay = await search({ duration_min: 24 * 60, limit: 500 });
      expect(multiDay.map((r) => r.title).sort()).toEqual([
        'Siwa Oasis 4-Day Escape',
        'Tunis Village Pottery Weekend',
      ]);
      const short = await search({ duration_max: 120, limit: 500 });
      expect(short.every((r) => r.duration_minutes <= 120)).toBe(true);
    });

    it('filters by language overlap', async () => {
      const rows = await search({ languages: ['de'] });
      expect(rows.map((r) => r.title).sort()).toEqual(['Siwa Oasis 4-Day Escape']);
      const frOrDe = await search({ languages: ['fr', 'de'] });
      expect(frOrDe.length).toBe(2);
    });

    it('filters women-only and family-friendly events', async () => {
      const women = await search({ women_only: true });
      expect(women.map((r) => r.title)).toEqual(["Women's Sunrise Photo Walk in Zamalek"]);
      const family = await search({ family_friendly: true, limit: 500 });
      expect(family.length).toBeGreaterThan(5);
      expect(family.every((r) => r.family_friendly)).toBe(true);
      // false means "don't filter", not "exclude"
      expect((await search({ women_only: false, limit: 500 })).length).toBe(23);
    });

    it('can hide full events', async () => {
      const all = await search({ query: 'Khan el-Khalili' });
      expect(all[0].seats_left).toBe(0);
      expect(await search({ query: 'Khan el-Khalili', seats_available: true })).toHaveLength(0);
    });

    it('filters by date range', async () => {
      const from = new Date();
      const to = new Date(Date.now() + 5 * 24 * 3600 * 1000);
      const rows = await search({ date_from: from.toISOString(), date_to: to.toISOString(), limit: 500 });
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => new Date(r.start_at) < to)).toBe(true);
    });
  });

  describe('geo', () => {
    it('restricts results to the map viewport (bbox)', async () => {
      const rows = await search({ bbox: { west: 29.8, south: 31.1, east: 30.1, north: 31.35 } });
      expect(rows.length).toBe(4);
      expect(rows.every((r) => r.city === 'alexandria')).toBe(true);
    });

    it('supports center + radius', async () => {
      const rows = await search({ center: { lat: 28.5722, lng: 34.5379 }, radius_km: 5 });
      expect(rows.map((r) => r.title)).toEqual(['Dahab Blue Hole Coastal Hike']);
    });

    it('computes distance from the user and limits by max distance', async () => {
      const rows = await search({ ...TAHRIR, max_distance_km: 5, limit: 500 });
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.distance_from_user_km! <= 5)).toBe(true);
      expect(rows.some((r) => r.city === 'alexandria')).toBe(false);
    });

    it('sorts by nearest', async () => {
      const rows = await search({ ...TAHRIR, sort: 'nearest', limit: 500 });
      const d = rows.map((r) => r.distance_from_user_km!);
      expect(d).toEqual([...d].sort((a, b) => a - b));
      expect(rows.at(-1)!.city).toBe('siwa');
    });

    it('returns lat/lng of the meeting point', async () => {
      const [row] = await search({ query: 'Blue Hole' });
      expect(row.lat).toBeCloseTo(28.5722, 3);
      expect(row.lng).toBeCloseTo(34.5379, 3);
    });
  });

  it('sorts by popularity', async () => {
    const rows = await search({ sort: 'popular', limit: 500 });
    const counts = rows.map((r) => r.approved_count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    expect(rows[0].title).toBe('Khan el-Khalili Food Crawl');
  });

  it('paginates with a stable total count', async () => {
    const page1 = await search({ limit: 10, offset: 0 });
    const page3 = await search({ limit: 10, offset: 20 });
    expect(page1).toHaveLength(10);
    expect(page3).toHaveLength(3);
    expect(Number(page1[0].total_count)).toBe(23);
    const ids = new Set([...page1, ...page3].map((r) => r.id));
    expect(ids.size).toBe(13);
  });
});
