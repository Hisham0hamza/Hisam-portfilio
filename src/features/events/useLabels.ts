import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { ApplicationStatus, Category, Difficulty } from '@/features/events/schemas';
import { durationParts, formatDateRange, formatEventDate, formatNumber, type AppLanguage } from '@/lib/format';

import { useCities } from './hooks';

/** Localised labels for enums, cities, prices and durations. */
export function useLabels() {
  const { t, i18n } = useTranslation();
  const lang: AppLanguage = i18n.language === 'ar' ? 'ar' : 'en';
  const { data: cities } = useCities();

  const cityName = useCallback(
    (slug: string | null | undefined) => {
      if (!slug) return '';
      const c = cities?.find((x) => x.slug === slug);
      return c ? (lang === 'ar' ? c.name_ar : c.name_en) : slug;
    },
    [cities, lang],
  );

  return useMemo(
    () => ({
      lang,
      cityName,
      category: (c: Category) => t(`categories.${c}`),
      difficulty: (d: Difficulty) => t(`difficulty.${d}`),
      language: (code: string) => t(`languages.${code}` as 'languages.en', { defaultValue: code.toUpperCase() }),
      applicationStatus: (s: ApplicationStatus) => t(`applicationStatus.${s}`),
      price: (egp: number) => (egp === 0 ? t('events.free') : t('events.priceEgp', { price: formatNumber(egp, lang, 0) })),
      distance: (km: number) => t('events.km', { km: formatNumber(km, lang) }),
      duration: (minutes: number) => {
        const { days, hours, minutes: m } = durationParts(minutes);
        if (days) return t('duration.days', { count: days });
        if (hours && m) return t('duration.hoursMinutes', { h: hours, m });
        if (hours) return t('duration.hours', { count: hours });
        return t('duration.minutes', { count: m });
      },
      date: (iso: string) => formatEventDate(iso, lang),
      dateRange: (start: string, end: string | null) => formatDateRange(start, end, lang),
      seatsLeft: (n: number) => (n === 0 ? t('events.full') : t('events.seatsLeft', { count: n })),
    }),
    [t, lang, cityName],
  );
}

export const CATEGORY_ICONS = {
  heritage_walk: 'business-outline',
  nature_hike: 'leaf-outline',
  city_trip: 'bus-outline',
  food_walk: 'restaurant-outline',
  photo_walk: 'camera-outline',
  multi_day_trip: 'bed-outline',
} as const satisfies Record<Category, string>;
