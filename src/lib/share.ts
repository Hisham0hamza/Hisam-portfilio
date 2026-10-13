import * as Linking from 'expo-linking';
import { Platform, Share } from 'react-native';

import { env } from './env';

/** Deep link for an event: https link if a share domain is configured, else masar://event/<id>. */
export function eventShareUrl(eventId: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && !env.shareBaseUrl) {
    const base = (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');
    return `${window.location.origin}${base}/event/${eventId}`;
  }
  return env.shareBaseUrl ? `${env.shareBaseUrl.replace(/\/$/, '')}/event/${eventId}` : Linking.createURL(`/event/${eventId}`);
}

/** Opens the share sheet; on web uses the Web Share API or copies the link. Returns 'copied' when it fell back to the clipboard. */
export async function shareLink(title: string, url: string): Promise<'shared' | 'copied' | 'failed'> {
  if (Platform.OS === 'web') {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    try {
      if (nav?.share) {
        await nav.share({ title, url });
        return 'shared';
      }
      await nav?.clipboard?.writeText(url);
      return 'copied';
    } catch {
      return 'failed';
    }
  }
  try {
    await Share.share({ message: `${title}\n${url}`, url });
    return 'shared';
  } catch {
    return 'failed';
  }
}
