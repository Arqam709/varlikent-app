import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Device-local storage for display preferences (language, theme).
 *
 * ── Why AsyncStorage and not SecureStore ────────────────────────────────
 * SecureStore is for secrets and is backed by the iOS Keychain / Android
 * Keystore — it is deliberately used for the JWT (see auth/token-storage.ts).
 * A theme name is not a secret, and keychain reads are slower, which matters
 * here because these values are read during startup where any delay is a
 * visible flash of the wrong language.
 *
 * ── Failure policy ──────────────────────────────────────────────────────
 * Every read resolves to null and every write resolves silently on failure. A
 * storage problem must degrade to "the default theme in English", never to a
 * crash or a blocked launch — nobody should be unable to open the app because a
 * preference could not be written.
 */

const LANGUAGE_KEY = 'varlikent_language';
const THEME_KEY = 'varlikent_theme';

async function read(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function write(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // Ignored on purpose — see the failure policy above.
  }
}

export const readStoredLanguage = () => read(LANGUAGE_KEY);
export const writeStoredLanguage = (value: string) => write(LANGUAGE_KEY, value);

export const readStoredTheme = () => read(THEME_KEY);
export const writeStoredTheme = (value: string) => write(THEME_KEY, value);
