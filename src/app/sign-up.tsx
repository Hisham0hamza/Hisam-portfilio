import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button, Screen, Text, TextField } from '@/components/ui';
import { emailSchema, passwordSchema, signUpWithEmail } from '@/features/auth/api';
import { useTheme } from '@/theme/ThemeProvider';

const schema = z.object({ name: z.string().trim().min(2), email: emailSchema, password: passwordSchema });

export default function SignUpScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    const parsed = schema.safeParse({ name, email: email.trim(), password });
    if (!parsed.success) {
      const map: Record<string, string> = {};
      for (const i of parsed.error.issues) {
        const k = String(i.path[0]);
        map[k] = k === 'password' ? t('auth.passwordRule') : k === 'email' ? t('auth.invalidEmail') : t('form.errors.too_short');
      }
      setErrors(map);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const { needsConfirmation } = await signUpWithEmail(parsed.data.name, parsed.data.email, parsed.data.password);
      if (needsConfirmation) {
        Alert.alert(t('auth.checkEmailTitle'), t('auth.checkEmailBody'));
        router.replace('/sign-in');
      } else {
        if (router.canGoBack()) router.back();
        else router.replace('/');
      }
    } catch (e) {
      Alert.alert(t('auth.signUpFailed'), (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll edges={['bottom']}>
      <Text variant="display">{t('auth.createAccount')}</Text>
      <TextField label={t('profile.name')} value={name} onChangeText={setName} autoComplete="name" textContentType="name" error={errors.name} />
      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        error={errors.email}
      />
      <TextField
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        hint={t('auth.passwordRule')}
        error={errors.password}
      />
      <Button title={t('auth.signUp')} loading={busy} onPress={onSubmit} />
      <Link href="/sign-in" replace style={{ alignSelf: 'center', padding: spacing.sm }}>
        <Text color="primary">{t('auth.haveAccount')}</Text>
      </Link>
    </Screen>
  );
}
