import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { en, type TranslationKey } from './en';
import { ru } from './ru';

export type Locale = 'en' | 'ru';

const translations: Record<Locale, Record<TranslationKey, string>> = { en, ru };

interface I18nState {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nState | null>(null);

function getSavedLocale(): Locale {
  try {
    const saved = localStorage.getItem('spm_lang');
    if (saved === 'ru' || saved === 'en') return saved;
  } catch { /* ignore */ }
  // Detect from browser
  const lang = navigator.language?.toLowerCase() || '';
  if (lang.startsWith('ru')) return 'ru';
  return 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getSavedLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem('spm_lang', l); } catch { /* ignore */ }
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => translations[locale][key] ?? translations.en[key] ?? key,
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

export type { TranslationKey };
