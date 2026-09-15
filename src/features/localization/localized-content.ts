import type { LanguageCode } from '@/features/localization/language-context';

/**
 * BACKEND-AUTHORED LOCALIZED TEXT.
 *
 * ── Not the same thing as `t()` ─────────────────────────────────────────
 * `t()` reads the APP's own interface strings from translations/*.ts. This file
 * reads CONTENT an admin wrote on the website (About, and future shared CMS
 * content), which the backend stores in one of two shapes:
 *
 *   'Our Story'                                           a legacy plain string
 *   { sourceLang: 'en', en: 'Our Story', tr: '…', … }     a localized object
 *
 * The resolution order mirrors the website's `localizedText` helper
 * (frontend/src/lib/localizedText.js), so a visitor sees the same text in the
 * app as on the site:
 *
 *   requested language → English → sourceLang → first usable language → ''
 *
 * "Usable" means a non-blank string that is not a translation-provider warning.
 * The backend already strips those on GET, but a cached response may predate
 * that, so the same filter is applied here.
 *
 * Pure: no React, no storage, and inputs are never mutated.
 */

export const CONTENT_LANGUAGES: readonly LanguageCode[] = ['en', 'tr', 'ar', 'de', 'ru', 'ur'];

const DEFAULT_LANGUAGE: LanguageCode = 'en';

/** Text the free translation provider returns instead of a translation. */
const POISONED_TRANSLATION = /MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID LANGPAIR/i;

export type LocalizedContentObject = Partial<Record<LanguageCode, string>> & { sourceLang?: LanguageCode };

/** What a localized backend field may hold after sanitising. */
export type LocalizedContent = string | LocalizedContentObject;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isContentLanguage = (value: unknown): value is LanguageCode =>
  typeof value === 'string' && (CONTENT_LANGUAGES as readonly string[]).includes(value);

/** A non-blank string that is not provider garbage. */
export function isUsableContentText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && !POISONED_TRANSLATION.test(value);
}

/**
 * The text to show for a backend localized field, or '' when there is none.
 * Returned trimmed. Never throws, whatever it is given.
 */
export function resolveLocalizedContent(value: unknown, language: string): string {
  if (typeof value === 'string') return isUsableContentText(value) ? value.trim() : '';
  if (!isPlainObject(value)) return '';

  const requested: LanguageCode = isContentLanguage(language) ? language : DEFAULT_LANGUAGE;

  if (isUsableContentText(value[requested])) return (value[requested] as string).trim();
  if (isUsableContentText(value[DEFAULT_LANGUAGE])) return (value[DEFAULT_LANGUAGE] as string).trim();

  const source = value.sourceLang;
  if (isContentLanguage(source) && isUsableContentText(value[source])) return (value[source] as string).trim();

  for (const lang of CONTENT_LANGUAGES) {
    if (isUsableContentText(value[lang])) return (value[lang] as string).trim();
  }

  return '';
}

/**
 * A clean COPY of a localized field — only the six language strings and a
 * valid `sourceLang` — or null when nothing text-like is present.
 *
 * Used before caching, so Mongo internals or unexpected keys in a backend
 * response are never persisted on the device. Resolution still happens later,
 * per render, so switching language needs no refetch.
 */
export function sanitizeLocalizedContent(value: unknown): LocalizedContent | null {
  if (typeof value === 'string') return value;
  if (!isPlainObject(value)) return null;

  const clean: LocalizedContentObject = {};
  for (const lang of CONTENT_LANGUAGES) {
    const text = value[lang];
    if (typeof text === 'string') clean[lang] = text;
  }
  if (Object.keys(clean).length === 0) return null;
  if (isContentLanguage(value.sourceLang)) clean.sourceLang = value.sourceLang;
  return clean;
}

/** True when the field would resolve to visible text in at least one language. */
export function hasLocalizedContent(value: unknown): boolean {
  return resolveLocalizedContent(value, DEFAULT_LANGUAGE) !== '';
}
