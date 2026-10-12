import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export function Card({ children, style, padded = true }: { children: ReactNode; style?: ViewStyle; padded?: boolean }) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          padding: padded ? spacing.lg : 0,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.sectionHeader}>
        <Text variant="heading" accessibilityRole="header" style={{ flex: 1 }}>
          {title}
        </Text>
        {action}
      </View>
      {children}
    </View>
  );
}

export function Row({ children, gap = 8, style, wrap }: { children: ReactNode; gap?: number; style?: ViewStyle; wrap?: boolean }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;
}

export function InfoRow({ icon, label, value, onPress }: { icon: IconName; label: string; value?: string | null; onPress?: () => void }) {
  const { spacing } = useTheme();
  const content = (
    <View style={[styles.infoRow, { gap: spacing.md }]}>
      <Icon name={icon} size={20} color="primary" />
      <View style={{ flex: 1 }}>
        <Text variant="small" color="textMuted">
          {label}
        </Text>
        {value ? <Text variant="body">{value}</Text> : null}
      </View>
      {onPress ? <Icon name="chevron-forward" size={18} color="textMuted" directional /> : null}
    </View>
  );
  if (!onPress) return <View accessible>{content}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {content}
    </Pressable>
  );
}

export function ToggleRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text>{label}</Text>
        {hint ? (
          <Text variant="small" color="textMuted">
            {hint}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />;
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'center' },
  infoRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: 12 },
});
