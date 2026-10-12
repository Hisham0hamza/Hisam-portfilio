import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function projectId() {
  return (
    env.easProjectId ??
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

/**
 * Asks for permission and stores this device's Expo push token for the user.
 * Silently does nothing on simulators, without an EAS project id, or when denied.
 */
export async function registerForPushNotifications(userId: string, locale: string) {
  if (!Device.isDevice || Platform.OS === 'web') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Masar',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return null;

  const id = projectId();
  if (!id) {
    console.warn('Push notifications need an EAS project id (EXPO_PUBLIC_EAS_PROJECT_ID).');
    return null;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    await supabase
      .from('push_tokens')
      .upsert({ token, user_id: userId, platform: Platform.OS, locale, updated_at: new Date().toISOString() });
    return token;
  } catch (e) {
    console.warn('Could not register for push notifications', e);
    return null;
  }
}

/** Registers the device when signed in and opens the related event when a notification is tapped. */
export function usePushNotifications(userId: string | null | undefined, locale: string) {
  useEffect(() => {
    if (userId) registerForPushNotifications(userId, locale);
  }, [userId, locale]);

  useEffect(() => {
    const open = (response: Notifications.NotificationResponse | null) => {
      const eventId = response?.notification.request.content.data?.eventId;
      if (typeof eventId === 'string') router.push(`/event/${eventId}`);
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) open(last);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
}
