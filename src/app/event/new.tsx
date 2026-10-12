import { Redirect } from 'expo-router';

import { LoadingView } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { EventForm } from '@/features/events/EventForm';

export default function NewEventScreen() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingView />;
  if (!user) return <Redirect href="/sign-in" />;
  return <EventForm />;
}
