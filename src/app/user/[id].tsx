import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EventRow } from '@/components/events/EventRow';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { Avatar, Divider, EmptyView, QueryState, Row, Screen, Section, StarsDisplay, Text } from '@/components/ui';
import { useProfileHostedEvents } from '@/features/events/hooks';
import { useProfile } from '@/features/profiles/hooks';
import { useHostReviews } from '@/features/reviews/hooks';
import { useTheme } from '@/theme/ThemeProvider';

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const query = useProfile(id);
  return (
    <QueryState query={query}>
      {(profile) =>
        profile ? (
          <Screen scroll edges={[]}>
            <Stack.Screen options={{ title: profile.name }} />
            <ProfileHeader profile={profile} />
            {profile.is_host ? <HostSections hostId={profile.id} /> : null}
          </Screen>
        ) : (
          <EmptyView icon="person-outline" title={t('profile.notFound')} />
        )
      }
    </QueryState>
  );
}

function HostSections({ hostId }: { hostId: string }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const events = useProfileHostedEvents(hostId);
  const reviews = useHostReviews(hostId);
  const upcoming = (events.data ?? []).filter((e) => e.status === 'published' && new Date(e.start_at) > new Date());

  return (
    <>
      <Section title={t('profile.upcomingEvents')}>
        {upcoming.length ? (
          upcoming.map((e) => <EventRow key={e.id} event={e} />)
        ) : (
          <Text color="textMuted">{events.isLoading ? t('common.loading') : t('profile.noUpcoming')}</Text>
        )}
      </Section>
      <Section title={t('reviews.title')}>
        {reviews.data?.length ? (
          reviews.data.map((r) => (
            <View key={r.id} style={{ gap: spacing.xs }}>
              <Row gap={spacing.sm}>
                <Avatar uri={r.reviewer.avatar_url} name={r.reviewer.name} size={32} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{r.reviewer.name}</Text>
                  {r.event ? (
                    <Text variant="small" color="textMuted" numberOfLines={1}>
                      {r.event.title}
                    </Text>
                  ) : null}
                </View>
                <StarsDisplay value={r.rating} />
              </Row>
              {r.comment ? <Text color="textMuted">{r.comment}</Text> : null}
              <Divider />
            </View>
          ))
        ) : (
          <Text color="textMuted">{t('reviews.none')}</Text>
        )}
      </Section>
    </>
  );
}
