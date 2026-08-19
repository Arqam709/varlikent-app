import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { I18nManager } from 'react-native';

import { readStoredLanguage, writeStoredLanguage } from '@/features/preferences/preferences-storage';
import { ar } from './translations/ar';
import { en, type TranslationShape } from './translations/en';
import { tr } from './translations/tr';


I18nManager.allowRTL(false);

const NATIVE_RTL_AT_LAUNCH = I18nManager.isRTL;

if (NATIVE_RTL_AT_LAUNCH) {
  I18nManager.forceRTL(false);
}

export type LanguageCode = 'en' | 'tr' | 'ar';

/** The three languages the website offers, in the order the picker shows them. */
export const LANGUAGES: { code: LanguageCode; label: string; englishLabel: string }[] = [
  { code: 'en', label: 'English', englishLabel: 'English' },
  { code: 'tr', label: 'Türkçe', englishLabel: 'Turkish' },
  { code: 'ar', label: 'العربية', englishLabel: 'Arabic' },
];

const BUNDLES: Record<LanguageCode, TranslationShape> = { en, tr, ar };

const RTL_LANGUAGES: LanguageCode[] = ['ar'];

type LanguageContextValue = {
  language: LanguageCode;
  setLanguage: (next: LanguageCode) => Promise<void>;
  /** Translate a dot-path key. Falls back to English, then to the key itself. */
  t: (key: string, vars?: Record<string, string>) => string;
  /**
   * Whether the SELECTED language reads right-to-left.
   *
   * Derived purely from `language` — never from I18nManager, which is pinned to
   * LTR. This is the single source of truth for direction, so the rendered
   * layout and the chosen language cannot disagree.
   */
  isRTL: boolean;
  /**
   * True only while a stale native RTL flag from an earlier build is still in
   * effect, which needs ONE restart to clear. False in normal operation —
   * language switching itself never requires a restart.
   */
  needsRestartForRTL: boolean;
  /** False until the stored preference has been read. */
  ready: boolean;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

/** Walks a dot path through a translation bundle. Returns null if absent. */
function lookup(bundle: unknown, key: string): string | null {
  const parts = key.split('.');
  let node: unknown = bundle;

  for (const part of parts) {
    if (!node || typeof node !== 'object') return null;
    node = (node as Record<string, unknown>)[part];
  }

  return typeof node === 'string' ? node : null;
}

/** Replaces {placeholders} with supplied values. */
function interpolate(text: string, vars?: Record<string, string>): string {
  if (!vars) return text;
  return Object.keys(vars).reduce(
    (result, name) => result.split(`{${name}}`).join(vars[name]),
    text
  );
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>('en');
  const [ready, setReady] = useState(false);

  // Restore the saved language before the first paint the user can see. The
  // splash covers startup, so this normally resolves behind it.
  useEffect(() => {
    let cancelled = false;

    readStoredLanguage().then((stored) => {
      if (cancelled) return;

      if (stored === 'en' || stored === 'tr' || stored === 'ar') {
        setLanguageState(stored);
      }

      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Switching language is now a pure state change.
   *
   * No I18nManager call, so nothing is latched natively and nothing needs a
   * reload — every direction-aware style re-renders from the new `isRTL` on the
   * very next frame, in both directions.
   */
  const setLanguage = useCallback(async (next: LanguageCode) => {
    setLanguageState(next);
    await writeStoredLanguage(next);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string>) => {
      // Selected language, then English, then the key — so a missing
      // translation degrades to readable English instead of "undefined".
      const value = lookup(BUNDLES[language], key) ?? lookup(en, key) ?? key;
      return interpolate(value, vars);
    },
    [language]
  );

  const isRTL = RTL_LANGUAGES.includes(language);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t,
      isRTL,
      // Not about the selected language at all — only about a leftover native
      // flag from an earlier build, which is cleared on the next launch.
      needsRestartForRTL: NATIVE_RTL_AT_LAUNCH,
      ready,
    }),
    [language, setLanguage, t, isRTL, ready]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/**
 * Reads the language state.
 *
 * Throws outside the provider: unlike realtime, localization is not optional —
 * a screen rendering without it would show raw translation keys, and failing
 * loudly in development is far better than shipping "account.title" to a user.
 */
export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
