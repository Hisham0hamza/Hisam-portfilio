import type { ReactNode } from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

const tiles = {
  light: require('@/assets/images/pattern-light.png'),
  dark: require('@/assets/images/pattern-dark.png'),
};

/** Screen backdrop: app background colour with a subtle repeating Pharaonic pattern. */
export function PatternBackground({ children }: { children: ReactNode }) {
  const { colors, scheme } = useTheme();
  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <ImageBackground source={tiles[scheme]} resizeMode="repeat" style={StyleSheet.absoluteFill} accessible={false} />
      <View style={styles.flex}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
