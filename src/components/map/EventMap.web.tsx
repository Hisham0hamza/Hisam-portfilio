import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { EventSummary } from '@/features/events/schemas';
import { useLabels } from '@/features/events/useLabels';
import { createClusterIndex } from '@/lib/cluster';
import { formatNumber } from '@/lib/format';
import type { Region } from '@/lib/geo';
import { useTheme } from '@/theme/ThemeProvider';

import { L, addBaseLayer, escapeHtml, mapRegion, regionZoom } from './leaflet.web';

export type EventMapHandle = { animateTo: (region: Region) => void };

type Props = {
  events: EventSummary[];
  initialRegion: Region;
  selectedId: string | null;
  onSelect: (event: EventSummary | null) => void;
  onRegionChange: (region: Region) => void;
  showsUserLocation?: boolean;
};

/** Web version of the clustered event map (Leaflet + OpenStreetMap). */
export const EventMap = forwardRef<EventMapHandle, Props>(function EventMap(
  { events, initialRegion, selectedId, onSelect, onRegionChange },
  ref,
) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const [region, setRegion] = useState<Region>(initialRegion);
  const { colors, scheme } = useTheme();
  const { t } = useTranslation();
  const l = useLabels();

  // Keep the latest callbacks without re-creating the map.
  const onSelectRef = useRef(onSelect);
  const onRegionRef = useRef(onRegionChange);
  useEffect(() => {
    onSelectRef.current = onSelect;
    onRegionRef.current = onRegionChange;
  });

  useEffect(() => {
    if (!container.current) return;
    // Zoom with wheel, pinch, double-click or +/- keys; the corner buttons would sit under our overlays.
    const map = L.map(container.current, { zoomControl: false, attributionControl: true }).setView(
      [initialRegion.latitude, initialRegion.longitude],
      regionZoom(initialRegion.longitudeDelta),
    );
    const tiles = addBaseLayer(map, scheme === 'dark');
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const update = () => {
      const r = mapRegion(map);
      setRegion(r);
      onRegionRef.current(r);
    };
    map.on('moveend', update);
    map.on('click', () => onSelectRef.current(null));
    update();
    return () => {
      tiles.remove();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the map is created once
  }, [scheme]);

  useImperativeHandle(ref, () => ({
    animateTo: (r) => mapRef.current?.flyTo([r.latitude, r.longitude], regionZoom(r.longitudeDelta), { duration: 0.6 }),
  }));

  const index = useMemo(() => createClusterIndex(events), [events]);

  useEffect(() => {
    const layer = layerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    for (const n of index.getClusters(region)) {
      if (n.type === 'cluster') {
        const size = n.count < 10 ? 40 : n.count < 50 ? 48 : 56;
        const icon = L.divIcon({
          className: '',
          iconSize: [size, size],
          html: `<div role="button" aria-label="${escapeHtml(t('map.clusterA11y', { count: n.count }))}" style="width:${size}px;height:${size}px;border-radius:50%;background:${colors.primary};border:4px solid ${colors.primarySoft};color:${colors.textOnPrimary};display:flex;align-items:center;justify-content:center;font:700 15px system-ui;box-sizing:border-box;cursor:pointer">${n.count}</div>`,
        });
        L.marker([n.lat, n.lng], { icon, keyboard: true })
          .on('click', () => map.flyTo([n.lat, n.lng], Math.max(regionZoom(n.expansionRegion.longitudeDelta), map.getZoom() + 1), { duration: 0.5 }))
          .addTo(layer);
      } else {
        const e = n.item;
        const selected = e.id === selectedId;
        const label = e.price_egp === 0 ? t('events.free') : formatNumber(e.price_egp, l.lang, 0);
        const bg = selected || e.is_featured ? colors.accent : colors.mapPin;
        const icon = L.divIcon({
          className: '',
          iconSize: [0, 0],
          html: `<div role="button" aria-label="${escapeHtml(`${e.title}, ${l.price(e.price_egp)}`)}" style="position:absolute;transform:translate(-50%,-100%) scale(${selected ? 1.12 : 1});display:flex;flex-direction:column;align-items:center;cursor:pointer">
            <div style="background:${bg};color:${colors.mapPinText};border:2px solid ${colors.surface};border-radius:12px;padding:3px 8px;font:800 12px system-ui;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.25)">${escapeHtml(label)}</div>
            <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:7px solid ${bg};margin-top:-1px"></div>
          </div>`,
        });
        L.marker([n.lat, n.lng], { icon, zIndexOffset: selected ? 1000 : 0, keyboard: true })
          .on('click', (ev) => {
            L.DomEvent.stopPropagation(ev);
            onSelectRef.current(e);
          })
          .addTo(layer);
      }
    }
  }, [index, region, selectedId, colors, t, l]);

  return (
    <div
      ref={container}
      aria-label={t('map.a11y', { count: events.length })}
      style={{ position: 'absolute', inset: 0, background: colors.surfaceAlt }}
    />
  );
});
