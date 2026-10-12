import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { EmptyView, type IconName } from '@/components/ui';

export function SignInPrompt({ icon = 'person-circle-outline', message }: { icon?: IconName; message: string }) {
  const { t } = useTranslation();
  return <EmptyView icon={icon} title={t('auth.signInToContinue')} message={message} actionLabel={t('auth.signIn')} onAction={() => router.push('/sign-in')} />;
}
