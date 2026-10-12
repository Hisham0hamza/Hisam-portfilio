import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { minTouch } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  title: string;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  size?: 'md' | 'sm';
  fullWidth?: boolean;
  style?: ViewStyle;
};

export function Button({ title, variant = 'primary', icon, loading, disabled, size = 'md', fullWidth, style, ...rest }: Props) {
  const { colors, radius, spacing } = useTheme();
  const isDisabled = disabled || loading;

  const palette: Record<Variant, { bg: string; bgPressed: string; fg: 'textOnPrimary' | 'primary' | 'text' | 'danger'; border?: string }> = {
    primary: { bg: colors.primary, bgPressed: colors.primaryPressed, fg: 'textOnPrimary' },
    secondary: { bg: colors.primarySoft, bgPressed: colors.border, fg: 'primary' },
    ghost: { bg: 'transparent', bgPressed: colors.surfaceAlt, fg: 'text', border: colors.border },
    danger: { bg: 'transparent', bgPressed: colors.surfaceAlt, fg: 'danger', border: colors.danger },
  };
  const p = palette[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      accessibilityLabel={title}
      disabled={isDisabled}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: size === 'md' ? 50 : minTouch,
          paddingHorizontal: size === 'md' ? spacing.xl : spacing.lg,
          borderRadius: radius.md,
          backgroundColor: pressed ? p.bgPressed : p.bg,
          borderColor: p.border ?? 'transparent',
          borderWidth: p.border ? 1 : 0,
          opacity: isDisabled ? 0.55 : 1,
          alignSelf: fullWidth ? 'stretch' : 'auto',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors[p.fg]} />
      ) : (
        <View style={[styles.row, { gap: spacing.sm }]}>
          {icon ? <Icon name={icon} size={18} color={p.fg} /> : null}
          <Text variant={size === 'md' ? 'bodyStrong' : 'caption'} color={p.fg} style={{ fontWeight: '700' }}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  color = 'text',
  background,
  directional,
  size = 22,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: 'text' | 'primary' | 'danger' | 'textOnPrimary' | 'accent';
  background?: string;
  directional?: boolean;
  size?: number;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: pressed ? colors.surfaceAlt : (background ?? 'transparent') },
      ]}
    >
      <Icon name={icon} size={size} color={color} directional={directional} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconButton: {
    width: minTouch,
    height: minTouch,
    borderRadius: minTouch / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
