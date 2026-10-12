import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon, Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

import { activeFilterChips } from './filters';
import { useSearch } from './SearchContext';

/** Search input (debounced) + filter button with an active-filter count. */
export function SearchBar({ onOpenFilters }: { onOpenFilters: () => void }) {
  const { colors, radius, spacing, typography } = useTheme();
  const { t } = useTranslation();
  const { filters, setFilters } = useSearch();
  const [text, setText] = useState(filters.query);
  const count = activeFilterChips(filters).length;

  useEffect(() => {
    const id = setTimeout(() => {
      setFilters((f) => (f.query === text ? f : { ...f, query: text }));
    }, 300);
    return () => clearTimeout(id);
  }, [text, setFilters]);

  // Follow external changes to the query (e.g. cleared elsewhere).
  const [lastQuery, setLastQuery] = useState(filters.query);
  if (filters.query !== lastQuery) {
    setLastQuery(filters.query);
    setText(filters.query);
  }

  return (
    <View style={[styles.row, { gap: spacing.sm }]}>
      <View style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md }]}>
        <Icon name="search" color="textMuted" />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('search.placeholder')}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={t('search.placeholder')}
          returnKeyType="search"
          autoCorrect={false}
          maxFontSizeMultiplier={1.6}
          style={[typography.body, { flex: 1, color: colors.text, minHeight: 46, textAlign: 'auto' as never }]}
        />
        {text ? (
          <Pressable onPress={() => setText('')} accessibilityRole="button" accessibilityLabel={t('search.clear')} hitSlop={8}>
            <Icon name="close-circle" color="textMuted" />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        onPress={onOpenFilters}
        accessibilityRole="button"
        accessibilityLabel={count ? t('search.filtersCount', { count }) : t('search.filters')}
        style={({ pressed }) => [
          styles.filterBtn,
          { backgroundColor: count ? colors.primary : pressed ? colors.surfaceAlt : colors.surface, borderColor: count ? colors.primary : colors.border },
        ]}
      >
        <Icon name="options-outline" color={count ? 'textOnPrimary' : 'text'} />
        {count ? (
          <View style={[styles.count, { backgroundColor: colors.accent, borderColor: colors.surface }]}>
            <Text variant="small" style={{ color: '#fff', fontWeight: '800' }} maxFontSizeMultiplier={1.2}>
              {count}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1 },
  filterBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  count: { position: 'absolute', top: -4, end: -4, minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, paddingHorizontal: 3 },
});
