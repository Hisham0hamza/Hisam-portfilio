import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { EmptyView } from '@/components/ui';

export default function NotFound() {
  const { t } = useTranslation();
  return <EmptyView icon="map-outline" title={t('common.notFound')} actionLabel={t('trips.explore')} onAction={() => router.replace('/')} />;
}
