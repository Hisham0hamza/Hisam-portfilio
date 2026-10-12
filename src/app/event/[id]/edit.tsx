import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { EmptyView, QueryState } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { EventForm } from '@/features/events/EventForm';
import { useEvent } from '@/features/events/hooks';

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { t } = useTranslation();
  const query = useEvent(id);
  return (
    <QueryState query={query}>
      {(event) =>
        event && event.host_id === user?.id ? <EventForm event={event} /> : <EmptyView icon="lock-closed-outline" title={t('host.notYourEvent')} />
      }
    </QueryState>
  );
}
