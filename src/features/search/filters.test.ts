import { describe, expect, it } from 'vitest';

import {
  activeFilterChips,
  clearFilters,
  dateRangeFor,
  defaultFilters,
  durationRangeFor,
  removeChip,
  toRpcFilters,
  toYmd,
  type SearchFilters,
} from './filters';

const f = (over: Partial<SearchFilters> = {}): SearchFilters => ({ ...defaultFilters, ...over });

// Local-time dates (tests run in whatever TZ the machine has; presets are local).
const wednesday = new Date(2026, 9, 14, 15, 30); // Wed 14 Oct 2026 15:30
const friday = new Date(2026, 9, 16, 9, 0);
const saturday = new Date(2026, 9, 17, 20, 0);

describe('toRpcFilters', () => {
  it('sends only sort and paging for default filters', () => {
    expect(toRpcFilters(defaultFilters)).toEqual({ sort: 'soonest', limit: 20, offset: 0 });
  });

  it('maps every filter to the search_events payload', () => {
    const payload = toRpcFilters(
      f({
        query: '  muizz ',
        categories: ['heritage_walk', 'food_walk'],
        cities: ['cairo'],
        difficulties: ['easy'],
        languages: ['en'],
        price: 'paid',
        priceMin: 100,
        priceMax: 500,
        duration: 'half_day',
        womenOnly: true,
        familyFriendly: true,
        seatsAvailable: true,
        maxDistanceKm: 10,
        sort: 'nearest',
      }),
      { userLocation: { lat: 30, lng: 31 }, limit: 50, offset: 100, bbox: { west: 1, south: 2, east: 3, north: 4 } },
    );
    expect(payload).toEqual({
      query: 'muizz',
      categories: ['heritage_walk', 'food_walk'],
      cities: ['cairo'],
      difficulties: ['easy'],
      languages: ['en'],
      price: 'paid',
      price_min: 100,
      price_max: 500,
      duration_min: 121,
      duration_max: 300,
      women_only: true,
      family_friendly: true,
      seats_available: true,
      user_lat: 30,
      user_lng: 31,
      max_distance_km: 10,
      bbox: { west: 1, south: 2, east: 3, north: 4 },
      sort: 'nearest',
      limit: 50,
      offset: 100,
    });
  });

  it('ignores the price range for free events', () => {
    expect(toRpcFilters(f({ price: 'free', priceMin: 100, priceMax: 200 }))).toMatchObject({ price: 'free' });
    expect(toRpcFilters(f({ price: 'free', priceMin: 100 }))).not.toHaveProperty('price_min');
  });

  it('falls back to soonest and drops distance when the location is unknown', () => {
    const payload = toRpcFilters(f({ sort: 'nearest', maxDistanceKm: 5 }));
    expect(payload.sort).toBe('soonest');
    expect(payload).not.toHaveProperty('max_distance_km');
  });

  it('converts the date preset into an ISO range', () => {
    const payload = toRpcFilters(f({ datePreset: 'today' }), { now: wednesday });
    expect(payload.date_from).toBe(wednesday.toISOString());
    expect(payload.date_to).toBe(new Date(2026, 9, 15).toISOString());
  });

  it('rejects invalid filters', () => {
    expect(() => toRpcFilters(f({ sort: 'cheapest' as never }))).toThrow();
  });
});

describe('dateRangeFor', () => {
  it('this weekend = upcoming Friday and Saturday', () => {
    const { from, to } = dateRangeFor(f({ datePreset: 'weekend' }), wednesday);
    expect(toYmd(from!)).toBe('2026-10-16');
    expect(toYmd(to!)).toBe('2026-10-18');
  });

  it('this weekend starts now when it is already the weekend', () => {
    expect(dateRangeFor(f({ datePreset: 'weekend' }), friday)).toEqual({ from: friday, to: new Date(2026, 9, 18) });
    expect(dateRangeFor(f({ datePreset: 'weekend' }), saturday)).toEqual({ from: saturday, to: new Date(2026, 9, 18) });
  });

  it('this week = next 7 days', () => {
    const { from, to } = dateRangeFor(f({ datePreset: 'week' }), wednesday);
    expect(from).toEqual(wednesday);
    expect(to!.getTime() - wednesday.getTime()).toBe(7 * 24 * 3600 * 1000);
  });

  it('custom range includes the whole last day and never starts in the past', () => {
    const { from, to } = dateRangeFor(f({ datePreset: 'custom', dateFrom: '2026-10-01', dateTo: '2026-10-20' }), wednesday);
    expect(from).toEqual(wednesday);
    expect(to).toEqual(new Date(2026, 9, 21));
  });

  it('any = no bounds', () => {
    expect(dateRangeFor(f(), wednesday)).toEqual({ from: null, to: null });
  });
});

describe('durationRangeFor', () => {
  it('maps presets to non-overlapping minute ranges', () => {
    expect(durationRangeFor('short')).toEqual({ min: null, max: 120 });
    expect(durationRangeFor('half_day')).toEqual({ min: 121, max: 300 });
    expect(durationRangeFor('full_day')).toEqual({ min: 301, max: 1440 });
    expect(durationRangeFor('multi_day')).toEqual({ min: 1441, max: null });
  });
});

describe('filter chips', () => {
  const busy = f({
    query: 'zamalek',
    categories: ['photo_walk'],
    cities: ['cairo', 'giza'],
    datePreset: 'weekend',
    price: 'free',
    womenOnly: true,
    sort: 'popular',
  });

  it('lists one chip per active filter, not for search text or sort', () => {
    expect(activeFilterChips(busy).map((c) => c.id)).toEqual([
      'category:photo_walk',
      'city:cairo',
      'city:giza',
      'date',
      'price',
      'womenOnly',
    ]);
    expect(activeFilterChips(defaultFilters)).toEqual([]);
  });

  it('removes a single chip', () => {
    const chip = activeFilterChips(busy).find((c) => c.id === 'city:giza')!;
    expect(removeChip(busy, chip).cities).toEqual(['cairo']);
  });

  it('clear all keeps the search text and sort', () => {
    expect(clearFilters(busy)).toEqual({ ...defaultFilters, query: 'zamalek', sort: 'popular' });
  });
});
