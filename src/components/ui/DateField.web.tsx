import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

type Props = {
  label: string;
  value: Date | null;
  onChange: (d: Date) => void;
  mode?: 'date' | 'datetime';
  minimumDate?: Date;
  error?: string | null;
};

const pad = (n: number) => String(n).padStart(2, '0');
const toInput = (d: Date, mode: 'date' | 'datetime') => {
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return mode === 'date' ? day : `${day}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Web date/time field using the browser's native picker. */
export function DateField({ label, value, onChange, mode = 'datetime', minimumDate, error }: Props) {
  const { colors, radius, spacing, typography } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="caption" style={{ fontWeight: '600' }}>
        {label}
      </Text>
      <input
        type={mode === 'date' ? 'date' : 'datetime-local'}
        aria-label={label}
        value={value ? toInput(value, mode) : ''}
        min={minimumDate ? toInput(minimumDate, mode) : undefined}
        onChange={(e) => {
          const v = e.currentTarget.value;
          if (!v) return;
          const d = mode === 'date' ? new Date(`${v}T00:00:00`) : new Date(v);
          if (!Number.isNaN(d.getTime())) onChange(d);
        }}
        style={{
          ...typography.body,
          fontFamily: 'inherit',
          minHeight: 48,
          padding: `0 ${spacing.md}px`,
          borderRadius: radius.md,
          border: `1px solid ${error ? colors.danger : colors.border}`,
          background: colors.surface,
          color: colors.text,
          colorScheme: 'light dark',
          boxSizing: 'border-box',
          width: '100%',
        }}
      />
      {error ? (
        <Text variant="small" color="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
