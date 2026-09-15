import type { LanguageCode } from '@/features/localization/language-context';
import { apiRequest } from '@/services/api-client';


export type ContactInterestLabels = Partial<Record<LanguageCode, string>> & { en: string };

export type ContactInterest = {
  id: string;
  value: string;
  labels: ContactInterestLabels;
  order: number;
};

/**
 * The ids this build knows about — for code that targets a specific interest
 * (service links). The server may add more at any time; they still render.
 * Never narrow `ContactInterest.id` to this union: admin-created ids must pass.
 */
export type KnownContactInterestId =
  | 'buying'
  | 'renting'
  | 'selling'
  | 'renovation'
  | 'interior_design'
  | 'architecture'
  | 'construction'
  | 'general'
  | 'troubleshoot';

export const CONTACT_INTEREST_LANGUAGES: readonly LanguageCode[] = ['en', 'tr', 'ar', 'de', 'ru', 'ur'];

/** What the Contact screen selects when nothing more specific was requested. */
export const DEFAULT_CONTACT_INTEREST_ID: KnownContactInterestId = 'general';

/**
 * The bundled fallback — SAME shape as the API response, and a snapshot of the
 * backend's nine BUILT-IN defaults (Troubleshoot and Construction included).
 *
 * Since Phase 1B the live list is admin-managed. This copy is only the
 * baseline: an interest created in Admin after this build shipped reaches the
 * app through the API (and the last-successful cache in
 * contact-interests-cache.ts), never through this file. A first launch with no
 * network therefore shows the built-in nine.
 */
export const FALLBACK_CONTACT_INTERESTS: readonly ContactInterest[] = [
  { id: 'buying', value: 'Buying', order: 1, labels: { en: 'Buying', tr: 'Satın Alma', ar: 'الشراء', de: 'Kauf', ru: 'Покупка', ur: 'خریداری' } },
  { id: 'renting', value: 'Renting', order: 2, labels: { en: 'Renting', tr: 'Kiralama', ar: 'الإيجار', de: 'Miete', ru: 'Аренда', ur: 'کرایہ' } },
  { id: 'selling', value: 'Selling', order: 3, labels: { en: 'Selling', tr: 'Satış', ar: 'البيع', de: 'Verkauf', ru: 'Продажа', ur: 'فروخت' } },
  { id: 'renovation', value: 'Renovation', order: 4, labels: { en: 'Renovation', tr: 'Tadilat', ar: 'التجديد', de: 'Renovierung', ru: 'Ремонт', ur: 'تزئینِ نو' } },
  { id: 'interior_design', value: 'Interior Design', order: 5, labels: { en: 'Interior Design', tr: 'İç Mimarlık', ar: 'التصميم الداخلي', de: 'Innenarchitektur', ru: 'Дизайн интерьера', ur: 'داخلی ڈیزائن' } },
  { id: 'architecture', value: 'Architecture', order: 6, labels: { en: 'Architecture', tr: 'Mimarlık', ar: 'العمارة', de: 'Architektur', ru: 'Архитектура', ur: 'فنِ تعمیر' } },
  { id: 'construction', value: 'Construction', order: 7, labels: { en: 'Construction', tr: 'İnşaat', ar: 'الإنشاءات', de: 'Bau', ru: 'Строительство', ur: 'تعمیرات' } },
  { id: 'general', value: 'General', order: 8, labels: { en: 'General Enquiry', tr: 'Genel Talep', ar: 'استفسار عام', de: 'Allgemeine Anfrage', ru: 'Общий вопрос', ur: 'عام استفسار' } },
  { id: 'troubleshoot', value: 'Troubleshoot', order: 9, labels: { en: 'Troubleshoot', tr: 'Sorun Giderme', ar: 'استكشاف الأخطاء', de: 'Problembehebung', ru: 'Решение проблемы', ur: 'مسئلہ حل کرنا' } },
];

const ID_PATTERN = /^[a-z][a-z0-9_]*$/;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isText = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';


