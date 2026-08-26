import { getToken } from '@/features/auth/token-storage';
import {
  readStoredLanguage,
  readStoredLanguageSource,
  readStoredTheme,
  writeStoredLanguage,
  writeStoredLanguageSource,
} from '@/features/preferences/preferences-storage';
import { getRawDeviceLocale, resolveSupportedLanguage } from './device-locale';

/**
 * CHOOSING THE LANGUAGE ON FIRST LAUNCH
 *
 * ── The problem this exists to solve ────────────────────────────────────
 * A Turkish customer installing Varlikent should not have to find
 * Account → Language, in English, to make the app readable. So a genuinely
 * fresh install now starts in the phone's language.
 *
 * The danger is the other half. Before this phase, `varlikent_language` was
 * written ONLY by `setLanguage`, so an existing customer who had used the app
 * happily in English for months — and never opened the Language screen — has no
 * stored value at all. Their installation is byte-for-byte indistinguishable
 * from a brand-new one by that key alone. Ship naive detection and they update
 * the app one morning and find it in Turkish, having changed nothing.
 *
 * An update must never change a working app's language. So detection only runs
 * when there is no evidence of a prior installation.
 *
 * ── The order ───────────────────────────────────────────────────────────
 *   1. A valid stored language wins, always. Nothing else is consulted.
 *   2. Otherwise, if this install has already been initialised (a valid source
 *      marker), no detection — the decision was made once and stands.
 *   3. Otherwise, if anything suggests the install predates this phase,
 *      grandfather it to English.
 *   4. Only a genuinely blank install reaches device detection.
 *
 * Whatever is decided is persisted immediately, so this runs once per install
 * rather than on every launch.
 */

/** How the current language was arrived at. */
export type LanguageSource =
  /** The customer chose it in Account → Language. Outranks everything. */
  | 'user'
  /** Detected from the phone on a fresh install (English if unsupported). */
  | 'device'
  /** A pre-existing install with no stored choice, held at English. */
  | 'legacy';

const SOURCES: LanguageSource[] = ['user', 'device', 'legacy'];

/** Narrows a stored marker, rejecting anything this version does not know. */
function toLanguageSource(value: unknown): LanguageSource | null {
  return typeof value === 'string' && (SOURCES as string[]).includes(value)
    ? (value as LanguageSource)
    : null;
}

/** Narrows a stored language against the registry. */
function toSupportedCode<T extends string>(
  value: unknown,
  supported: readonly { code: T }[]
): T | null {
  if (typeof value !== 'string') return null;
  return supported.find((entry) => entry.code === value)?.code ?? null;
}

/**
 * Whether this installation existed before language initialisation did.
 *
 * Every signal here is something that could only have been written by a
 * customer actually using the app, and none of them is written during a first
 * launch before this function runs — so a true result means "not fresh", never
 * "we got here first".
 *
 *   • A stored THEME. `writeStoredTheme` is called only from `setTheme`, which
 *     is only reachable from Account → Appearance. Its presence means someone
 *     deliberately picked a theme.
 *
 *   • A stored AUTH TOKEN. Written only on a successful sign-in. Read here and
 *     nothing more: not refreshed, not validated, not cleared, and no network
 *     request — an expired token is still perfectly good evidence that this
 *     phone has been used.
 *
 *   • RESIDUE in either language key: a value that is present but not something
 *     this version recognises. Only the app writes these keys, so anything
 *     there at all means the app has run before. Corrupt beats surprising: it
 *     is better to hold a confused install at English than to flip its language.
 */
async function hasPreexistingInstall(residue: boolean): Promise<boolean> {
  if (residue) return true;

  const storedTheme = await readStoredTheme();
  if (typeof storedTheme === 'string' && storedTheme.trim()) return true;

  try {
    const token = await getToken();
    if (typeof token === 'string' && token.trim()) return true;
  } catch {
    // SecureStore can fail on a locked or misconfigured keystore. An
    // unreadable token is simply not evidence; it must not break startup.
  }

  return false;
}

/**
 * Decides — and records — the language this installation starts in.
 *
 * Never rejects. Every storage call already fails soft (see
 * preferences-storage), and locale detection is fully guarded, so the worst
 * outcome is English.
 *
 * @param supported The LANGUAGES registry. Passed in rather than imported so
 *   this module has no dependency on the provider that calls it.
 * @param fallback The language for an unsupported or unreadable locale.
 */
export async function resolveInitialLanguage<T extends string>({
  supported,
  fallback,
}: {
  supported: readonly { code: T }[];
  fallback: T;
}): Promise<{ language: T; source: LanguageSource }> {
  const [rawLanguage, rawSource] = await Promise.all([
    readStoredLanguage(),
    readStoredLanguageSource(),
  ]);

  const storedLanguage = toSupportedCode(rawLanguage, supported);
  const storedSource = toLanguageSource(rawSource);

  /* 1 ── A real stored preference always wins. */
  if (storedLanguage) {
    /*
     * A language with no marker is a preference saved before this phase
     * existed. Only `setLanguage` ever wrote that key, so it can only have come
     * from the customer tapping a language — record it as theirs and leave the
     * language completely alone.
     */
    if (!storedSource) {
      await writeStoredLanguageSource('user');
      return { language: storedLanguage, source: 'user' };
    }

    return { language: storedLanguage, source: storedSource };
  }

  /*
   * From here the stored language is missing or unusable.
   *
   * `residue` is true when a key holds something the app itself must have
   * written but this version cannot read. It is treated as proof of a prior
   * install, and it is also what stops a corrupt value from causing detection
   * to run again on every single launch.
   */
  const residue =
    (typeof rawLanguage === 'string' && rawLanguage.trim().length > 0) ||
    (typeof rawSource === 'string' && rawSource.trim().length > 0 && !storedSource);

  /* 2 ── Already initialised, but the language is gone. Do not re-detect. */
  if (storedSource) {
    await writeStoredLanguage(fallback);
    return { language: fallback, source: storedSource };
  }

  /* 3 ── Evidence of a prior install: hold it where it has always been. */
  if (await hasPreexistingInstall(residue)) {
    await writeStoredLanguage(fallback);
    await writeStoredLanguageSource('legacy');
    return { language: fallback, source: 'legacy' };
  }

  /* 4 ── Genuinely fresh. Meet the customer in their own language. */
  const detected = resolveSupportedLanguage(getRawDeviceLocale(), supported, fallback);

  await writeStoredLanguage(detected);
  await writeStoredLanguageSource('device');

  return { language: detected, source: 'device' };
}
