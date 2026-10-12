// Design tokens. Colors meet WCAG AA (4.5:1) for text on their intended backgrounds.

export const palette = {
  teal900: '#0B3D3A',
  teal700: '#0F766E',
  teal500: '#14B8A6',
  teal300: '#5EEAD4',
  teal100: '#CCFBF1',
  sand50: '#FBF8F3',
  sand100: '#F4EDE2',
  sand200: '#E7DCCB',
  terracotta600: '#B4441A',
  terracotta400: '#F08A5D',
  gold500: '#D99A1E',
  ink900: '#14191F',
  ink700: '#2B333D',
  ink500: '#5B6673',
  ink300: '#9AA4AF',
  ink100: '#E3E7EB',
  white: '#FFFFFF',
  black: '#000000',
  red600: '#C2282B',
  red400: '#F87171',
  green600: '#15803D',
  green400: '#4ADE80',
  amber600: '#B45309',
  amber400: '#FBBF24',
} as const;

export type ColorTokens = {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textOnPrimary: string;
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  accent: string;
  danger: string;
  success: string;
  warning: string;
  verified: string;
  star: string;
  overlay: string;
  mapPin: string;
  mapPinText: string;
};

export const lightColors: ColorTokens = {
  background: palette.sand50,
  surface: palette.white,
  surfaceAlt: palette.sand100,
  border: palette.sand200,
  text: palette.ink900,
  textMuted: palette.ink500,
  textOnPrimary: palette.white,
  primary: palette.teal700,
  primaryPressed: palette.teal900,
  primarySoft: palette.teal100,
  accent: palette.terracotta600,
  danger: palette.red600,
  success: palette.green600,
  warning: palette.amber600,
  verified: palette.teal700,
  star: palette.gold500,
  overlay: 'rgba(20, 25, 31, 0.45)',
  mapPin: palette.teal700,
  mapPinText: palette.white,
};

export const darkColors: ColorTokens = {
  background: '#0E1215',
  surface: '#171D22',
  surfaceAlt: '#1F272E',
  border: '#2C363F',
  text: '#EEF2F5',
  textMuted: palette.ink300,
  textOnPrimary: palette.teal900,
  primary: palette.teal300,
  primaryPressed: palette.teal500,
  primarySoft: '#123B38',
  accent: palette.terracotta400,
  danger: palette.red400,
  success: palette.green400,
  warning: palette.amber400,
  verified: palette.teal300,
  star: palette.amber400,
  overlay: 'rgba(0, 0, 0, 0.6)',
  mapPin: palette.teal500,
  mapPinText: palette.teal900,
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '800' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 14, lineHeight: 19, fontWeight: '400' },
  small: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
} as const;

export type TypographyVariant = keyof typeof typography;

export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const;
/** Minimum touch target (accessibility). */
export const minTouch = 44;
