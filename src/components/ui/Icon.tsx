import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { I18nManager } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import type { ColorTokens } from '@/theme/tokens';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  name: IconName;
  size?: number;
  color?: keyof ColorTokens;
  /** Mirror in RTL (arrows, chevrons). */
  directional?: boolean;
};

export function Icon({ name, size = 20, color = 'text', directional }: Props) {
  const { colors } = useTheme();
  return (
    <Ionicons
      name={name}
      size={size}
      color={colors[color]}
      style={directional && I18nManager.isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
