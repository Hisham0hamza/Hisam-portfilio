import { Image } from 'expo-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Dimensions, FlatList, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { MiniMap } from '@/components/map/MiniMap';
import {
  Avatar,
  AvatarStack,
  Badge,
  Button,
  Card,
  Divider,
  EmptyView,
  ErrorView,
  Icon,
  IconButton,
  InfoRow,
  LoadingView,
  Rating,
  Row,
  Section,
  Sheet,
  StarsDisplay,
  Text,
  TextField,
  VerifiedBadge,
} from '@/components/ui';
import { useApply, useCancelApplication, useMyApplication } from '@/features/applications/hooks';
import { applyState, canCancel, seatsLeft, type ApplyState } from '@/features/applications/logic';
import { useAuth } from '@/features/auth/AuthProvider';
import { useRequireAuth } from '@/features/auth/useRequireAuth';
import { useAttendees, useEvent, useEventActions } from '@/features/events/hooks';
import type { EventDetail } from '@/features/events/schemas';
import { CATEGORY_ICONS, useLabels } from '@/features/events/useLabels';
import { useProfileStats } from '@/features/profiles/hooks';
import { useCanReview, useEventReviews } from '@/features/reviews/hooks';
import { useIsSaved, useToggleSaved } from '@/features/saved/hooks';
import { errorKey } from '@/lib/errors';
import { eventShareUrl } from '@/lib/share';
import { useTheme } from '@/theme/ThemeProvider';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useEvent(id);
  const { t } = useTranslation();

  if (query.isLoading) return <LoadingView />;
  if (query.error) return <ErrorView error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data) return <EmptyView icon="alert-circle-outline" title={t('event.notFound')} actionLabel={t('common.back')} onAction={() => router.back()} />;
  return <EventContent event={query.data} />;
}

