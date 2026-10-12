import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import type { ColorTokens, TypographyVariant } from '@/theme/tokens';

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  color?: keyof ColorTokens;
  align?: 'center' | 'auto';
};

export function Text({ variant = 'body', color = 'text', align, style, ...rest }: TextProps) {
  const { colors, typography } = useTheme();
  const t = typography[variant] as TextStyle;
  return (
    <RNText
      maxFontSizeMultiplier={1.8}
      {...rest}
      style={[t, { color: colors[color], textAlign: align ?? 'auto', writingDirection: 'auto' }, style]}
    />
  );
}
