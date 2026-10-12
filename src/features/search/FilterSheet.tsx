import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Chip, DateField, Row, Section, SegmentedControl, Sheet, Text, TextField, ToggleRow } from '@/components/ui';
import { useCities } from '@/features/events/hooks';
import { CATEGORIES, DIFFICULTIES, EVENT_LANGUAGES } from '@/features/events/schemas';
import { CATEGORY_ICONS, useLabels } from '@/features/events/useLabels';
import { useTheme } from '@/theme/ThemeProvider';

import {
  DATE_PRESETS,
  DISTANCE_OPTIONS_KM,
  DURATION_PRESETS,
  PRICE_FILTERS,
  SORT_OPTIONS,
  clearFilters,
  toYmd,
  toggleIn,
  type SearchFilters,
} from './filters';
import { useSearch } from './SearchContext';

function parseNumber(v: string) {
  const n = Number(v.replace(/[^\d.]/g, ''));
  return v.trim() === '' || Number.isNaN(n) ? null : n;
}

/** Filters shared by map & list. Edits a draft; "Show results" applies it. */
export function FilterSheet({ visible, onClose, hasLocation }: { visible: boolean; onClose: () => void; hasLocation: boolean }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const l = useLabels();
  const { data: cities } = useCities();
  const { filters, setFilters } = useSearch();
  const [draft, setDraft] = useState<SearchFilters>(filters);

  // Start from the applied filters every time the sheet opens.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setDraft(filters);
  }

  const set = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const apply = () => {
    setFilters(draft);
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('search.filters')}
      headerAction={<Button title={t('filters.clearAll')} variant="ghost" size="sm" onPress={() => setDraft(clearFilters(draft))} />}
      footer={<Button title={t('filters.showResults')} onPress={apply} fullWidth />}
    >
      <Section title={t('sort.title')}>
        <SegmentedControl
          value={draft.sort}
          onChange={(v) => set('sort', v)}
          options={SORT_OPTIONS.map((s) => ({ value: s, label: t(`sort.${s}`) }))}
        />
        {draft.sort === 'nearest' && !hasLocation ? (
          <Text variant="small" color="textMuted">
            {t('filters.needsLocation')}
          </Text>
        ) : null}
      </Section>

      <Section title={t('filters.category')}>
        <Row wrap gap={spacing.sm}>
          {CATEGORIES.map((c) => (
            <Chip key={c} label={l.category(c)} icon={CATEGORY_ICONS[c]} selected={draft.categories.includes(c)} onPress={() => set('categories', toggleIn(draft.categories, c))} />
          ))}
        </Row>
      </Section>

      <Section title={t('filters.city')}>
        <Row wrap gap={spacing.sm}>
          {(cities ?? []).map((c) => (
            <Chip key={c.slug} label={l.cityName(c.slug)} selected={draft.cities.includes(c.slug)} onPress={() => set('cities', toggleIn(draft.cities, c.slug))} />
          ))}
        </Row>
      </Section>

      <Section title={t('filters.dateTitle')}>
        <Row wrap gap={spacing.sm}>
          {DATE_PRESETS.map((p) => (
            <Chip key={p} label={t(`filters.date.${p}`)} selected={draft.datePreset === p} onPress={() => set('datePreset', p)} />
          ))}
        </Row>
        {draft.datePreset === 'custom' ? (
          <View style={{ gap: spacing.md }}>
            <DateField
              label={t('filters.from')}
              mode="date"
              minimumDate={new Date()}
              value={draft.dateFrom ? new Date(`${draft.dateFrom}T00:00:00`) : null}
              onChange={(d) => set('dateFrom', toYmd(d))}
            />
            <DateField
              label={t('filters.to')}
              mode="date"
              minimumDate={draft.dateFrom ? new Date(`${draft.dateFrom}T00:00:00`) : new Date()}
              value={draft.dateTo ? new Date(`${draft.dateTo}T00:00:00`) : null}
              onChange={(d) => set('dateTo', toYmd(d))}
            />
          </View>
        ) : null}
      </Section>

      <Section title={t('filters.priceTitle')}>
        <SegmentedControl value={draft.price} onChange={(v) => set('price', v)} options={PRICE_FILTERS.map((p) => ({ value: p, label: t(`filters.price.${p}`) }))} />
        {draft.price === 'paid' ? (
          <Row gap={spacing.md}>
            <View style={{ flex: 1 }}>
              <TextField
                label={t('filters.minPrice')}
                keyboardType="number-pad"
                value={draft.priceMin != null ? String(draft.priceMin) : ''}
                onChangeText={(v) => set('priceMin', parseNumber(v))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                label={t('filters.maxPrice')}
                keyboardType="number-pad"
                value={draft.priceMax != null ? String(draft.priceMax) : ''}
                onChangeText={(v) => set('priceMax', parseNumber(v))}
              />
            </View>
          </Row>
        ) : null}
      </Section>

      <Section title={t('filters.difficulty')}>
        <Row wrap gap={spacing.sm}>
          {DIFFICULTIES.map((d) => (
            <Chip key={d} label={l.difficulty(d)} selected={draft.difficulties.includes(d)} onPress={() => set('difficulties', toggleIn(draft.difficulties, d))} />
          ))}
        </Row>
      </Section>

      <Section title={t('filters.durationTitle')}>
        <Row wrap gap={spacing.sm}>
          {DURATION_PRESETS.map((d) => (
            <Chip key={d} label={t(`filters.duration.${d}`)} selected={draft.duration === d} onPress={() => set('duration', d)} />
          ))}
        </Row>
      </Section>

      <Section title={t('filters.distance')}>
        {hasLocation ? (
          <Row wrap gap={spacing.sm}>
            <Chip label={t('filters.anyDistance')} selected={draft.maxDistanceKm == null} onPress={() => set('maxDistanceKm', null)} />
            {DISTANCE_OPTIONS_KM.map((km) => (
              <Chip key={km} label={t('filters.withinKm', { km })} selected={draft.maxDistanceKm === km} onPress={() => set('maxDistanceKm', km)} />
            ))}
          </Row>
        ) : (
          <Text variant="caption" color="textMuted">
            {t('filters.needsLocation')}
          </Text>
        )}
      </Section>

      <Section title={t('filters.language')}>
        <Row wrap gap={spacing.sm}>
          {EVENT_LANGUAGES.map((code) => (
            <Chip key={code} label={l.language(code)} selected={draft.languages.includes(code)} onPress={() => set('languages', toggleIn(draft.languages, code))} />
          ))}
        </Row>
      </Section>

      <View style={{ gap: spacing.xs }}>
        <ToggleRow label={t('events.womenOnly')} value={draft.womenOnly} onChange={(v) => set('womenOnly', v)} />
        <ToggleRow label={t('events.familyFriendly')} value={draft.familyFriendly} onChange={(v) => set('familyFriendly', v)} />
        <ToggleRow label={t('filters.seatsAvailable')} value={draft.seatsAvailable} onChange={(v) => set('seatsAvailable', v)} />
      </View>
    </Sheet>
  );
}
