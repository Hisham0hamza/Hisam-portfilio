import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { formatDay, formatEventDate } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

import { Icon } from './Icon';
import { Text } from './Text';

type Props = {
  label: string;
  value: Date | null;
  onChange: (d: Date) => void;
  mode?: 'date' | 'datetime';
  minimumDate?: Date;
  error?: string | null;
};

/** Native date/time picker: inline compact picker on iOS, dialogs on Android. */
export function DateField({ label, value, onChange, mode = 'datetime', minimumDate, error }: Props) {
  const { colors, radius, spacing } = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'ar' ? 'ar' : 'en';

  const openAndroid = () => {
    const base = value ?? new Date();
    DateTimePickerAndroid.open({
      value: base,
      mode: 'date',
      minimumDate,
      onChange: (e, date) => {
        if (e.type !== 'set' || !date) return;
        if (mode === 'date') return onChange(date);
        DateTimePickerAndroid.open({
          value: date,
          mode: 'time',
          is24Hour: true,
          onChange: (e2, time) => {
            if (e2.type !== 'set' || !time) return;
            const d = new Date(date);
            d.setHours(time.getHours(), time.getMinutes(), 0, 0);
            onChange(d);
          },
        });
      },
    });
  };

  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="caption" style={{ fontWeight: '600' }}>
        {label}
      </Text>
      {Platform.OS === 'ios' ? (
        <View style={[styles.box, { borderColor: error ? colors.danger : colors.border, borderRadius: radius.md, backgroundColor: colors.surface }]}>
          <DateTimePicker
            value={value ?? minimumDate ?? new Date()}
            mode={mode}
            display="compact"
            minimumDate={minimumDate}
            locale={lang === 'ar' ? 'ar-EG' : 'en-GB'}
            onChange={(_, d) => d && onChange(d)}
            accessibilityLabel={label}
          />
        </View>
      ) : (
        <Pressable
          onPress={openAndroid}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value ? formatEventDate(value.toISOString(), lang) : t('common.select')}`}
          style={[styles.box, styles.row, { borderColor: error ? colors.danger : colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md }]}
        >
          <Icon name="calendar-outline" color="primary" />
          <Text style={{ flex: 1 }} color={value ? 'text' : 'textMuted'}>
            {value ? (mode === 'date' ? formatDay(value.toISOString(), lang) : formatEventDate(value.toISOString(), lang)) : t('common.select')}
          </Text>
        </Pressable>
      )}
      {error ? (
        <Text variant="small" color="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, minHeight: 48, justifyContent: 'center', alignItems: 'flex-start', paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
