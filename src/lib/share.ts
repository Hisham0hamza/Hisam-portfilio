import * as Linking from 'expo-linking';

import { env } from './env';

/** Deep link for an event: https link if a share domain is configured, else masar://event/<id>. */
export function eventShareUrl(eventId: string) {
  return env.shareBaseUrl ? `${env.shareBaseUrl.replace(/\/$/, '')}/event/${eventId}` : Linking.createURL(`/event/${eventId}`);
}
