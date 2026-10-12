import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import MapView from 'react-native-maps';
import { useTranslation } from 'react-i18next';

import type { EventSummary } from '@/features/events/schemas';
import { useLabels } from '@/features/events/useLabels';
import { createClusterIndex } from '@/lib/cluster';
import type { Region } from '@/lib/geo';
import { formatNumber } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

import { ClusterPin, PricePin } from './Pins';

export type EventMapHandle = { animateTo: (region: Region) => void };

type Props = {
  events: EventSummary[];
  initialRegion: Region;
  selectedId: string | null;
  onSelect: (event: EventSummary | null) => void;
  onRegionChange: (region: Region) => void;
  showsUserLocation?: boolean;
};

export const EventMap = forwardRef<EventMapHandle, Props>(function EventMap(
  { events, initialRegion, selectedId, onSelect, onRegionChange, showsUserLocation },
  ref,
) {
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<Region>(initialRegion);
  const { t } = useTranslation();
  const l = useLabels();
  const { scheme } = useTheme();

  useImperativeHandle(ref, () => ({
    animateTo: (r) => mapRef.current?.animateToRegion(r, 350),
  }));

  const index = useMemo(() => createClusterIndex(events), [events]);
  const nodes = useMemo(() => index.getClusters(region), [index, region]);

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={initialRegion}
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={false}
      showsPointsOfInterests={false}
      userInterfaceStyle={scheme}
      toolbarEnabled={false}
      onPress={() => onSelect(null)}
      onRegionChangeComplete={(r) => {
        setRegion(r);
        onRegionChange(r);
      }}
      accessibilityLabel={t('map.a11y', { count: events.length })}
    >
      {nodes.map((n) =>
        n.type === 'cluster' ? (
          <ClusterPin
            key={n.id}
            lat={n.lat}
            lng={n.lng}
            count={n.count}
            accessibilityLabel={t('map.clusterA11y', { count: n.count })}
            onPress={() => mapRef.current?.animateToRegion(n.expansionRegion, 350)}
          />
        ) : (
          <PricePin
            key={n.id}
            lat={n.lat}
            lng={n.lng}
            label={n.item.price_egp === 0 ? t('events.free') : formatNumber(n.item.price_egp, l.lang, 0)}
            selected={n.id === selectedId}
            featured={n.item.is_featured}
            accessibilityLabel={`${n.item.title}, ${l.price(n.item.price_egp)}`}
            onPress={() => onSelect(n.item)}
          />
        ),
      )}
    </MapView>
  );
});
