import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

import type { Region } from '@/lib/geo';
import { useTheme } from '@/theme/ThemeProvider';

import { L, addBaseLayer, regionZoom } from './leaflet.web';

export type PickerMapHandle = { flyTo: (lat: number, lng: number) => void };

type Props = {
  initialRegion: Region;
  onCenterChange: (center: { lat: number; lng: number }) => void;
  onUserDrag: () => void;
};

/** Map under the fixed centre pin of the location picker (web). */
export const PickerMap = forwardRef<PickerMapHandle, Props>(function PickerMap({ initialRegion, onCenterChange, onUserDrag }, ref) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const { scheme, colors } = useTheme();
  const cbs = useRef({ onCenterChange, onUserDrag });
  useEffect(() => {
    cbs.current = { onCenterChange, onUserDrag };
  });

  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current).setView([initialRegion.latitude, initialRegion.longitude], regionZoom(initialRegion.longitudeDelta));
    addBaseLayer(map, scheme === 'dark');
    map.on('moveend', () => {
      const c = map.getCenter();
      cbs.current.onCenterChange({ lat: c.lat, lng: c.lng });
    });
    map.on('dragstart', () => cbs.current.onUserDrag());
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- created once per open
  }, [scheme]);

  useImperativeHandle(ref, () => ({
    flyTo: (lat, lng) => mapRef.current?.flyTo([lat, lng], 17, { duration: 0.5 }),
  }));

  return <div ref={container} style={{ position: 'absolute', inset: 0, background: colors.surfaceAlt }} />;
});
