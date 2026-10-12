import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.row, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.xxs }]}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[
              styles.item,
              { borderRadius: radius.md - 2, backgroundColor: selected ? colors.surface : 'transparent' },
            ]}
          >
            <Text variant="caption" color={selected ? 'primary' : 'textMuted'} style={{ fontWeight: '700' }} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  item: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
});
