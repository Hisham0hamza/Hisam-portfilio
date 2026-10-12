import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { queryKeys } from '@/lib/queryClient';

import { getProfile, getProfileStats, updateProfile, type ProfileFormValues } from './api';

export function useProfile(id: string | undefined) {
  return useQuery({ queryKey: queryKeys.profile(id ?? ''), queryFn: () => getProfile(id!), enabled: Boolean(id) });
}

export function useMyProfile() {
  const { user } = useAuth();
  return useProfile(user?.id);
}

export function useProfileStats(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.profileStats(id ?? ''),
    queryFn: () => getProfileStats(id!),
    enabled: Boolean(id),
  });
}

export function useUpdateProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { values: ProfileFormValues; avatarUri?: string | null }) =>
      updateProfile(user!.id, p.values, p.avatarUri),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.profile(user!.id) }),
  });
}
