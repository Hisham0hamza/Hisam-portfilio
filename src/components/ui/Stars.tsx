import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon } from './Icon';
import { Text } from './Text';

export function Rating({ value, count, size = 14 }: { value: number | null; count?: number; size?: number }) {
  const { t } = useTranslation();
  if (value == null) {
    return (
      <Text variant="small" color="textMuted">
        {t('reviews.new')}
      </Text>
    );
  }
  return (
    <View style={styles.row} accessible accessibilityLabel={t('reviews.ratingA11y', { rating: value.toFixed(1) })}>
      <Icon name="star" size={size} color="star" />
      <Text variant="small" style={{ fontWeight: '700' }}>
        {value.toFixed(1)}
      </Text>
      {count != null ? (
        <Text variant="small" color="textMuted">
          ({count})
        </Text>
      ) : null}
    </View>
  );
}

export function StarsDisplay({ value, size = 14 }: { value: number; size?: number }) {
  const { t } = useTranslation();
  return (
    <View style={styles.row} accessible accessibilityLabel={t('reviews.ratingA11y', { rating: value })}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name={i <= value ? 'star' : 'star-outline'} size={size} color="star" />
      ))}
    </View>
  );
}

export function StarsInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.row, { gap: 8 }]} accessibilityRole="adjustable" accessibilityValue={{ min: 0, max: 5, now: value }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable
          key={i}
          onPress={() => onChange(i)}
          accessibilityRole="button"
          accessibilityLabel={t('reviews.rateN', { n: i })}
          accessibilityState={{ selected: i <= value }}
          hitSlop={6}
        >
          <Icon name={i <= value ? 'star' : 'star-outline'} size={36} color="star" />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
