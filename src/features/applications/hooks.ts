import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { queryKeys } from '@/lib/queryClient';

import {
  applyToEvent,
  cancelApplication,
  decideApplication,
  getApplicants,
  getMyApplication,
  getMyTrips,
  getPendingCounts,
  markAttendance,
} from './api';

export function useMyApplication(eventId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.myApplication(eventId, user?.id),
    queryFn: () => getMyApplication(eventId, user!.id),
    enabled: Boolean(user),
  });
}

function useRefreshEvent(eventId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['event', eventId] });
    qc.invalidateQueries({ queryKey: ['events'] });
    qc.invalidateQueries({ queryKey: ['me'] });
  };
}

export function useApply(eventId: string) {
  const refresh = useRefreshEvent(eventId);
  return useMutation({
    mutationFn: (message: string | null) => applyToEvent(eventId, message),
    onSettled: refresh, // a failed attempt (e.g. event_full) also means our seat count is stale
  });
}

export function useCancelApplication(eventId: string) {
  const refresh = useRefreshEvent(eventId);
  return useMutation({ mutationFn: () => cancelApplication(eventId), onSettled: refresh });
}

export function useApplicants(eventId: string) {
  return useQuery({ queryKey: queryKeys.applicants(eventId), queryFn: () => getApplicants(eventId) });
}

export function useDecideApplication(eventId: string) {
  const refresh = useRefreshEvent(eventId);
  return useMutation({
    mutationFn: (p: { applicationId: string; approve: boolean }) => decideApplication(p.applicationId, p.approve),
    onSettled: refresh,
  });
}

export function useMarkAttendance(eventId: string) {
  const refresh = useRefreshEvent(eventId);
  return useMutation({
    mutationFn: (p: { applicationId: string; attended: boolean }) => markAttendance(p.applicationId, p.attended),
    onSettled: refresh,
  });
}

export function useMyTrips() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.trips(user?.id ?? ''),
    queryFn: () => getMyTrips(user!.id),
    enabled: Boolean(user),
  });
}

export function usePendingCounts(eventIds: string[]) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...queryKeys.pendingCounts(user?.id ?? ''), eventIds],
    queryFn: () => getPendingCounts(eventIds),
    enabled: Boolean(user) && eventIds.length > 0,
  });
}
