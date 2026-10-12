import { differenceInCalendarDays, format, isSameDay } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

export type AppLanguage = 'en' | 'ar';

const dateLocale = (lang: AppLanguage) => (lang === 'ar' ? ar : enUS);
const numberLocale = (lang: AppLanguage) => (lang === 'ar' ? 'ar-EG' : 'en-EG');

export function formatEventDate(iso: string, lang: AppLanguage) {
  return format(new Date(iso), 'EEE d MMM · HH:mm', { locale: dateLocale(lang) });
}

export function formatDateRange(startIso: string, endIso: string | null, lang: AppLanguage) {
  const start = new Date(startIso);
  if (!endIso) return formatEventDate(startIso, lang);
  const end = new Date(endIso);
  const locale = dateLocale(lang);
  if (isSameDay(start, end)) {
    return `${format(start, 'EEE d MMM · HH:mm', { locale })}–${format(end, 'HH:mm', { locale })}`;
  }
  return `${format(start, 'd MMM', { locale })} – ${format(end, 'd MMM yyyy', { locale })}`;
}

export function formatDay(iso: string, lang: AppLanguage) {
  return format(new Date(iso), 'EEEE d MMMM yyyy', { locale: dateLocale(lang) });
}

export function formatTime(iso: string, lang: AppLanguage) {
  return format(new Date(iso), 'HH:mm', { locale: dateLocale(lang) });
}

export function daysUntil(iso: string, now = new Date()) {
  return differenceInCalendarDays(new Date(iso), now);
}

export function formatNumber(n: number, lang: AppLanguage, maximumFractionDigits = 1) {
  try {
    return new Intl.NumberFormat(numberLocale(lang), { maximumFractionDigits }).format(n);
  } catch {
    return String(Math.round(n * 10) / 10);
  }
}

/** Returns hours/minutes/days parts so the caller can translate the units. */
export function durationParts(minutes: number) {
  if (minutes >= 24 * 60) {
    return { days: Math.round(minutes / (24 * 60)), hours: 0, minutes: 0 };
  }
  return { days: 0, hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}
