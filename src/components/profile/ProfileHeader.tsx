import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Avatar, Badge, Card, Rating, Row, Text, VerifiedBadge } from '@/components/ui';
import { useLabels } from '@/features/events/useLabels';
import type { Profile } from '@/features/profiles/api';
import { useProfileStats } from '@/features/profiles/hooks';
import { useTheme } from '@/theme/ThemeProvider';

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }} accessible accessibilityLabel={`${value} ${label}`}>
      <Text variant="title">{value}</Text>
      <Text variant="small" color="textMuted" align="center">
        {label}
      </Text>
    </View>
  );
}

export function ProfileHeader({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const l = useLabels();
  const stats = useProfileStats(profile.id);

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <Avatar uri={profile.avatar_url} name={profile.name || '?'} size={96} />
        <Text variant="title" align="center" accessibilityRole="header">
          {profile.name || t('profile.unnamed')}
        </Text>
        <Row gap={6} wrap style={{ justifyContent: 'center' }}>
          {profile.host_verified ? <VerifiedBadge /> : null}
          {profile.is_host && !profile.host_verified ? <Badge label={t('profile.host')} tone="textMuted" /> : null}
          {profile.city ? <Badge label={l.cityName(profile.city)} icon="location-outline" tone="textMuted" /> : null}
        </Row>
        {profile.is_host ? <Rating value={stats.data?.rating_avg ?? null} count={stats.data?.rating_count} size={16} /> : null}
      </View>
      {profile.bio ? <Text align="center">{profile.bio}</Text> : null}

      <Card>
        <Row>
          <Stat value={String(stats.data?.events_attended ?? '–')} label={t('profile.attended')} />
          <Stat value={String(stats.data?.events_hosted ?? '–')} label={t('profile.hosted')} />
          <Stat value={stats.data?.rating_avg != null ? stats.data.rating_avg.toFixed(1) : '–'} label={t('profile.rating')} />
        </Row>
      </Card>

      {profile.languages.length ? (
        <View style={{ gap: spacing.xs }}>
          <Text variant="caption" color="textMuted">
            {t('profile.languages')}
          </Text>
          <Row wrap gap={6}>
            {profile.languages.map((code) => (
              <Badge key={code} label={l.language(code)} tone="primary" />
            ))}
          </Row>
        </View>
      ) : null}
      {profile.interests.length ? (
        <View style={{ gap: spacing.xs }}>
          <Text variant="caption" color="textMuted">
            {t('profile.interests')}
          </Text>
          <Row wrap gap={6}>
            {profile.interests.map((i) => (
              <Badge key={i} label={t(`interests.${i}` as 'interests.heritage', { defaultValue: i })} tone="accent" />
            ))}
          </Row>
        </View>
      ) : null}
    </View>
  );
}
