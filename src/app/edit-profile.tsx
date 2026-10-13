import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Avatar, Button, Chip, Icon, LoadingView, Row, Screen, Text, TextField } from '@/components/ui';
import { useCities } from '@/features/events/hooks';
import { EVENT_LANGUAGES } from '@/features/events/schemas';
import { useLabels } from '@/features/events/useLabels';
import { INTERESTS, profileFormSchema, type Profile, type ProfileFormValues } from '@/features/profiles/api';
import { useMyProfile, useUpdateProfile } from '@/features/profiles/hooks';
import { toggleIn } from '@/features/search/filters';
import { errorKey } from '@/lib/errors';
import { pickImages } from '@/lib/images';
import { useTheme } from '@/theme/ThemeProvider';
import { showAlert } from '@/lib/dialogs';

export default function EditProfileScreen() {
  const profile = useMyProfile();
  if (!profile.data) return <LoadingView />;
  return <EditProfileForm profile={profile.data} />;
}

function EditProfileForm({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const l = useLabels();
  const { data: cities } = useCities();
  const update = useUpdateProfile();
  const [values, setValues] = useState<ProfileFormValues>({
    name: profile.name,
    bio: profile.bio ?? '',
    city: profile.city,
    languages: profile.languages,
    interests: profile.interests,
  });
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof ProfileFormValues>(k: K, v: ProfileFormValues[K]) => setValues({ ...values, [k]: v });

  const save = () => {
    const parsed = profileFormSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    update.mutate(
      { values: parsed.data, avatarUri },
      { onSuccess: () => router.back(), onError: (e) => showAlert(t('common.somethingWrong'), t(errorKey(e))) },
    );
  };

  const err = (k: string) => (errors[k] ? t(`form.errors.${errors[k]}` as 'form.errors.required') : null);

  return (
    <Screen scroll edges={['bottom']} footer={<Button title={t('common.save')} loading={update.isPending} onPress={save} />}>
      <Pressable
        style={{ alignItems: 'center', gap: spacing.sm }}
        accessibilityRole="button"
        accessibilityLabel={t('profile.changePhoto')}
        onPress={async () => {
          const [img] = await pickImages();
          if (img) setAvatarUri(img.uri);
        }}
      >
        <Avatar uri={avatarUri ?? profile.avatar_url} name={values.name || '?'} size={96} />
        <Row gap={4}>
          <Icon name="camera-outline" color="primary" size={16} />
          <Text color="primary">{t('profile.changePhoto')}</Text>
        </Row>
      </Pressable>
      <TextField label={t('profile.name')} value={values.name} onChangeText={(v) => set('name', v)} error={err('name')} maxLength={80} />
      <TextField label={t('profile.bio')} value={values.bio} onChangeText={(v) => set('bio', v)} multiline error={err('bio')} maxLength={1000} />
      <View style={{ gap: spacing.sm }}>
        <Text variant="caption" style={{ fontWeight: '600' }}>
          {t('filters.city')}
        </Text>
        <Row wrap gap={spacing.sm}>
          {(cities ?? []).map((c) => (
            <Chip key={c.slug} label={l.cityName(c.slug)} selected={values.city === c.slug} onPress={() => set('city', values.city === c.slug ? null : c.slug)} />
          ))}
        </Row>
      </View>
      <View style={{ gap: spacing.sm }}>
        <Text variant="caption" style={{ fontWeight: '600' }}>
          {t('profile.languages')}
        </Text>
        <Row wrap gap={spacing.sm}>
          {EVENT_LANGUAGES.map((code) => (
            <Chip key={code} label={l.language(code)} selected={values.languages.includes(code)} onPress={() => set('languages', toggleIn(values.languages, code))} />
          ))}
        </Row>
      </View>
      <View style={{ gap: spacing.sm }}>
        <Text variant="caption" style={{ fontWeight: '600' }}>
          {t('profile.interests')}
        </Text>
        <Row wrap gap={spacing.sm}>
          {INTERESTS.map((i) => (
            <Chip key={i} label={t(`interests.${i}`)} selected={values.interests.includes(i)} onPress={() => set('interests', toggleIn(values.interests, i))} />
          ))}
        </Row>
      </View>
    </Screen>
  );
}
