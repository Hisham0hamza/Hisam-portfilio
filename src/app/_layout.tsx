import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { usePushNotifications } from '@/features/notifications/push';
import { SearchProvider } from '@/features/search/SearchContext';
import { initI18n } from '@/i18n';
import { queryClient } from '@/lib/queryClient';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initI18n()
      .catch((e) => console.warn('i18n init failed', e))
      .finally(() => {
        setReady(true);
        SplashScreen.hideAsync().catch(() => undefined);
      });
  }, []);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <SearchProvider>
              <Navigation />
            </SearchProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function Navigation() {
  const { colors, scheme } = useTheme();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  usePushNotifications(user?.id, i18n.language);

  const navTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, primary: colors.primary, background: colors.background, card: colors.surface, text: colors.text, border: colors.border },
    };
  }, [scheme, colors]);

  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <WebFrame>
      <Stack
        screenOptions={{
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text },
          headerStyle: { backgroundColor: colors.surface },
          contentStyle: { backgroundColor: colors.background },
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="event/[id]/index" options={{ title: '', headerTransparent: true }} />
        <Stack.Screen name="event/new" options={{ title: t('host.createEvent') }} />
        <Stack.Screen name="event/[id]/edit" options={{ title: t('host.editEvent') }} />
        <Stack.Screen name="event/[id]/applicants" options={{ title: t('host.applicants') }} />
        <Stack.Screen name="event/[id]/attendance" options={{ title: t('host.attendance') }} />
        <Stack.Screen name="event/[id]/review" options={{ title: t('reviews.write'), presentation: 'modal' }} />
        <Stack.Screen name="user/[id]" options={{ title: '' }} />
        <Stack.Screen name="edit-profile" options={{ title: t('profile.edit') }} />
        <Stack.Screen name="sign-in" options={{ title: t('auth.signIn'), presentation: 'modal' }} />
        <Stack.Screen name="sign-up" options={{ title: t('auth.signUp'), presentation: 'modal' }} />
        <Stack.Screen name="phone" options={{ title: t('auth.phoneTitle'), presentation: 'modal' }} />
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
      </Stack>
      </WebFrame>
    </NavThemeProvider>
  );
}

/** On wide browser windows, show the app as a centred phone-width column. */
function WebFrame({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceAlt, alignItems: 'center' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 520, backgroundColor: colors.background, overflow: 'hidden' }}>{children}</View>
    </View>
  );
}
