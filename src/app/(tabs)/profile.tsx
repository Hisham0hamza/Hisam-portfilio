import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { SignInPrompt } from '@/components/SignInPrompt';
import { Button, Card, ErrorView, LoadingView, Screen, Section, SegmentedControl, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useMyProfile } from '@/features/profiles/hooks';
import { resetDemo } from '@/features/demo/store';
import { changeLanguage } from '@/i18n';
import { env } from '@/lib/env';
import type { AppLanguage } from '@/lib/format';
import { useTheme, type ThemePreference } from '@/theme/ThemeProvider';
import { confirmAction } from '@/lib/dialogs';

export default function ProfileTab() {
  const { t, i18n } = useTranslation();
  const { user, signOut } = useAuth();
  const { spacing, preference, setPreference } = useTheme();
  const profile = useMyProfile();
  const queryClient = useQueryClient();

  const settings = (
    <Section title={t('settings.title')}>
      <Text variant="caption" style={{ fontWeight: '600' }}>
        {t('settings.language')}
      </Text>
      <SegmentedControl<AppLanguage>
        value={i18n.language === 'ar' ? 'ar' : 'en'}
        onChange={(lang) => {
          if (lang === i18n.language) return;
          confirmAction({
      title: t('settings.languageChangeTitle'),
      message: t('settings.languageChangeBody'),
      cancelLabel: t('common.cancel'),
      confirmLabel: t('common.ok'),
      onConfirm: () => changeLanguage(lang),
    });
        }}
        options={[
          { value: 'ar', label: 'العربية' },
          { value: 'en', label: 'English' },
        ]}
      />
      <Text variant="caption" style={{ fontWeight: '600' }}>
        {t('settings.theme')}
      </Text>
      <SegmentedControl<ThemePreference>
        value={preference}
        onChange={setPreference}
        options={[
          { value: 'system', label: t('settings.system') },
          { value: 'light', label: t('settings.light') },
          { value: 'dark', label: t('settings.dark') },
        ]}
      />
      {env.isDemo ? (
        <Button
          title={t('settings.resetDemo')}
          variant="ghost"
          icon="refresh"
          onPress={() =>
            confirmAction({
              title: t('settings.resetDemo'),
              message: t('settings.resetDemoBody'),
              cancelLabel: t('common.cancel'),
              confirmLabel: t('common.ok'),
              destructive: true,
              onConfirm: async () => {
                await resetDemo();
                queryClient.invalidateQueries();
              },
            })
          }
        />
      ) : null}
    </Section>
  );

  if (!user) {
    return (
      <Screen scroll edges={[]}>
        <View style={{ minHeight: 320 }}>
          <SignInPrompt message={t('profile.signInMessage')} />
        </View>
        {settings}
      </Screen>
    );
  }

  if (profile.isLoading) return <LoadingView />;
  if (profile.error || !profile.data) return <ErrorView error={profile.error} onRetry={() => profile.refetch()} />;

  return (
    <Screen scroll edges={[]}>
      <ProfileHeader profile={profile.data} />
      <View style={{ gap: spacing.sm }}>
        <Button title={t('profile.edit')} icon="create-outline" variant="secondary" onPress={() => router.push('/edit-profile')} />
        <Button title={t('profile.viewPublic')} icon="eye-outline" variant="ghost" onPress={() => router.push(`/user/${user.id}`)} />
      </View>
      {!profile.data.host_verified ? (
        <Card>
          <Text variant="bodyStrong">{t('profile.becomeHostTitle')}</Text>
          <Text color="textMuted" style={{ marginTop: spacing.xs }}>
            {profile.data.is_host ? t('profile.verificationPending') : t('profile.becomeHostBody')}
          </Text>
          {!profile.data.is_host ? (
            <View style={{ marginTop: spacing.md }}>
              <Button title={t('host.createEvent')} icon="add-circle-outline" onPress={() => router.push('/event/new')} />
            </View>
          ) : null}
        </Card>
      ) : null}
      {settings}
      <Button title={t('auth.signOut')} variant="danger" icon="log-out-outline" onPress={() => signOut()} />
    </Screen>
  );
}
