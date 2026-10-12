import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Screen, Text, TextField } from '@/components/ui';
import { normalizePhone, phoneSchema, sendPhoneOtp, verifyPhoneOtp } from '@/features/auth/api';

export default function PhoneSignInScreen() {
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const normalized = normalizePhone(phone);
    if (!phoneSchema.safeParse(normalized).success) {
      setError(t('auth.invalidPhone'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendPhoneOtp(normalized);
      setSentTo(normalized);
    } catch (e) {
      setError((e as Error).message || t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!sentTo || code.trim().length < 4) return;
    setBusy(true);
    setError(null);
    try {
      await verifyPhoneOtp(sentTo, code.trim());
      router.dismissAll();
    } catch {
      setError(t('auth.invalidCode'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll edges={['bottom']}>
      {!sentTo ? (
        <>
          <Text color="textMuted">{t('auth.phoneExplain')}</Text>
          <TextField
            label={t('auth.phone')}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            placeholder="010 0000 0000"
            error={error}
          />
          <Button title={t('auth.sendCode')} loading={busy} onPress={send} />
        </>
      ) : (
        <>
          <Text color="textMuted">{t('auth.codeSent', { phone: sentTo })}</Text>
          <TextField
            label={t('auth.code')}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            maxLength={6}
            error={error}
            onSubmitEditing={verify}
          />
          <Button title={t('auth.verify')} loading={busy} onPress={verify} />
          <Button title={t('auth.changeNumber')} variant="ghost" onPress={() => setSentTo(null)} />
        </>
      )}
    </Screen>
  );
}
