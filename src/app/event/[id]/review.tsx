import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, EmptyView, LoadingView, Screen, StarsInput, Text, TextField } from '@/components/ui';
import { useEvent } from '@/features/events/hooks';
import { reviewFormSchema, type Review } from '@/features/reviews/api';
import { useCanReview, useMyReview, useSubmitReview } from '@/features/reviews/hooks';
import { errorKey } from '@/lib/errors';

export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const event = useEvent(id);
  const can = useCanReview(id);
  const mine = useMyReview(id);

  if (event.isLoading || can.isLoading || mine.isLoading) return <LoadingView />;
  if (!can.data || !event.data) return <EmptyView icon="lock-closed-outline" title={t('reviews.onlyAttendees')} />;
  return <ReviewForm eventId={id} title={event.data.title} hostName={event.data.host.name} existing={mine.data ?? null} />;
}

function ReviewForm({ eventId, title, hostName, existing }: { eventId: string; title: string; hostName: string; existing: Review | null }) {
  const { t } = useTranslation();
  const submit = useSubmitReview(eventId);
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = () => {
    const parsed = reviewFormSchema.safeParse({ rating, comment });
    if (!parsed.success) {
      setError(t(`form.errors.${parsed.error.issues[0].message}` as 'form.errors.required'));
      return;
    }
    setError(null);
    submit.mutate(
      { values: parsed.data, existingId: existing?.id },
      {
        onSuccess: () => router.back(),
        onError: (e) => Alert.alert(t('common.somethingWrong'), t(errorKey(e))),
      },
    );
  };

  return (
    <Screen scroll edges={['bottom']} footer={<Button title={t('reviews.submit')} loading={submit.isPending} onPress={onSubmit} />}>
      <Text variant="title">{title}</Text>
      <Text color="textMuted">{t('reviews.prompt', { host: hostName })}</Text>
      <StarsInput value={rating} onChange={setRating} />
      {error ? (
        <Text color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <TextField label={t('reviews.comment')} value={comment} onChangeText={setComment} multiline maxLength={2000} placeholder={t('reviews.commentPlaceholder')} />
    </Screen>
  );
}
