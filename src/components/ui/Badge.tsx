import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/theme/ThemeProvider';
import type { ColorTokens } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export function Badge({
  label,
  tone = 'primary',
  icon,
}: {
  label: string;
  tone?: 'primary' | 'accent' | 'danger' | 'success' | 'warning' | 'textMuted';
  icon?: IconName;
}) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      style={[
        styles.badge,
        { borderRadius: radius.pill, paddingHorizontal: spacing.sm, borderColor: colors[tone as keyof ColorTokens], gap: 4 },
      ]}
    >
      {icon ? <Icon name={icon} size={12} color={tone} /> : null}
      <Text variant="small" color={tone}>
        {label}
      </Text>
    </View>
  );
}

export function VerifiedBadge({ compact }: { compact?: boolean }) {
  const { t } = useTranslation();
  if (compact) {
    return (
      <View accessible accessibilityLabel={t('profile.verifiedHost')}>
        <Icon name="checkmark-circle" size={16} color="verified" />
      </View>
    );
  }
  return <Badge label={t('profile.verifiedHost')} icon="checkmark-circle" tone="primary" />;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
});
