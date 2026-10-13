import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  padded?: boolean;
  contentStyle?: ViewStyle;
  footer?: ReactNode;
};

/** Page container: safe areas, themed background, optional scrolling and a sticky footer. */
export function Screen({ children, scroll, edges = ['top'], padded = true, contentStyle, footer }: Props) {
  const { colors, spacing } = useTheme();
  const padding = padded ? { padding: spacing.lg } : null;
  return (
    <SafeAreaView edges={edges} style={styles.flex}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[padding, { gap: spacing.lg, paddingBottom: spacing.xxxl }, contentStyle]}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, padding, contentStyle]}>{children}</View>
        )}
        {footer ? (
          <View style={[styles.footer, { borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.lg }]}>
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth },
});