export function normalizeContactInterests(payload: unknown): ContactInterest[] {
  const list = Array.isArray(payload)
    ? payload
    : isPlainObject(payload) && Array.isArray(payload.interests)
      ? payload.interests
      : null;

  if (!list) return [];

  const seenIds = new Set<string>();
  const seenValues = new Set<string>();
  const accepted: (ContactInterest & { index: number })[] = [];

  list.forEach((raw: unknown, index: number) => {
    if (!isPlainObject(raw) || raw.enabled === false) return;

    const { id, value, labels, order } = raw;
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) return;
    if (!isText(value) || value !== value.trim()) return;
    if (!isPlainObject(labels) || !isText(labels.en)) return;
    if (seenIds.has(id) || seenValues.has(value)) return;

    seenIds.add(id);
    seenValues.add(value);

    const cleanLabels: Record<string, string> = {};
    for (const lang of CONTACT_INTEREST_LANGUAGES) {
      const label = labels[lang];
      if (isText(label)) cleanLabels[lang] = label;
    }

    accepted.push({
      id,
      value,
      labels: cleanLabels as ContactInterestLabels,
      order: typeof order === 'number' && Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER,
      index,
    });
  });

  return accepted
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map(({ id, value, labels, order }) => ({ id, value, labels, order }));
}

/** The text to SHOW: current language, then English, then the value. Never submit this. */
export function contactInterestLabel(interest: ContactInterest, language: string): string {
  const labels = interest.labels as Record<string, string | undefined>;
  if (isText(labels[language])) return labels[language] as string;
  if (isText(labels.en)) return labels.en as string;
  return interest.value;
}

/**
 * Finds an entry by stable id OR by legacy value.
 *
 * Both are accepted because `/contact?interestType=` has always carried the
 * legacy value ('Interior Design') — from older service links, deep links and
 * shared URLs — while new code passes the id. Either resolves to the same entry.
 */
export function findContactInterest(
  interests: readonly ContactInterest[],
  key: unknown
): ContactInterest | undefined {
  if (typeof key !== 'string' || key === '') return undefined;
  return interests.find((interest) => interest.id === key || interest.value === key);
}

/**
 * The entry a Contact screen should select for a requested key: the match if
 * there is one, otherwise General, otherwise the first option. Always returns
 * an entry while the list is non-empty, so selection state is never undefined.
 */
export function resolveContactInterest(
  interests: readonly ContactInterest[],
  key: unknown
): ContactInterest {
  return (
    findContactInterest(interests, key) ??
    findContactInterest(interests, DEFAULT_CONTACT_INTEREST_ID) ??
    interests[0] ??
    FALLBACK_CONTACT_INTERESTS[FALLBACK_CONTACT_INTERESTS.length - 2]
  );
}

/**
 * The interest key a Contact screen was asked to preselect: the route param
 * when it is a non-empty string (a stable id, or a legacy value from an older
 * link), otherwise General.
 *
 * Kept UNRESOLVED on purpose. Resolving against the bundled list at mount would
 * turn an id this build has never seen (an admin-created interest) into
 * General before the server list could offer it. Resolve at render instead.
 */
export function requestedContactInterestKey(param: unknown): string {
  return typeof param === 'string' && param !== '' ? param : DEFAULT_CONTACT_INTEREST_ID;
}

/**
 * GET /api/contact/interests, normalized — or `null`.
 *
 * Never throws. `null` covers a network failure, a server error and a payload
 * that normalizes to nothing, and in every one of those cases the caller simply
 * keeps the list it already has. That is what keeps Contact usable when this
 * endpoint is unreachable.
 */
export async function fetchContactInterests(): Promise<ContactInterest[] | null> {
  try {
    const response = await apiRequest<unknown>('/contact/interests');
    const interests = normalizeContactInterests(response);
    return interests.length > 0 ? interests : null;
  } catch {
    return null;
  }
}
