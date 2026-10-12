import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui';
import { googleMapsUrl } from '@/lib/geo';
import { useTheme } from '@/theme/ThemeProvider';

type Point = { lat: number; lng: number; name?: string };

/** Static map of the meeting point (and route) with an "Open in Google Maps" action. */
export function MiniMap({ meeting, stops = [] }: { meeting: Point; stops?: Point[] }) {
  const { colors, radius, scheme } = useTheme();
  const { t } = useTranslation();
  const all = [meeting, ...stops];
  const lats = all.map((p) => p.lat);
  const lngs = all.map((p) => p.lng);
  const pad = 0.004;
  const region = {
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    latitudeDelta: Math.max(Math.max(...lats) - Math.min(...lats) + pad * 2, 0.01) * 1.3,
    longitudeDelta: Math.max(Math.max(...lngs) - Math.min(...lngs) + pad * 2, 0.01) * 1.3,
  };
  const open = () => Linking.openURL(googleMapsUrl(meeting.lat, meeting.lng));

  return (
    <View style={{ gap: 8 }}>
      <Pressable
        onPress={open}
        accessibilityRole="link"
        accessibilityLabel={t('event.openInMaps')}
        style={[styles.map, { borderRadius: radius.lg, borderColor: colors.border }]}
      >
        <MapView
          style={StyleSheet.absoluteFill}
          initialRegion={region}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          liteMode={Platform.OS === 'android'}
          userInterfaceStyle={scheme}
          pointerEvents="none"
        >
          {stops.length ? (
            <Polyline
              coordinates={all.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
              strokeColor={colors.primary}
              strokeWidth={3}
              lineDashPattern={[6, 4]}
            />
          ) : null}
          <Marker coordinate={{ latitude: meeting.lat, longitude: meeting.lng }} pinColor={colors.accent} />
          {stops.map((s, i) => (
            <Marker key={`${s.lat},${s.lng},${i}`} coordinate={{ latitude: s.lat, longitude: s.lng }} pinColor={colors.primary} title={s.name} />
          ))}
        </MapView>
      </Pressable>
      <Button title={t('event.openInMaps')} variant="ghost" icon="navigate-outline" size="sm" onPress={open} />
    </View>
  );
}

const styles = StyleSheet.create({
  map: { height: 180, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
});
