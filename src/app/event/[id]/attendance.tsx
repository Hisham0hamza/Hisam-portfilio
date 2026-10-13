import { useLocalSearchParams } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Avatar, EmptyView, ErrorView, Icon, LoadingView, Row, Text } from '@/components/ui';
import type { Applicant } from '@/features/applications/api';
import { useApplicants, useMarkAttendance } from '@/features/applications/hooks';
import { useEvent } from '@/features/events/hooks';
import { errorKey } from '@/lib/errors';
import { useTheme } from '@/theme/ThemeProvider';
import { showAlert } from '@/lib/dialogs';

/** Host check-in list: mark each approved walker as attended or no-show. */
export default function AttendanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { spacing, colors } = useTheme();
  const event = useEvent(id);
  const query = useApplicants(id);
  const mark = useMarkAttendance(id);

  if (query.isLoading || event.isLoading) return <LoadingView />;
  if (query.error) return <ErrorView error={query.error} onRetry={() => query.refetch()} />;

  const list = (query.data ?? []).filter((a) => ['approved', 'attended', 'no_show'].includes(a.status));
  const opensAt = event.data ? new Date(new Date(event.data.start_at).getTime() - 2 * 3600_000) : null;
  const tooEarly = opensAt ? opensAt > new Date() : false;
  const present = list.filter((a) => a.status === 'attended').length;

  const set = (a: Applicant, attended: boolean) =>
    mark.mutate({ applicationId: a.id, attended }, { onError: (e) => showAlert(t('common.somethingWrong'), t(errorKey(e))) });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: spacing.lg, gap: spacing.xs }}>
        <Text variant="heading" accessibilityLiveRegion="polite">
          {t('host.checkedIn', { present, total: list.length })}
        </Text>
        {tooEarly ? (
          <Text color="warning">{t('host.checkInOpens')}</Text>
        ) : (
          <Text variant="caption" color="textMuted">
            {t('host.checkInHint')}
          </Text>
        )}
      </View>
      <FlatList
        data={list}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.sm, flexGrow: 1 }}
        ListEmptyComponent={<EmptyView icon="people-outline" title={t('host.noAttendees')} />}
        renderItem={({ item }) => (
          <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border, padding: spacing.md }]}>
            <Row gap={spacing.md} style={{ flex: 1 }}>
              <Avatar uri={item.user.avatar_url} name={item.user.name} size={40} />
              <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                {item.user.name}
              </Text>
            </Row>
            <Toggle
              label={t('applicationStatus.no_show')}
              icon="close"
              active={item.status === 'no_show'}
              tone="danger"
              disabled={tooEarly}
              onPress={() => set(item, false)}
            />
            <Toggle
              label={t('applicationStatus.attended')}
              icon="checkmark"
              active={item.status === 'attended'}
              tone="success"
              disabled={tooEarly}
              onPress={() => set(item, true)}
            />
          </View>
        )}
      />
    </View>
  );
}

function Toggle({ label, icon, active, tone, disabled, onPress }: { label: string; icon: 'close' | 'checkmark'; active: boolean; tone: 'danger' | 'success'; disabled: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: active, disabled }}
      accessibilityLabel={label}
      style={[styles.toggle, { borderColor: colors[tone], backgroundColor: active ? colors[tone] : 'transparent', opacity: disabled ? 0.4 : 1 }]}
    >
      <Icon name={icon} size={22} color={active ? 'surface' : tone} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  toggle: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
