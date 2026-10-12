import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { queryKeys } from '@/lib/queryClient';

import { canReview, getEventReviews, getHostReviews, getMyReview, submitReview, type ReviewFormValues } from './api';

export function useEventReviews(eventId: string) {
  return useQuery({ queryKey: queryKeys.eventReviews(eventId), queryFn: () => getEventReviews(eventId) });
}

export function useHostReviews(hostId: string) {
  return useQuery({ queryKey: queryKeys.hostReviews(hostId), queryFn: () => getHostReviews(hostId) });
}

export function useCanReview(eventId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.canReview(eventId, user?.id),
    queryFn: () => canReview(eventId),
    enabled: Boolean(user),
  });
}

export function useMyReview(eventId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.myReview(eventId, user?.id),
    queryFn: () => getMyReview(eventId, user!.id),
    enabled: Boolean(user),
  });
}

export function useSubmitReview(eventId: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { values: ReviewFormValues; existingId?: string }) =>
      submitReview(eventId, user!.id, p.values, p.existingId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event', eventId] });
      qc.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}
