import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Icon, type IconName } from '@/components/ui';
import { usePendingCounts } from '@/features/applications/hooks';
import { useHostedEvents } from '@/features/events/hooks';
import { useTheme } from '@/theme/ThemeProvider';

function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  return <Icon name={name} size={24} color={focused ? 'primary' : 'textMuted'} />;
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const hosted = useHostedEvents();
  const upcomingIds = (hosted.data ?? []).filter((e) => e.status === 'published').map((e) => e.id);
  const pending = usePendingCounts(upcomingIds);
  const pendingTotal = Object.values(pending.data ?? {}).reduce((a, b) => a + b, 0);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.text },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.explore'),
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'compass' : 'compass-outline'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: t('tabs.trips'),
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'footsteps' : 'footsteps-outline'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="host"
        options={{
          title: t('tabs.host'),
          tabBarBadge: pendingTotal > 0 ? pendingTotal : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.accent },
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'flag' : 'flag-outline'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'person-circle' : 'person-circle-outline'} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
