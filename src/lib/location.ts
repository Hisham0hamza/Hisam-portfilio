import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

export type UserLocation = { lat: number; lng: number };

/** Asks for foreground location once; resolves to null if denied or unavailable. */
export function useUserLocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [status, setStatus] = useState<'loading' | 'granted' | 'denied'>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') {
          if (!cancelled) setStatus('denied');
          return;
        }
        const last = await Location.getLastKnownPositionAsync().catch(() => null);
        if (last && !cancelled) setLocation({ lat: last.coords.latitude, lng: last.coords.longitude });
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) {
          setLocation({ lat: current.coords.latitude, lng: current.coords.longitude });
          setStatus('granted');
        }
      } catch {
        if (!cancelled) setStatus('denied');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { location, status };
}
