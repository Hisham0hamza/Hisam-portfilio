import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Avatar, Badge, Button, Card, EmptyView, ErrorView, LoadingView, Row, SegmentedControl, Text } from '@/components/ui';
import type { Applicant } from '@/features/applications/api';
import { useApplicants, useDecideApplication } from '@/features/applications/hooks';
import { seatsLeft } from '@/features/applications/logic';
import { useEvent } from '@/features/events/hooks';
import { useLabels } from '@/features/events/useLabels';
import { errorKey } from '@/lib/errors';
import { useTheme } from '@/theme/ThemeProvider';
import { showAlert } from '@/lib/dialogs';

type Tab = 'pending' | 'approved' | 'other';

export default function ApplicantsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { spacing, colors } = useTheme();
  const event = useEvent(id);
  const query = useApplicants(id);
  const [tab, setTab] = useState<Tab>('pending');

  if (query.isLoading || event.isLoading) return <LoadingView />;
  if (query.error) return <ErrorView error={query.error} onRetry={() => query.refetch()} />;

  const all = query.data ?? [];
  const byTab: Record<Tab, Applicant[]> = {
    pending: all.filter((a) => a.status === 'pending'),
    approved: all.filter((a) => a.status === 'approved' || a.status === 'attended'),
    other: all.filter((a) => !['pending', 'approved', 'attended'].includes(a.status)),
  };
  const left = event.data ? seatsLeft(event.data.capacity, event.data.approved_count) : 0;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        {event.data ? (
          <Text variant="caption" color="textMuted" accessibilityLiveRegion="polite">
            {t('host.seatsSummary', { taken: event.data.approved_count, capacity: event.data.capacity, left })}
          </Text>
        ) : null}
        <SegmentedControl<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'pending', label: `${t('applicationStatus.pending')} (${byTab.pending.length})` },
            { value: 'approved', label: `${t('applicationStatus.approved')} (${byTab.approved.length})` },
            { value: 'other', label: `${t('host.other')} (${byTab.other.length})` },
          ]}
        />
      </View>
      <FlatList
        data={byTab[tab]}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.md, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.primary} />}
        ListEmptyComponent={<EmptyView icon="people-outline" title={t('host.noApplicants')} />}
        renderItem={({ item }) => <ApplicantRow applicant={item} eventId={id} full={left === 0} />}
      />
    </View>
  );
}

function ApplicantRow({ applicant, eventId, full }: { applicant: Applicant; eventId: string; full: boolean }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const l = useLabels();
  const decide = useDecideApplication(eventId);
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);

  const run = (approve: boolean) => {
    setBusy(approve ? 'approve' : 'reject');
    decide.mutate(
      { applicationId: applicant.id, approve },
      {
        onError: (e) => showAlert(t('common.somethingWrong'), t(errorKey(e))),
        onSettled: () => setBusy(null),
      },
    );
  };

  return (
    <Card>
      <View style={{ gap: spacing.md }}>
        <Row gap={spacing.md}>
          <Avatar uri={applicant.user.avatar_url} name={applicant.user.name} size={44} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong" onPress={() => router.push(`/user/${applicant.user.id}`)} accessibilityRole="link">
              {applicant.user.name}
            </Text>
            <Text variant="small" color="textMuted">
              {[l.cityName(applicant.user.city), l.date(applicant.created_at)].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Badge label={l.applicationStatus(applicant.status)} tone={applicant.status === 'approved' || applicant.status === 'attended' ? 'success' : applicant.status === 'pending' ? 'warning' : 'textMuted'} />
        </Row>
        {applicant.message ? <Text color="textMuted">“{applicant.message}”</Text> : null}
        {applicant.status === 'pending' ? (
          <Row gap={spacing.sm}>
            <View style={{ flex: 1 }}>
              <Button title={t('host.reject')} variant="danger" size="sm" loading={busy === 'reject'} disabled={busy !== null} onPress={() => run(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title={t('host.approve')} size="sm" icon="checkmark" loading={busy === 'approve'} disabled={busy !== null || full} onPress={() => run(true)} />
            </View>
          </Row>
        ) : null}
        {applicant.status === 'pending' && full ? (
          <Text variant="small" color="warning">
            {t('host.fullCannotApprove')}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
