import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import type { EventListItem } from '@/features/events/schemas';
import { queryKeys } from '@/lib/queryClient';

import { getSavedEvents, setSaved } from './api';

export function useSavedEvents() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.saved(user?.id ?? ''),
    queryFn: () => getSavedEvents(user!.id),
    enabled: Boolean(user),
  });
}

export function useIsSaved(eventId: string) {
  const { data } = useSavedEvents();
  return Boolean(data?.some((e) => e.id === eventId));
}

/** Optimistically toggles a saved event. */
export function useToggleSaved() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = queryKeys.saved(user?.id ?? '');
  return useMutation({
    mutationFn: (p: { event: EventListItem; saved: boolean }) => setSaved(user!.id, p.event.id, p.saved),
    onMutate: async ({ event, saved }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<EventListItem[]>(key);
      qc.setQueryData<EventListItem[]>(key, (old = []) =>
        saved ? [event, ...old.filter((e) => e.id !== event.id)] : old.filter((e) => e.id !== event.id),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}
