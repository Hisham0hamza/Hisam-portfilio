import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Avatar, Badge, Icon, Rating, Row, Text, VerifiedBadge } from '@/components/ui';
import type { EventSummary } from '@/features/events/schemas';
import { CATEGORY_ICONS, useLabels } from '@/features/events/useLabels';
import { useTheme } from '@/theme/ThemeProvider';

/** List-view card. */
export function EventCard({ event }: { event: EventSummary }) {
  const { colors, radius, spacing } = useTheme();
  const { t } = useTranslation();
  const l = useLabels();
  const city = l.lang === 'ar' ? event.city_name_ar : event.city_name_en;

  const a11y = [
    event.title,
    l.category(event.category),
    l.date(event.start_at),
    city,
    l.price(event.price_egp),
    l.difficulty(event.difficulty),
    l.seatsLeft(event.seats_left),
    t('events.hostedBy', { name: event.host_name }),
  ].join(', ');

  return (
    <Pressable
      onPress={() => router.push(`/event/${event.id}`)}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderRadius: radius.lg, borderColor: event.is_featured ? colors.accent : colors.border, opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <View>
        <Image
          source={event.cover_url ? { uri: event.cover_url } : undefined}
          style={[styles.cover, { backgroundColor: colors.surfaceAlt }]}
          contentFit="cover"
          transition={200}
        />
        <View style={[styles.overlayRow, { padding: spacing.sm }]}>
          <View style={[styles.pill, { backgroundColor: colors.surface }]}>
            <Icon name={CATEGORY_ICONS[event.category]} size={14} color="primary" />
            <Text variant="small" color="primary">
              {l.category(event.category)}
            </Text>
          </View>
          <View style={[styles.pill, { backgroundColor: colors.surface }]}>
            <Text variant="small" style={{ fontWeight: '800' }}>
              {l.price(event.price_egp)}
            </Text>
          </View>
        </View>
      </View>
      <View style={{ padding: spacing.md, gap: spacing.xs }}>
        <Text variant="heading" numberOfLines={2}>
          {event.title}
        </Text>
        <Row gap={6}>
          <Icon name="calendar-outline" size={14} color="textMuted" />
          <Text variant="caption" color="textMuted" numberOfLines={1} style={{ flex: 1 }}>
            {l.dateRange(event.start_at, event.end_at)}
          </Text>
        </Row>
        <Row gap={6}>
          <Icon name="location-outline" size={14} color="textMuted" />
          <Text variant="caption" color="textMuted" numberOfLines={1} style={{ flex: 1 }}>
            {[event.area, city].filter(Boolean).join(' · ')}
            {event.distance_from_user_km != null ? ` · ${l.distance(event.distance_from_user_km)}` : ''}
          </Text>
        </Row>
        <Row gap={6} wrap style={{ marginTop: spacing.xs }}>
          <Badge label={l.difficulty(event.difficulty)} tone="textMuted" />
          <Badge
            label={l.seatsLeft(event.seats_left)}
            tone={event.seats_left === 0 ? 'danger' : event.seats_left <= 3 ? 'warning' : 'success'}
          />
          {event.women_only ? <Badge label={t('events.womenOnly')} tone="accent" icon="female" /> : null}
          {event.family_friendly ? <Badge label={t('events.familyFriendly')} tone="primary" icon="people" /> : null}
        </Row>
        <Row gap={8} style={{ marginTop: spacing.sm }}>
          <Avatar uri={event.host_avatar_url} name={event.host_name} size={28} />
          <Text variant="caption" numberOfLines={1} style={{ flexShrink: 1 }}>
            {event.host_name}
          </Text>
          {event.host_verified ? <VerifiedBadge compact /> : null}
          <View style={{ flex: 1 }} />
          <Rating value={event.host_rating} />
        </Row>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  cover: { width: '100%', aspectRatio: 16 / 9 },
  overlayRow: { position: 'absolute', top: 0, start: 0, end: 0, flexDirection: 'row', justifyContent: 'space-between' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
});
