import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/theme/ThemeProvider';

import { IconButton } from './Button';
import { Text } from './Text';

/** Bottom sheet built on Modal (works in Expo Go without extra native modules). */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
  headerAction,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  headerAction?: ReactNode;
}) {
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} onPress={onClose} accessibilityLabel={t('common.close')} />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingBottom: insets.bottom,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={[styles.header, { paddingHorizontal: spacing.lg }]}>
            <IconButton icon="close" label={t('common.close')} onPress={onClose} />
            <Text variant="heading" style={styles.title} accessibilityRole="header" align="center">
              {title}
            </Text>
            <View style={styles.headerAction}>{headerAction}</View>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? (
            <View style={{ padding: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>{footer}</View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '92%', width: '100%', maxWidth: 520, alignSelf: 'center' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 52 },
  title: { flex: 1 },
  headerAction: { minWidth: 44, alignItems: 'flex-end' },
});