function EventContent({ event }: { event: EventDetail }) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const l = useLabels();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const isHost = user?.id === event.host_id;

  const myApp = useMyApplication(event.id);
  const attendees = useAttendees(event.id);
  const reviews = useEventReviews(event.id);
  const canReview = useCanReview(event.id);
  const hostStats = useProfileStats(event.host_id);
  const saved = useIsSaved(event.id);
  const toggleSaved = useToggleSaved();

  const state = applyState({ event, application: myApp.data ?? null, userId: user?.id ?? null });
  const left = seatsLeft(event.capacity, event.approved_count);
  const photos = [event.cover_url, ...event.photos.map((p) => p.url)].filter((u): u is string => Boolean(u));
  const [photoIndex, setPhotoIndex] = useState(0);

  const onShare = () =>
    Share.share({ message: `${event.title} · ${l.date(event.start_at)}\n${eventShareUrl(event.id)}`, url: eventShareUrl(event.id) }).catch(() => undefined);

  const onSave = () =>
    requireAuth(() =>
      toggleSaved.mutate({
        event: {
          id: event.id,
          title: event.title,
          category: event.category,
          city: event.city,
          start_at: event.start_at,
          end_at: event.end_at,
          duration_minutes: event.duration_minutes,
          price_egp: event.price_egp,
          capacity: event.capacity,
          approved_count: event.approved_count,
          status: event.status,
          cover_url: event.cover_url,
          approval_mode: event.approval_mode,
        },
        saved: !saved,
      }),
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Row gap={4}>
              <IconButton icon="share-social-outline" label={t('event.share')} onPress={onShare} background={colors.surface} />
              {!isHost ? (
                <IconButton
                  icon={saved ? 'bookmark' : 'bookmark-outline'}
                  label={saved ? t('event.unsave') : t('event.save')}
                  onPress={onSave}
                  color={saved ? 'primary' : 'text'}
                  background={colors.surface}
                />
              ) : null}
            </Row>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl * 2 }}>
          <View>
            {/* Gallery */}
            <View>
              {photos.length ? (
                <FlatList
                  data={photos}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(u, i) => `${u}-${i}`}
                  onMomentumScrollEnd={(e) => setPhotoIndex(Math.round(Math.abs(e.nativeEvent.contentOffset.x) / SCREEN_WIDTH))}
                  renderItem={({ item, index }) => (
                    <Image
                      source={{ uri: item }}
                      style={{ width: SCREEN_WIDTH, height: 280, backgroundColor: colors.surfaceAlt }}
                      contentFit="cover"
                      transition={200}
                      accessibilityLabel={t('event.photoN', { n: index + 1, total: photos.length })}
                    />
                  )}
                />
              ) : (
                <View style={{ height: 120 + insets.top, backgroundColor: colors.primarySoft }} />
              )}
              {photos.length > 1 ? (
                <View style={styles.dots} accessibilityElementsHidden>
                  {photos.map((_, i) => (
                    <View key={i} style={[styles.dot, { backgroundColor: i === photoIndex ? colors.surface : 'rgba(255,255,255,0.5)' }]} />
                  ))}
                </View>
              ) : null}
            </View>

            <View style={{ padding: spacing.lg, gap: spacing.xl }}>
              <StatusBanner event={event} />

              <View style={{ gap: spacing.sm }}>
                <Row gap={6} wrap>
                  <Badge label={l.category(event.category)} icon={CATEGORY_ICONS[event.category]} />
                  {event.women_only ? <Badge label={t('events.womenOnly')} icon="female" tone="accent" /> : null}
                  {event.family_friendly ? <Badge label={t('events.familyFriendly')} icon="people" /> : null}
                </Row>
                <Text variant="display" accessibilityRole="header">
                  {event.title}
                </Text>
                <Text color="textMuted">{[event.area, l.cityName(event.city)].filter(Boolean).join(' · ')}</Text>
              </View>

              {/* Host card */}
              <Pressable
                onPress={() => router.push(`/user/${event.host.id}`)}
                accessibilityRole="button"
                accessibilityLabel={t('event.hostA11y', { name: event.host.name })}
              >
                <Card>
                  <Row gap={spacing.md}>
                    <Avatar uri={event.host.avatar_url} name={event.host.name} size={52} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="small" color="textMuted">
                        {t('event.hostedBy')}
                      </Text>
                      <Row gap={6}>
                        <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
                          {event.host.name}
                        </Text>
                        {event.host.host_verified ? <VerifiedBadge compact /> : null}
                      </Row>
                      <Rating value={hostStats.data?.rating_avg ?? null} count={hostStats.data?.rating_count} />
                    </View>
                    <Icon name="chevron-forward" color="textMuted" directional />
                  </Row>
                </Card>
              </Pressable>

              {/* Key facts */}
              <Card>
                <View style={{ gap: spacing.md }}>
                  <InfoRow icon="calendar-outline" label={t('event.when')} value={l.dateRange(event.start_at, event.end_at)} />
                  <InfoRow icon="time-outline" label={t('event.duration')} value={l.duration(event.duration_minutes)} />
                  <InfoRow
                    icon="trending-up-outline"
                    label={t('event.difficultyDistance')}
                    value={[l.difficulty(event.difficulty), event.distance_km != null ? l.distance(event.distance_km) : null].filter(Boolean).join(' · ')}
                  />
                  <InfoRow icon="language-outline" label={t('event.languages')} value={event.languages.map(l.language).join(' · ')} />
                  <InfoRow
                    icon="people-outline"
                    label={t('event.seats')}
                    value={`${l.seatsLeft(left)} · ${t('event.capacity', { count: event.capacity })}`}
                  />
                  <InfoRow icon="pricetag-outline" label={t('event.price')} value={l.price(event.price_egp)} />
                  {event.includes ? <InfoRow icon="checkmark-done-outline" label={t('event.includes')} value={event.includes} /> : null}
                  <InfoRow
                    icon={event.approval_mode === 'auto' ? 'flash-outline' : 'hand-left-outline'}
                    label={t('event.approval')}
                    value={event.approval_mode === 'auto' ? t('event.autoApproval') : t('event.manualApproval')}
                  />
                </View>
              </Card>

              <Section title={t('event.about')}>
                <Text>{event.description}</Text>
              </Section>

              <Section title={t('event.meetingPoint')}>
                <Text>{event.meeting_address}</Text>
                <MiniMap meeting={{ lat: event.meeting_lat, lng: event.meeting_lng }} stops={event.stops.map((s) => ({ lat: s.lat, lng: s.lng, name: s.name }))} />
              </Section>

              {event.stops.length ? (
                <Section title={t('event.route')}>
                  <View style={{ gap: spacing.sm }}>
                    {event.stops.map((s, i) => (
                      <Row key={s.id} gap={spacing.md}>
                        <View style={[styles.stopNumber, { backgroundColor: colors.primarySoft, borderRadius: radius.pill }]}>
                          <Text variant="small" color="primary">
                            {i + 1}
                          </Text>
                        </View>
                        <Text style={{ flex: 1 }}>{s.name}</Text>
                      </Row>
                    ))}
                  </View>
                </Section>
              ) : null}

              {event.what_to_bring ? (
                <Section title={t('event.whatToBring')}>
                  <Text>{event.what_to_bring}</Text>
                </Section>
              ) : null}

              {event.cancellation_policy ? (
                <Section title={t('event.cancellationPolicy')}>
                  <Text>{event.cancellation_policy}</Text>
                </Section>
              ) : null}

              <Section title={t('event.attendees', { count: attendees.data?.length ?? 0 })}>
                {attendees.data?.length ? (
                  <AvatarStack people={attendees.data.map((a) => ({ id: a.user_id, name: a.name, avatar_url: a.avatar_url }))} max={8} />
                ) : (
                  <Text color="textMuted">{t('event.beFirst')}</Text>
                )}
              </Section>

              <Section
                title={t('reviews.title')}
                action={
                  canReview.data ? (
                    <Button title={t('reviews.write')} size="sm" variant="secondary" onPress={() => router.push(`/event/${event.id}/review`)} />
                  ) : undefined
                }
              >
                {reviews.data?.length ? (
                  <View style={{ gap: spacing.md }}>
                    {reviews.data.map((r) => (
                      <View key={r.id} style={{ gap: spacing.xs }}>
                        <Row gap={spacing.sm}>
                          <Avatar uri={r.reviewer.avatar_url} name={r.reviewer.name} size={32} />
                          <Text variant="bodyStrong" style={{ flex: 1 }}>
                            {r.reviewer.name}
                          </Text>
                          <StarsDisplay value={r.rating} />
                        </Row>
                        {r.comment ? <Text color="textMuted">{r.comment}</Text> : null}
                        <Divider />
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text color="textMuted">{reviews.isLoading ? t('common.loading') : t('reviews.none')}</Text>
                )}
              </Section>

              {isHost ? <HostActions event={event} /> : null}
            </View>
          </View>
      </ScrollView>

      {!isHost ? (
        <ApplyFooter event={event} state={state} seats={left} hasApplication={Boolean(myApp.data)} onRequireAuth={requireAuth} />
      ) : null}
    </View>
  );
}

function StatusBanner({ event }: { event: EventDetail }) {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  if (event.status === 'published') return null;
  const tone = event.status === 'cancelled' ? colors.danger : event.status === 'completed' ? colors.success : colors.warning;
  return (
    <View accessibilityRole="alert" style={{ borderWidth: 1, borderColor: tone, borderRadius: radius.md, padding: spacing.md }}>
      <Text variant="bodyStrong" style={{ color: tone }}>
        {t(`eventStatus.${event.status}`)}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Apply / cancel footer
// ---------------------------------------------------------------------------
function ApplyFooter({
  event,
  state,
  seats,
  hasApplication,
  onRequireAuth,
}: {
  event: EventDetail;
  state: ApplyState;
  seats: number;
  hasApplication: boolean;
  onRequireAuth: (fn: () => void) => void;
}) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const l = useLabels();
  const apply = useApply(event.id);
  const cancel = useCancelApplication(event.id);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [message, setMessage] = useState('');

  const submit = () =>
    apply.mutate(message.trim() || null, {
      onSuccess: (app) => {
        setSheetOpen(false);
        setMessage('');
        Alert.alert(
          app.status === 'approved' ? t('apply.approvedTitle') : t('apply.pendingTitle'),
          app.status === 'approved' ? t('apply.approvedBody') : t('apply.pendingBody'),
        );
      },
      onError: (e) => Alert.alert(t('apply.failed'), t(errorKey(e))),
    });

  const confirmCancel = () =>
    Alert.alert(t('apply.cancelTitle'), t('apply.cancelBody'), [
      { text: t('common.no'), style: 'cancel' },
      {
        text: t('apply.cancelConfirm'),
        style: 'destructive',
        onPress: () => cancel.mutate(undefined, { onError: (e) => Alert.alert(t('common.somethingWrong'), t(errorKey(e))) }),
      },
    ]);

  let primary: React.ReactNode;
  switch (state) {
    case 'can_apply':
    case 'can_reapply':
      primary = (
        <Button
          title={event.approval_mode === 'auto' ? t('apply.join') : t('apply.apply')}
          icon="walk"
          onPress={() => onRequireAuth(() => setSheetOpen(true))}
        />
      );
      break;
    case 'pending':
    case 'approved':
      primary = canCancel(state, event.start_at) ? (
        <Button title={t('apply.cancel')} variant="danger" loading={cancel.isPending} onPress={confirmCancel} />
      ) : null;
      break;
    default:
      primary = null;
  }

  const statusText: Partial<Record<ApplyState, string>> = {
    full: t('apply.full'),
    pending: t('apply.statusPending'),
    approved: t('apply.statusApproved'),
    rejected: t('apply.statusRejected'),
    attended: t('apply.statusAttended'),
    no_show: t('apply.statusNoShow'),
    closed: t(`eventStatus.${event.status}`),
    started: t('apply.started'),
  };

  return (
    <>
      <View
        style={[
          styles.footer,
          { backgroundColor: colors.surface, borderColor: colors.border, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: Math.max(insets.bottom, spacing.md) },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text variant="heading">{l.price(event.price_egp)}</Text>
          <Text variant="small" color={statusText[state] ? (state === 'approved' ? 'success' : state === 'rejected' || state === 'full' ? 'danger' : 'textMuted') : seats <= 3 ? 'warning' : 'textMuted'} accessibilityLiveRegion="polite">
            {statusText[state] ?? l.seatsLeft(seats)}
          </Text>
        </View>
        {primary}
      </View>

      <Sheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={event.approval_mode === 'auto' ? t('apply.join') : t('apply.apply')}
        footer={<Button title={t('apply.send')} loading={apply.isPending} onPress={submit} fullWidth />}
      >
        <Text>{event.approval_mode === 'auto' ? t('apply.autoExplain') : t('apply.manualExplain')}</Text>
        <TextField
          label={t('apply.messageLabel')}
          placeholder={t('apply.messagePlaceholder')}
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={1000}
        />
        {hasApplication ? (
          <Text variant="small" color="textMuted">
            {t('apply.reapplyNote')}
          </Text>
        ) : null}
      </Sheet>
    </>
  );
}

// ---------------------------------------------------------------------------
// Host tools
// ---------------------------------------------------------------------------
function HostActions({ event }: { event: EventDetail }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const actions = useEventActions(event.id);
  const started = new Date(event.start_at) <= new Date();
  const open = event.status === 'published' || event.status === 'draft';

  const confirmCancel = () =>
    Alert.alert(t('host.cancelEventTitle'), t('host.cancelEventBody'), [
      { text: t('common.no'), style: 'cancel' },
      {
        text: t('host.cancelEvent'),
        style: 'destructive',
        onPress: () => actions.cancel.mutate(undefined, { onError: (e) => Alert.alert(t('common.somethingWrong'), t(errorKey(e))) }),
      },
    ]);

  return (
    <Section title={t('host.manage')}>
      <View style={{ gap: spacing.sm }}>
        {open ? <Button title={t('host.editEvent')} icon="create-outline" variant="secondary" onPress={() => router.push(`/event/${event.id}/edit`)} /> : null}
        <Button title={t('host.applicants')} icon="people-outline" variant="secondary" onPress={() => router.push(`/event/${event.id}/applicants`)} />
        {event.status !== 'draft' ? (
          <Button title={t('host.attendance')} icon="checkbox-outline" variant="secondary" onPress={() => router.push(`/event/${event.id}/attendance`)} />
        ) : null}
        {event.status === 'published' && started ? (
          <Button
            title={t('host.markCompleted')}
            icon="flag-outline"
            loading={actions.complete.isPending}
            onPress={() => actions.complete.mutate(undefined, { onError: (e) => Alert.alert(t('common.somethingWrong'), t(errorKey(e))) })}
          />
        ) : null}
        {open ? <Button title={t('host.cancelEvent')} icon="close-circle-outline" variant="danger" loading={actions.cancel.isPending} onPress={confirmCancel} /> : null}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  dots: { position: 'absolute', bottom: 12, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  stopNumber: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
