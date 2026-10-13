import 'leaflet/dist/leaflet.css';

import L from 'leaflet';

/** OpenStreetMap tiles (free, attribution required). */
export function addBaseLayer(map: L.Map, dark: boolean) {
  const url = dark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
  return L.tileLayer(url, {
    maxZoom: 19,
    subdomains: 'abcd',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
  }).addTo(map);
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Leaflet zoom ↔ react-native-maps style region (so the shared clustering code works). */
export function mapRegion(map: L.Map) {
  const b = map.getBounds();
  return {
    latitude: (b.getNorth() + b.getSouth()) / 2,
    longitude: (b.getEast() + b.getWest()) / 2,
    latitudeDelta: Math.abs(b.getNorth() - b.getSouth()),
    longitudeDelta: Math.abs(b.getEast() - b.getWest()),
  };
}

export function regionZoom(longitudeDelta: number) {
  return Math.max(2, Math.min(18, Math.round(Math.log2(360 / Math.max(longitudeDelta, 1e-6)))));
}

export { L };
