import AsyncStorage from '@react-native-async-storage/async-storage';
import { reloadAppAsync } from 'expo';
import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager, Platform } from 'react-native';

import type { AppLanguage } from '@/lib/format';

import ar from './locales/ar';
import en from './locales/en';

const i18n = createInstance();
const LANG_KEY = 'masar.language';
const RTL_RELOAD_KEY = 'masar.rtlReloadAt';

export function deviceLanguage(): AppLanguage {
  return getLocales()[0]?.languageCode === 'ar' ? 'ar' : 'en';
}

export const isRTL = () => I18nManager.isRTL;

/** Applies RTL/LTR layout. Returns true when a reload is needed for it to take effect. */
function applyDirection(lang: AppLanguage): boolean {
  const rtl = lang === 'ar';
  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    return false;
  }
  I18nManager.allowRTL(rtl);
  if (I18nManager.isRTL !== rtl) {
    I18nManager.forceRTL(rtl);
    return true;
  }
  return false;
}

export async function initI18n(): Promise<AppLanguage> {
  let saved: string | null = null;
  try {
    saved = await AsyncStorage.getItem(LANG_KEY);
  } catch {
    // storage unavailable — fall back to the device language
  }
  const lang: AppLanguage = saved === 'ar' || saved === 'en' ? saved : deviceLanguage();

  await i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, ar: { translation: ar } },
    lng: lang,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

  if (applyDirection(lang)) {
    // Reload once so the native layout direction flips; guard against reload loops
    // on hosts where forceRTL has no effect.
    const last = Number((await AsyncStorage.getItem(RTL_RELOAD_KEY).catch(() => null)) ?? 0);
    if (Date.now() - last > 15_000) {
      await AsyncStorage.setItem(RTL_RELOAD_KEY, String(Date.now())).catch(() => undefined);
      await reloadAppAsync('Switching layout direction');
    }
  }
  return lang;
}

export async function changeLanguage(lang: AppLanguage) {
  await AsyncStorage.setItem(LANG_KEY, lang).catch(() => undefined);
  await i18n.changeLanguage(lang);
  if (applyDirection(lang)) {
    await reloadAppAsync('Switching layout direction');
  }
}

export function currentLanguage(): AppLanguage {
  return i18n.language === 'ar' ? 'ar' : 'en';
}

export default i18n;
