// Place search for meeting points: Mapbox when a token is configured, otherwise
// the device geocoder from expo-location.
import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { env } from './env';

export type Place = { id: string; name: string; address: string; lat: number; lng: number };

export async function searchPlaces(query: string, lang: 'ar' | 'en', near?: { lat: number; lng: number }): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  if (env.mapboxToken) {
    const params = new URLSearchParams({
      q,
      access_token: env.mapboxToken,
      country: 'eg',
      language: lang,
      limit: '8',
    });
    if (near) params.set('proximity', `${near.lng},${near.lat}`);
    const res = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`);
    if (!res.ok) throw new Error('geocoding_failed');
    const json = (await res.json()) as {
      features: { id: string; properties: { name: string; full_address?: string; place_formatted?: string; coordinates: { latitude: number; longitude: number } } }[];
    };
    return json.features.map((f) => ({
      id: f.id,
      name: f.properties.name,
      address: f.properties.full_address ?? f.properties.place_formatted ?? f.properties.name,
      lat: f.properties.coordinates.latitude,
      lng: f.properties.coordinates.longitude,
    }));
  }

  if (Platform.OS === 'web') return nominatimSearch(q, lang);

  const results = await Location.geocodeAsync(`${q}, Egypt`);
  return results.slice(0, 8).map((r, i) => ({
    id: `${r.latitude},${r.longitude},${i}`,
    name: q,
    address: `${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}`,
    lat: r.latitude,
    lng: r.longitude,
  }));
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`);
      const json = (await res.json()) as { display_name?: string };
      return json.display_name?.split(',').slice(0, 3).join(',') ?? null;
    }
    const [r] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (!r) return null;
    return [r.name, r.street, r.district, r.city].filter(Boolean).join(', ') || null;
  } catch {
    return null;
  }
}

/** OpenStreetMap Nominatim (web fallback; free, low volume only). */
async function nominatimSearch(q: string, lang: 'ar' | 'en'): Promise<Place[]> {
  const params = new URLSearchParams({ q, format: 'json', countrycodes: 'eg', limit: '8', 'accept-language': lang });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
  if (!res.ok) throw new Error('geocoding_failed');
  const json = (await res.json()) as { place_id: number; display_name: string; lat: string; lon: string }[];
  return json.map((r) => ({
    id: String(r.place_id),
    name: r.display_name.split(',')[0],
    address: r.display_name,
    lat: Number(r.lat),
    lng: Number(r.lon),
  }));
}
