import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, IconButton, Row, Text, VerifiedBadge } from '@/components/ui';
import type { EventSummary } from '@/features/events/schemas';
import { useLabels } from '@/features/events/useLabels';
import { useTheme } from '@/theme/ThemeProvider';
import { useTranslation } from 'react-i18next';

/** Compact card shown when a map pin is tapped. */
export function EventPreviewCard({ event, onClose }: { event: EventSummary; onClose: () => void }) {
  const { colors, radius, spacing } = useTheme();
  const { t } = useTranslation();
  const l = useLabels();
  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderRadius: radius.lg, borderColor: colors.border }]}>
      <Pressable
        style={styles.row}
        onPress={() => router.push(`/event/${event.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${event.title}, ${l.date(event.start_at)}, ${l.price(event.price_egp)}, ${l.seatsLeft(event.seats_left)}`}
        accessibilityHint={t('map.openEvent')}
      >
        <Image source={event.cover_url ? { uri: event.cover_url } : undefined} style={[styles.image, { backgroundColor: colors.surfaceAlt }]} contentFit="cover" />
        <View style={{ flex: 1, padding: spacing.md, gap: 4 }}>
          <Text variant="bodyStrong" numberOfLines={2}>
            {event.title}
          </Text>
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {l.date(event.start_at)}
          </Text>
          <Row gap={6}>
            <Text variant="caption" style={{ fontWeight: '800' }}>
              {l.price(event.price_egp)}
            </Text>
            <Text variant="caption" color={event.seats_left === 0 ? 'danger' : 'success'}>
              · {l.seatsLeft(event.seats_left)}
            </Text>
          </Row>
          <Row gap={4}>
            <Text variant="small" color="textMuted" numberOfLines={1} style={{ flexShrink: 1 }}>
              {event.host_name}
            </Text>
            {event.host_verified ? <VerifiedBadge compact /> : null}
          </Row>
        </View>
        <View style={{ justifyContent: 'center', paddingEnd: spacing.sm }}>
          <Icon name="chevron-forward" color="textMuted" directional />
        </View>
      </Pressable>
      <View style={styles.close}>
        <IconButton icon="close" label={t('common.close')} onPress={onClose} size={18} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  row: { flexDirection: 'row' },
  image: { width: 110, minHeight: 120 },
  close: { position: 'absolute', top: 0, end: 0 },
});
