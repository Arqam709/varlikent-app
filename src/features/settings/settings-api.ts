import { apiRequest } from '@/services/api-client';
import type { SiteSettings, SiteSettingsResponse } from '@/types/settings';

export async function getSiteSettings(): Promise<SiteSettings> {
  const response = await apiRequest<SiteSettingsResponse>('/settings');

  // Defensive, matching getProperties: a malformed body should yield a screen
  // with no contact actions rather than a crash on first property access.
  return response?.settings && typeof response.settings === 'object'
    ? response.settings
    : {};
}
