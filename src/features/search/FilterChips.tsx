import { ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Chip } from '@/components/ui';
import { useLabels } from '@/features/events/useLabels';
import { useTheme } from '@/theme/ThemeProvider';

import { activeFilterChips, clearFilters, removeChip, type FilterChip } from './filters';
import { useSearch } from './SearchContext';

export function useChipLabel() {
  const { t } = useTranslation();
  const l = useLabels();
  return (chip: FilterChip): string => {
    switch (chip.kind) {
      case 'category':
        return l.category(chip.value);
      case 'city':
        return l.cityName(chip.value);
      case 'difficulty':
        return l.difficulty(chip.value);
      case 'language':
        return l.language(chip.value);
      case 'date':
        return chip.value === 'custom' ? `${chip.from ?? '…'} → ${chip.to ?? '…'}` : t(`filters.date.${chip.value}`);
      case 'price':
        if (chip.value === 'paid' && (chip.min != null || chip.max != null)) {
          return t('filters.priceRange', { min: chip.min ?? 0, max: chip.max ?? '∞' });
        }
        return t(`filters.price.${chip.value}`);
      case 'duration':
        return t(`filters.duration.${chip.value}`);
      case 'distance':
        return t('filters.withinKm', { km: chip.value });
      case 'womenOnly':
        return t('events.womenOnly');
      case 'familyFriendly':
        return t('events.familyFriendly');
      case 'seatsAvailable':
        return t('filters.seatsAvailable');
    }
  };
}

/** Horizontal row of active filters; tap to remove, "Clear all" resets. */
export function FilterChips() {
  const { filters, setFilters } = useSearch();
  const { spacing } = useTheme();
  const { t } = useTranslation();
  const label = useChipLabel();
  const chips = activeFilterChips(filters);
  if (!chips.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xs }}>
      {chips.map((chip) => (
        <Chip key={chip.id} label={label(chip)} onRemove={() => setFilters((f) => removeChip(f, chip))} removeLabel={t('filters.remove')} />
      ))}
      <Chip label={t('filters.clearAll')} icon="trash-outline" onPress={() => setFilters(clearFilters)} />
    </ScrollView>
  );
}
