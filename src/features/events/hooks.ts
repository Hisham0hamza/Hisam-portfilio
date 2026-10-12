import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { toRpcFilters, type Bbox, type LatLngLiteral, type SearchFilters } from '@/features/search/filters';
import { queryKeys } from '@/lib/queryClient';

import {
  cancelEvent,
  completeEvent,
  deleteDraft,
  getAttendees,
  getCities,
  getEvent,
  getHostedEvents,
  saveEvent,
  searchEvents,
} from './api';
import type { EventFormValues, EventStatus } from './schemas';

const PAGE_SIZE = 20;

export function useCities() {
  return useQuery({ queryKey: queryKeys.cities, queryFn: getCities, staleTime: Infinity });
}

/** Paged results for the list view. */
export function useEventList(filters: SearchFilters, userLocation: LatLngLiteral | null) {
  const keyPayload = toRpcFilters(filters, { userLocation, limit: PAGE_SIZE });
  // date presets resolve against "now"; drop the exact timestamps from the cache key.
  const { date_from: _from, date_to: _to, ...stableKey } = keyPayload;
  return useInfiniteQuery({
    queryKey: queryKeys.search({ view: 'list', ...stableKey, datePreset: filters.datePreset, dateFrom: filters.dateFrom, dateTo: filters.dateTo }),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => searchEvents(filters, { userLocation, limit: PAGE_SIZE, offset: pageParam }),
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.rows.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
    placeholderData: keepPreviousData,
  });
}

/** All matching pins for the map (optionally limited to the searched area). */
export function useEventMap(filters: SearchFilters, bbox: Bbox | null, userLocation: LatLngLiteral | null) {
  return useQuery({
    queryKey: queryKeys.search({ view: 'map', filters, bbox, userLocation: Boolean(userLocation) }),
    queryFn: () => searchEvents({ ...filters, sort: 'soonest' }, { bbox, userLocation, limit: 500 }),
    placeholderData: keepPreviousData,
  });
}

export function useEvent(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.event(id ?? ''),
    queryFn: () => getEvent(id!),
    enabled: Boolean(id),
  });
}

export function useAttendees(id: string) {
  return useQuery({ queryKey: queryKeys.attendees(id), queryFn: () => getAttendees(id) });
}

export function useHostedEvents() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.hosted(user?.id ?? ''),
    queryFn: () => getHostedEvents(user!.id),
    enabled: Boolean(user),
  });
}

export function useProfileHostedEvents(hostId: string) {
  return useQuery({
    queryKey: queryKeys.profileHosted(hostId),
    queryFn: () => getHostedEvents(hostId, ['published', 'completed']),
  });
}

function useInvalidateEvent() {
  const qc = useQueryClient();
  return (eventId?: string) => {
    qc.invalidateQueries({ queryKey: ['events'] });
    qc.invalidateQueries({ queryKey: ['me'] });
    if (eventId) qc.invalidateQueries({ queryKey: ['event', eventId] });
  };
}

export function useSaveEvent() {
  const { user } = useAuth();
  const invalidate = useInvalidateEvent();
  return useMutation({
    mutationFn: (p: { id?: string; values: EventFormValues; status: EventStatus }) =>
      saveEvent({ ...p, hostId: user!.id }),
    onSuccess: (id) => invalidate(id),
  });
}

export function useEventActions(eventId: string) {
  const invalidate = useInvalidateEvent();
  const onSuccess = () => invalidate(eventId);
  return {
    cancel: useMutation({ mutationFn: () => cancelEvent(eventId), onSuccess }),
    complete: useMutation({ mutationFn: () => completeEvent(eventId), onSuccess }),
    deleteDraft: useMutation({ mutationFn: () => deleteDraft(eventId), onSuccess }),
  };
}
