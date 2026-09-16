import {
  resolveLocalizedContent,
  sanitizeLocalizedContent,
  type LocalizedContent,
} from '@/features/localization/localized-content';
import { SERVICE_PAGES } from '@/features/services/service-content';
import type { ServiceId } from '@/features/services/services-data';
import { apiRequest } from '@/services/api-client';
import type { SiteSettings } from '@/types/settings';
import { usableRemoteImage } from '@/utils/remote-image';

/**
 * A service's showroom gallery — the website's "Our Work" carousel.
 *
 * Separate from PageContent: the media are ShowroomImage records (Admin →
 * Showroom) served at GET /api/showroom/:category, which already returns only
 * visible items in admin order. The section's label and heading come from
 * PageContent (`showroomLabel` / `showroomHeading`), and the owner can switch
 * a gallery off per service in Site Settings (`showroomEnabled`) — both
 * respected exactly as the website does.
 *
 * Videos and site-relative paths are omitted: the app has no video player.
 */

export type ShowroomItem = {
  id: string;
  image: string;
  caption: LocalizedContent | null;
  title: LocalizedContent | null;
  order: number;
};

export type ResolvedShowroomItem = { id: string; image: string; caption: string };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The public response's images, safe to render. Null when it is not a showroom response. */
export function normalizeShowroom(payload: unknown): ShowroomItem[] | null {
  const list = Array.isArray(payload)
    ? payload
    : isPlainObject(payload) && Array.isArray(payload.images)
      ? payload.images
      : null;
  if (!list) return null;

  const items: (ShowroomItem & { index: number })[] = [];
  const seen = new Set<string>();

  list.forEach((raw, index) => {
    if (!isPlainObject(raw) || raw.visible === false) return;
    const image = usableRemoteImage(raw.url);
    if (!image) return;
    const id = typeof raw._id === 'string' && raw._id ? raw._id : `item-${index}`;
    if (seen.has(id)) return;
    seen.add(id);
    items.push({
      id,
      image,
      caption: sanitizeLocalizedContent(raw.caption),
      title: sanitizeLocalizedContent(raw.title),
      order: typeof raw.order === 'number' && Number.isFinite(raw.order) ? raw.order : index,
      index,
    });
  });

  return items
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map(({ index: _index, ...item }) => item);
}

export function resolveShowroomItems(items: readonly ShowroomItem[], language: string): ResolvedShowroomItem[] {
  return items.map((item) => ({
    id: item.id,
    image: item.image,
    caption: resolveLocalizedContent(item.caption, language) || resolveLocalizedContent(item.title, language),
  }));
}

/** The website's rule: shown unless the owner explicitly switched this gallery off. */
export function isShowroomEnabled(settings: SiteSettings | null | undefined, serviceId: ServiceId): boolean {
  const category = SERVICE_PAGES[serviceId]?.showroomCategory;
  if (!category) return false;
  return settings?.showroomEnabled?.[category] !== false;
}

/** GET /api/showroom/:category, normalized — or null on failure. Never throws. */
export async function fetchServiceShowroom(serviceId: ServiceId): Promise<ShowroomItem[] | null> {
  const category = SERVICE_PAGES[serviceId]?.showroomCategory;
  if (!category) return null;
  try {
    return normalizeShowroom(await apiRequest<unknown>(`/showroom/${category}`));
  } catch {
    return null;
  }
}
