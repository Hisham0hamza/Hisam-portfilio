import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EventRow } from '@/components/events/EventRow';
import { SignInPrompt } from '@/components/SignInPrompt';
import { Badge, Button, EmptyView, ErrorView, LoadingView, SegmentedControl } from '@/components/ui';
import type { Trip } from '@/features/applications/api';
import { useMyTrips } from '@/features/applications/hooks';
import { useAuth } from '@/features/auth/AuthProvider';
import type { EventListItem } from '@/features/events/schemas';
import { useLabels } from '@/features/events/useLabels';
import { useSavedEvents } from '@/features/saved/hooks';
import { useTheme } from '@/theme/ThemeProvider';

type Tab = 'upcoming' | 'past' | 'saved';

const isPast = (e: EventListItem) =>
  e.status === 'completed' || new Date(e.end_at ?? new Date(new Date(e.start_at).getTime() + e.duration_minutes * 60000)) < new Date();

export default function TripsScreen() {
  const { t } = useTranslation();
  const { spacing, colors } = useTheme();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('upcoming');
  const trips = useMyTrips();
  const saved = useSavedEvents();

  // Applications the walker withdrew themselves are hidden; rejections stay visible.
  const { upcoming, past } = useMemo(() => {
    const visible = (trips.data ?? []).filter((tr) => tr.status !== 'cancelled');
    return {
      upcoming: visible.filter((tr) => !isPast(tr.event)).sort((a, b) => a.event.start_at.localeCompare(b.event.start_at)),
      past: visible.filter((tr) => isPast(tr.event)),
    };
  }, [trips.data]);

  if (!user) return <SignInPrompt icon="footsteps-outline" message={t('trips.signInMessage')} />;

  const query = tab === 'saved' ? saved : trips;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: spacing.lg }}>
        <SegmentedControl<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'upcoming', label: t('trips.upcoming') },
            { value: 'past', label: t('trips.past') },
            { value: 'saved', label: t('trips.saved') },
          ]}
        />
      </View>
      {query.isLoading ? (
        <LoadingView />
      ) : query.error ? (
        <ErrorView error={query.error} onRetry={() => query.refetch()} />
      ) : tab === 'saved' ? (
        <FlatList
          data={saved.data ?? []}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.md, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={saved.isRefetching} onRefresh={() => saved.refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyView icon="bookmark-outline" title={t('trips.noSaved')} message={t('trips.noSavedHint')} />}
          renderItem={({ item }) => <EventRow event={item} />}
        />
      ) : (
        <FlatList
          data={tab === 'upcoming' ? upcoming : past}
          keyExtractor={(tr) => tr.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.md, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={trips.isRefetching} onRefresh={() => trips.refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyView
              icon="walk-outline"
              title={tab === 'upcoming' ? t('trips.noUpcoming') : t('trips.noPast')}
              actionLabel={tab === 'upcoming' ? t('trips.explore') : undefined}
              onAction={() => router.navigate('/')}
            />
          }
          renderItem={({ item }) => <TripRow trip={item} />}
        />
      )}
    </View>
  );
}

function TripRow({ trip }: { trip: Trip }) {
  const { t } = useTranslation();
  const l = useLabels();
  const tone = trip.status === 'approved' || trip.status === 'attended' ? 'success' : trip.status === 'pending' ? 'warning' : trip.status === 'rejected' || trip.status === 'no_show' ? 'danger' : 'textMuted';
  const canReview = trip.event.status === 'completed' && (trip.status === 'approved' || trip.status === 'attended');
  return (
    <EventRow
      event={trip.event}
      badge={
        <>
          <Badge label={l.applicationStatus(trip.status)} tone={tone} />
          {trip.event.status === 'cancelled' ? <Badge label={t('eventStatus.cancelled')} tone="danger" /> : null}
        </>
      }
      footer={
        canReview ? (
          <View style={{ marginTop: 6, alignSelf: 'flex-start' }}>
            <Button title={t('reviews.write')} size="sm" variant="secondary" icon="star-outline" onPress={() => router.push(`/event/${trip.event.id}/review`)} />
          </View>
        ) : null
      }
    />
  );
}
