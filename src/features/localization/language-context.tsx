import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { I18nManager } from 'react-native';

import { writeStoredLanguage, writeStoredLanguageSource } from '@/features/preferences/preferences-storage';
import { resolveInitialLanguage } from './language-bootstrap';
import { ar } from './translations/ar';
import { de } from './translations/de';
import { en, type TranslationShape } from './translations/en';
import { tr } from './translations/tr';


I18nManager.allowRTL(false);

const NATIVE_RTL_AT_LAUNCH = I18nManager.isRTL;

if (NATIVE_RTL_AT_LAUNCH) {
  I18nManager.forceRTL(false);
}

export type LanguageCode = 'en' | 'tr' | 'ar' | 'de';

/**
 * Everything the app knows about one language.
 *
 * `label` is the language's own name for itself and `englishLabel` is for
 * screen readers, which announce the current UI language's voice — "العربية"
 * read aloud by an English voice is noise.
 */
export type LanguageMeta = {
  code: LanguageCode;
  label: string;
  englishLabel: string;
  /**
   * Whether this language reads right-to-left.
   *
   * Lives here rather than in a separate list on purpose. A parallel
   * `RTL_LANGUAGES` array is a second place to remember, and the failure mode is
   * silent: adding Urdu would give a correct picker entry and a
   * left-to-right layout. Kept beside the language it describes, the two
   * cannot drift.
   */
  rtl: boolean;
};

/** The languages this build offers, in the order the picker shows them. */
export const LANGUAGES: LanguageMeta[] = [
  { code: 'en', label: 'English', englishLabel: 'English', rtl: false },
  { code: 'tr', label: 'Türkçe', englishLabel: 'Turkish', rtl: false },
  { code: 'ar', label: 'العربية', englishLabel: 'Arabic', rtl: true },
  { code: 'de', label: 'Deutsch', englishLabel: 'German', rtl: false },
];

const BUNDLES: Record<LanguageCode, TranslationShape> = { en, tr, ar, de };

/**
 * The registry entry for a language code.
 *
 * Falls back to the first entry rather than returning undefined: every caller
 * wants a direction and a label, and there is no useful "unknown language"
 * rendering. `language` is a `LanguageCode`, so the fallback is unreachable in
 * practice — it exists so this returns a value rather than a maybe.
 */
export function getLanguageMeta(code: LanguageCode): LanguageMeta {
  return LANGUAGES.find((entry) => entry.code === code) ?? LANGUAGES[0];
}

type LanguageContextValue = {
  language: LanguageCode;
  setLanguage: (next: LanguageCode) => Promise<void>;
  /** Translate a dot-path key. Falls back to English, then to the key itself. */
  t: (key: string, vars?: Record<string, string>) => string;
  /**
   * Whether the SELECTED language reads right-to-left.
   *
   * Derived from the LANGUAGES registry entry for `language` — never from
   * I18nManager, which is pinned to LTR. The registry is the single source of
   * truth for direction, so the rendered layout and the chosen language cannot
   * disagree.
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

  /*
   * Settle on a language before the first paint the user can see.
   *
   * For a returning customer this costs two parallel AsyncStorage reads
   * (language and its source) instead of the previous one, and nothing else —
   * `resolveInitialLanguage` answers from the stored value without touching
   * SecureStore or the locale APIs. The extra evidence checks happen only on
   * the single launch that has no stored language, and the branded splash is
   * still covering the screen while they run.
   *
   * It cannot reject: storage failures resolve to null by design and locale
   * detection is fully guarded, so the worst case is English.
   */
  useEffect(() => {
    let cancelled = false;

    resolveInitialLanguage({ supported: LANGUAGES, fallback: 'en' }).then(({ language: next }) => {
      if (cancelled) return;

      setLanguageState(next);
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

    /*
     * Marking the choice as the customer's is what makes it permanent. From
     * here the phone's own language is never consulted again on this install —
     * someone who deliberately switched a Turkish phone to English must not
     * find Turkish waiting for them at the next launch.
     */
    await writeStoredLanguageSource('user');
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

  // Derived from the registry, so the picker and the layout can never
  // disagree about which languages read right-to-left.
  const isRTL = getLanguageMeta(language).rtl;

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
