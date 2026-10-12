import { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

type Props = TextInputProps & {
  label: string;
  error?: string | null;
  hint?: string;
};

export const TextField = forwardRef<TextInput, Props>(function TextField({ label, error, hint, multiline, style, ...rest }, ref) {
  const { colors, radius, spacing, typography } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="caption" style={{ fontWeight: '600' }}>
        {label}
      </Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        maxFontSizeMultiplier={1.8}
        {...rest}
        style={[
          styles.input,
          typography.body,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.border,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            minHeight: multiline ? 110 : 48,
            textAlignVertical: multiline ? 'top' : 'center',
            paddingTop: multiline ? spacing.md : undefined,
            textAlign: 'auto' as never,
            writingDirection: 'auto',
          },
          style,
        ]}
      />
      {error ? (
        <Text variant="small" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="small" color="textMuted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  input: { borderWidth: 1 },
});
