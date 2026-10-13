import { Link, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Card, Divider, Row, Screen, Text, TextField } from '@/components/ui';
import { DEMO_PASSWORD } from '@/features/demo/store';
import { emailSchema, signInWithEmail, signInWithGoogle } from '@/features/auth/api';
import { env } from '@/lib/env';
import { useTheme } from '@/theme/ThemeProvider';

const DEMO_ACCOUNTS = [
  { email: 'nour@masar.demo', name: 'Nour El-Din Hassan', role: 'host' },
  { email: 'salma@masar.demo', name: 'Salma Adel', role: 'host' },
  { email: 'ahmed@masar.demo', name: 'Ahmed Samir', role: 'walker' },
  { email: 'laila@masar.demo', name: 'Laila Hamdy', role: 'walker' },
] as const;

export default function SignInScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'email' | 'google' | null>(null);

  const done = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const onEmail = async () => {
    if (!emailSchema.safeParse(email.trim()).success || !password) {
      setError(t('auth.invalidCredentialsInput'));
      return;
    }
    setBusy('email');
    setError(null);
    try {
      await signInWithEmail(email, password);
      done();
    } catch {
      setError(t('auth.invalidCredentials'));
    } finally {
      setBusy(null);
    }
  };

  const quickSignIn = async (demoEmail: string) => {
    setBusy('email');
    setError(null);
    try {
      await signInWithEmail(demoEmail, DEMO_PASSWORD);
      done();
    } catch {
      setError(t('auth.invalidCredentials'));
    } finally {
      setBusy(null);
    }
  };

  const onGoogle = async () => {
    setBusy('google');
    setError(null);
    try {
      if (await signInWithGoogle()) done();
    } catch {
      setError(t('auth.googleFailed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen scroll edges={['bottom']}>
      <View style={{ gap: spacing.xs }}>
        <Text variant="display">{t('auth.welcome')}</Text>
        <Text color="textMuted">{t('auth.tagline')}</Text>
      </View>
      {env.isDemo ? (
        <Card>
          <View style={{ gap: spacing.md }}>
            <Text variant="bodyStrong">{t('auth.demoTitle')}</Text>
            <Text variant="caption" color="textMuted">
              {t('auth.demoBody', { password: DEMO_PASSWORD })}
            </Text>
            {DEMO_ACCOUNTS.map((a) => (
              <Button
                key={a.email}
                variant="secondary"
                size="sm"
                title={`${a.name} · ${a.role === 'host' ? t('auth.demoHost') : t('auth.demoWalker')}`}
                disabled={busy !== null}
                onPress={() => quickSignIn(a.email)}
              />
            ))}
          </View>
        </Card>
      ) : (
        <>
          <Button title={t('auth.continueWithGoogle')} icon="logo-google" variant="ghost" loading={busy === 'google'} onPress={onGoogle} />
          <Button title={t('auth.continueWithPhone')} icon="phone-portrait-outline" variant="ghost" onPress={() => router.push('/phone')} />
        </>
      )}
      <Row gap={spacing.md}>
        <View style={{ flex: 1 }}>
          <Divider />
        </View>
        <Text variant="small" color="textMuted">
          {t('auth.or')}
        </Text>
        <View style={{ flex: 1 }}>
          <Divider />
        </View>
      </Row>
      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={onEmail}
      />
      {error ? (
        <Text color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <Button title={t('auth.signIn')} loading={busy === 'email'} onPress={onEmail} />
      <Link href="/sign-up" replace style={{ alignSelf: 'center', padding: spacing.sm }}>
        <Text color="primary">{t('auth.noAccount')}</Text>
      </Link>
    </Screen>
  );
}
