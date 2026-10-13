import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import * as demo from '@/features/demo/api';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

export type AuthUser = { id: string; email?: string | null };

type AuthValue = {
  user: AuthUser | null;
  /** True until the stored session has been restored. */
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;
    // Per-user data (applications, saved events, profile) must be refetched on sign-in/out.
    const changed = (next: AuthUser | null) => {
      setUser(next);
      queryClient.invalidateQueries();
    };

    if (env.isDemo) {
      demo.auth
        .currentUserId()
        .then((id) => mounted && setUser(id ? { id } : null))
        .finally(() => mounted && setLoading(false));
      const off = demo.auth.onChange((id) => changed(id ? { id } : null));
      return () => {
        mounted = false;
        off();
      };
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) setUser(data.session?.user ?? null);
      })
      .finally(() => mounted && setLoading(false));

    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') changed(next?.user ?? null);
      else setUser(next?.user ?? null);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      signOut: async () => {
        if (env.isDemo) await demo.auth.signOut();
        else await supabase.auth.signOut();
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
