import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Custom marker views must render once (Android) before view tracking can be switched off.
 * Tracking stays on for a moment after the marker's appearance changes.
 */
function useTracksViewChanges(appearanceKey: string) {
  const [settledKey, setSettledKey] = useState<string | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setSettledKey(appearanceKey), 400);
    return () => clearTimeout(id);
  }, [appearanceKey]);
  return settledKey !== appearanceKey;
}

export function PricePin({
  lat,
  lng,
  label,
  selected,
  featured,
  onPress,
  accessibilityLabel,
}: {
  lat: number;
  lng: number;
  label: string;
  selected?: boolean;
  featured?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  const tracks = useTracksViewChanges(`${selected}|${featured}|${label}|${colors.mapPin}`);
  const bg = selected ? colors.accent : featured ? colors.accent : colors.mapPin;
  return (
    <Marker
      coordinate={{ latitude: lat, longitude: lng }}
      onPress={(e) => {
        e.stopPropagation?.();
        onPress();
      }}
      tracksViewChanges={tracks}
      accessibilityLabel={accessibilityLabel}
      zIndex={selected ? 10 : 1}
      anchor={{ x: 0.5, y: 1 }}
    >
      <View style={styles.pinWrap}>
        <View style={[styles.pin, { backgroundColor: bg, borderColor: colors.surface, transform: [{ scale: selected ? 1.12 : 1 }] }]}>
          <Text variant="small" style={{ color: colors.mapPinText, fontWeight: '800' }} maxFontSizeMultiplier={1.2}>
            {label}
          </Text>
        </View>
        <View style={[styles.tail, { borderTopColor: bg }]} />
      </View>
    </Marker>
  );
}

export function ClusterPin({ lat, lng, count, onPress, accessibilityLabel }: { lat: number; lng: number; count: number; onPress: () => void; accessibilityLabel: string }) {
  const { colors } = useTheme();
  const tracks = useTracksViewChanges(`${count}|${colors.primary}`);
  const size = count < 10 ? 40 : count < 50 ? 48 : 56;
  return (
    <Marker
      coordinate={{ latitude: lat, longitude: lng }}
      onPress={(e) => {
        e.stopPropagation?.();
        onPress();
      }}
      tracksViewChanges={tracks}
      accessibilityLabel={accessibilityLabel}
    >
      <View
        style={[
          styles.cluster,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary, borderColor: colors.primarySoft },
        ]}
      >
        <Text variant="bodyStrong" style={{ color: colors.textOnPrimary }} maxFontSizeMultiplier={1.2}>
          {count}
        </Text>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  pinWrap: { alignItems: 'center' },
  pin: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 2, minWidth: 36, alignItems: 'center' },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  cluster: { alignItems: 'center', justifyContent: 'center', borderWidth: 4 },
});
