import { router } from 'expo-router';
import { useCallback } from 'react';

import { useAuth } from './AuthProvider';

/** Wraps an action so signed-out users are sent to sign in first. */
export function useRequireAuth() {
  const { user } = useAuth();
  return useCallback(
    (action: () => void) => {
      if (!user) {
        router.push('/sign-in');
        return;
      }
      action();
    },
    [user],
  );
}
