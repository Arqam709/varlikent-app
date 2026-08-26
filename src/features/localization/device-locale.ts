import { I18nManager } from 'react-native';

export function getRawDeviceLocale(): string | null {
  // Intl is present on Hermes, but a stripped JS engine or a locale-data
  // problem can make this throw rather than return — hence the try.
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (typeof locale === 'string' && locale.trim()) return locale;
  } catch {
    // Fall through to the native constant.
  }

  try {
    const { localeIdentifier } = I18nManager.getConstants();
    if (typeof localeIdentifier === 'string' && localeIdentifier.trim()) {
      return localeIdentifier;
    }
  } catch {
    // Nothing left to try.
  }

  return null;
}


export function normalizeLocaleLanguage(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;

  const [subtag] = raw.trim().split(/[-_]/);
  if (!subtag) return null;

  const lowered = subtag.toLowerCase();
  return /^[a-z]{2,3}$/.test(lowered) ? lowered : null;
}

export function resolveSupportedLanguage<T extends string>(
  raw: string | null | undefined,
  supported: readonly { code: T }[],
  fallback: T
): T {
  const normalized = normalizeLocaleLanguage(raw);
  if (!normalized) return fallback;

  return supported.find((entry) => entry.code === normalized)?.code ?? fallback;
}
