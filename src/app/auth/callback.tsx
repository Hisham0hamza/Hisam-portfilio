import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { LoadingView } from '@/components/ui';
import { exchangeCodeFromUrl } from '@/features/auth/api';

/** Landing route for OAuth / email-confirmation redirects (masar://auth/callback?code=…). */
export default function AuthCallback() {
  const url = Linking.useLinkingURL();
  useEffect(() => {
    if (!url) return;
    exchangeCodeFromUrl(url)
      .catch((e) => console.warn('Auth callback failed', e))
      .finally(() => router.replace('/'));
  }, [url]);
  return <LoadingView />;
}
