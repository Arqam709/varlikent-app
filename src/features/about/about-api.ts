import { normalizeAboutContent, type AboutContent } from '@/features/about/about-content';
import { apiRequest } from '@/services/api-client';

/**
 * GET /api/about — the website's About CMS document, normalized — or `null`.
 *
 * The same public endpoint the website's About page reads; there is no
 * app-specific About API. Never throws: `null` covers a network failure, a
 * server error and a payload with nothing usable, and in each case the caller
 * keeps the content it already shows.
 */
export async function fetchAboutContent(): Promise<AboutContent | null> {
  try {
    return normalizeAboutContent(await apiRequest<unknown>('/about'));
  } catch {
    return null;
  }
}
