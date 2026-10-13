import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EventRow } from '@/components/events/EventRow';
import { SignInPrompt } from '@/components/SignInPrompt';
import { Badge, Button, EmptyView, ErrorView, LoadingView, Row, SegmentedControl } from '@/components/ui';
import { usePendingCounts } from '@/features/applications/hooks';
import { seatsLeft } from '@/features/applications/logic';
import { useAuth } from '@/features/auth/AuthProvider';
import { useHostedEvents } from '@/features/events/hooks';
import type { EventListItem } from '@/features/events/schemas';
import { useTheme } from '@/theme/ThemeProvider';

type Tab = 'upcoming' | 'drafts' | 'past';

export default function HostScreen() {
  const { t } = useTranslation();
  const { spacing, colors } = useTheme();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('upcoming');
  const query = useHostedEvents();

  const groups = useMemo(() => {
    const all = query.data ?? [];
    // Published events stay here after they start so the host can take attendance and close them.
    return {
      upcoming: all.filter((e) => e.status === 'published').sort((a, b) => a.start_at.localeCompare(b.start_at)),
      drafts: all.filter((e) => e.status === 'draft'),
      past: all.filter((e) => e.status === 'completed' || e.status === 'cancelled'),
    };
  }, [query.data]);
  const pending = usePendingCounts(groups.upcoming.map((e) => e.id));

  if (!user) return <SignInPrompt icon="flag-outline" message={t('host.signInMessage')} />;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <Button title={t('host.createEvent')} icon="add-circle-outline" onPress={() => router.push('/event/new')} />
        <SegmentedControl<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'upcoming', label: `${t('host.published')} (${groups.upcoming.length})` },
            { value: 'drafts', label: `${t('host.drafts')} (${groups.drafts.length})` },
            { value: 'past', label: `${t('host.past')} (${groups.past.length})` },
          ]}
        />
      </View>
      {query.isLoading ? (
        <LoadingView />
      ) : query.error ? (
        <ErrorView error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          data={groups[tab]}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.md, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyView icon="flag-outline" title={t('host.noEvents')} message={t('host.noEventsHint')} />}
          renderItem={({ item }) => <HostedRow event={item} pending={pending.data?.[item.id] ?? 0} />}
        />
      )}
    </View>
  );
}

function HostedRow({ event, pending }: { event: EventListItem; pending: number }) {
  const { t } = useTranslation();
  const left = seatsLeft(event.capacity, event.approved_count);
  return (
    <EventRow
      event={event}
      badge={
        <>
          <Badge label={t(`eventStatus.${event.status}`)} tone={event.status === 'published' ? 'success' : event.status === 'cancelled' ? 'danger' : 'textMuted'} />
          {event.status === 'published' ? <Badge label={t('host.seatsShort', { taken: event.approved_count, capacity: event.capacity })} tone={left === 0 ? 'danger' : 'primary'} /> : null}
          {pending > 0 ? <Badge label={t('host.pendingCount', { count: pending })} tone="accent" icon="time-outline" /> : null}
        </>
      }
      footer={
        event.status === 'published' ? (
          <Row gap={6} style={{ marginTop: 6 }}>
            <Button title={t('host.applicants')} size="sm" variant="secondary" onPress={() => router.push(`/event/${event.id}/applicants`)} />
            <Button title={t('host.attendance')} size="sm" variant="ghost" onPress={() => router.push(`/event/${event.id}/attendance`)} />
          </Row>
        ) : null
      }
    />
  );
}
