import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Shows an × and announces the chip as removable. */
  onRemove?: () => void;
  icon?: IconName;
  removeLabel?: string;
};

export function Chip({ label, selected, onPress, onRemove, icon, removeLabel }: Props) {
  const { colors, radius, spacing } = useTheme();
  const handlePress = onRemove ?? onPress;
  return (
    <Pressable
      onPress={handlePress}
      disabled={!handlePress}
      accessibilityRole={onRemove ? 'button' : 'checkbox'}
      accessibilityState={onRemove ? undefined : { checked: !!selected }}
      accessibilityLabel={onRemove ? `${removeLabel ?? ''} ${label}`.trim() : label}
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        {
          borderRadius: radius.pill,
          paddingHorizontal: spacing.md,
          gap: spacing.xs,
          backgroundColor: selected || onRemove ? colors.primarySoft : pressed ? colors.surfaceAlt : colors.surface,
          borderColor: selected || onRemove ? colors.primary : colors.border,
        },
      ]}
    >
      {icon ? <Icon name={icon} size={16} color={selected || onRemove ? 'primary' : 'textMuted'} /> : null}
      <Text variant="caption" color={selected || onRemove ? 'primary' : 'text'} style={{ fontWeight: '600' }}>
        {label}
      </Text>
      {onRemove ? <Icon name="close" size={16} color="primary" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
});
