import { useEffect, useRef } from 'react';
import { Linking, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui';
import { googleMapsUrl } from '@/lib/geo';
import { useTheme } from '@/theme/ThemeProvider';

import { L, addBaseLayer } from './leaflet.web';

type Point = { lat: number; lng: number; name?: string };

export function MiniMap({ meeting, stops = [] }: { meeting: Point; stops?: Point[] }) {
  const container = useRef<HTMLDivElement>(null);
  const { colors, radius, scheme } = useTheme();
  const { t } = useTranslation();
  const open = () => Linking.openURL(googleMapsUrl(meeting.lat, meeting.lng));
  // Callers pass new arrays each render; only rebuild the map when the coordinates change.
  const pointsKey = JSON.stringify([meeting, stops]);

  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current, {
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
      attributionControl: false,
    });
    addBaseLayer(map, scheme === 'dark');
    const all = [meeting, ...stops].map((p) => L.latLng(p.lat, p.lng));
    if (stops.length) {
      L.polyline(all, { color: colors.primary, weight: 3, dashArray: '6 4' }).addTo(map);
      stops.forEach((s) => L.circleMarker([s.lat, s.lng], { radius: 6, color: colors.surface, weight: 2, fillColor: colors.primary, fillOpacity: 1 }).bindTooltip(s.name ?? '').addTo(map));
    }
    L.circleMarker([meeting.lat, meeting.lng], { radius: 9, color: colors.surface, weight: 3, fillColor: colors.accent, fillOpacity: 1 }).addTo(map);
    if (all.length > 1) map.fitBounds(L.latLngBounds(all), { padding: [24, 24], maxZoom: 16 });
    else map.setView(all[0], 15);
    return () => {
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the coordinates
  }, [pointsKey, colors, scheme]);

  return (
    <View style={{ gap: 8 }}>
      <div
        ref={container}
        onClick={open}
        role="link"
        aria-label={t('event.openInMaps')}
        style={{ height: 180, borderRadius: radius.lg, overflow: 'hidden', border: `1px solid ${colors.border}`, cursor: 'pointer', position: 'relative', zIndex: 0 }}
      />
      <Button title={t('event.openInMaps')} variant="ghost" icon="navigate-outline" size="sm" onPress={open} />
    </View>
  );
}
