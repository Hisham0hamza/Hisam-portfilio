// Map/geo helpers (pure — no React Native imports).

export type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
export type Bbox = { west: number; south: number; east: number; north: number };

export const CAIRO: Region = { latitude: 30.0444, longitude: 31.2357, latitudeDelta: 0.12, longitudeDelta: 0.12 };
export const EGYPT: Region = { latitude: 27.5, longitude: 30.8, latitudeDelta: 10, longitudeDelta: 10 };

export function regionToBbox(r: Region): Bbox {
  return {
    west: r.longitude - r.longitudeDelta / 2,
    east: r.longitude + r.longitudeDelta / 2,
    south: r.latitude - r.latitudeDelta / 2,
    north: r.latitude + r.latitudeDelta / 2,
  };
}

/** Web-mercator zoom level that roughly matches a region's longitude span. */
export function regionToZoom(r: Region): number {
  const zoom = Math.log2(360 / Math.max(r.longitudeDelta, 1e-6));
  return Math.max(0, Math.min(20, Math.round(zoom)));
}

export function zoomToDelta(zoom: number): number {
  return 360 / 2 ** zoom;
}

/** Has the map moved/zoomed enough since the last search to offer "Search this area"? */
export function regionChangedSignificantly(a: Region, b: Region, threshold = 0.25): boolean {
  const dLat = Math.abs(a.latitude - b.latitude) / Math.max(a.latitudeDelta, 1e-6);
  const dLng = Math.abs(a.longitude - b.longitude) / Math.max(a.longitudeDelta, 1e-6);
  const zoom = Math.abs(Math.log2(a.longitudeDelta / b.longitudeDelta));
  return dLat > threshold || dLng > threshold || zoom > 0.5;
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function googleMapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
