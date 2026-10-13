import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { PATTERN_SIZE, patternDataUri } from '@/theme/pattern';
import { useTheme } from '@/theme/ThemeProvider';

/** Screen backdrop: app background colour with a subtle repeating Pharaonic pattern (SVG). */
export function PatternBackground({ children }: { children: ReactNode }) {
  const { colors, scheme } = useTheme();
  const image = useMemo(() => patternDataUri(scheme), [scheme]);
  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <div
        aria-hidden
        style={{ position: 'absolute', inset: 0, backgroundImage: image, backgroundSize: `${PATTERN_SIZE}px`, pointerEvents: 'none' }}
      />
      <View style={styles.flex}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
