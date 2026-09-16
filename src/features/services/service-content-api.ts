import { SERVICE_PAGES, normalizeServiceContent, type ServiceContent } from '@/features/services/service-content';
import type { ServiceId } from '@/features/services/services-data';
import { apiRequest } from '@/services/api-client';

/**
 * GET /api/page-content/:pageKey for one service, normalized — or `null`.
 *
 * The same public endpoint the website's service pages read. Never throws:
 * `null` covers a network failure, a server error and a payload that is not a
 * PageContent document, and in each case the screen keeps what it shows.
 */
export async function fetchServiceContent(serviceId: ServiceId): Promise<ServiceContent | null> {
  const map = SERVICE_PAGES[serviceId];
  if (!map) return null;
  try {
    return normalizeServiceContent(serviceId, await apiRequest<unknown>(`/page-content/${map.pageKey}`));
  } catch {
    return null;
  }
}
