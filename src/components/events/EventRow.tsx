import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import type { EventListItem } from '@/features/events/schemas';
import { useLabels } from '@/features/events/useLabels';
import { useTheme } from '@/theme/ThemeProvider';

/** Compact row for My Trips / Host / profile lists. */
export function EventRow({ event, badge, footer }: { event: EventListItem; badge?: ReactNode; footer?: ReactNode }) {
  const { colors, radius, spacing } = useTheme();
  const l = useLabels();
  return (
    <Pressable
      onPress={() => router.push(`/event/${event.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${l.dateRange(event.start_at, event.end_at)}, ${l.cityName(event.city)}`}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? colors.surfaceAlt : colors.surface, borderColor: colors.border, borderRadius: radius.lg },
      ]}
    >
      <Image source={event.cover_url ? { uri: event.cover_url } : undefined} style={[styles.image, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md }]} contentFit="cover" />
      <View style={{ flex: 1, gap: 2, paddingVertical: spacing.xs }}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {event.title}
        </Text>
        <Text variant="small" color="textMuted" numberOfLines={1}>
          {l.dateRange(event.start_at, event.end_at)}
        </Text>
        <Text variant="small" color="textMuted" numberOfLines={1}>
          {l.cityName(event.city)} · {l.price(event.price_egp)}
        </Text>
        {badge ? <View style={{ marginTop: spacing.xs, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{badge}</View> : null}
        {footer}
      </View>
      <Icon name="chevron-forward" color="textMuted" directional />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderWidth: StyleSheet.hairlineWidth },
  image: { width: 76, height: 76 },
});
