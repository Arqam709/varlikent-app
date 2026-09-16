import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  normalizeServiceContent,
  serializeServiceContent,
  type ServiceContent,
} from '@/features/services/service-content';
import type { ServiceId } from '@/features/services/services-data';

/**
 * The last successful PageContent document for each service, one entry per
 * service so Architecture can never overwrite Construction.
 *
 * Read back through the same normalizer as a live response, so a corrupt
 * entry, or one written for another page, is simply "no cache". Failed reads
 * resolve to null and failed writes are ignored.
 */

export const SERVICE_CONTENT_CACHE_PREFIX = 'varlikent_service_content_v1:';

export const serviceContentCacheKey = (serviceId: ServiceId) => `${SERVICE_CONTENT_CACHE_PREFIX}${serviceId}`;

export async function readCachedServiceContent(serviceId: ServiceId): Promise<ServiceContent | null> {
  try {
    const raw = await AsyncStorage.getItem(serviceContentCacheKey(serviceId));
    if (!raw) return null;
    return normalizeServiceContent(serviceId, JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function writeCachedServiceContent(serviceId: ServiceId, content: ServiceContent): Promise<void> {
  try {
    await AsyncStorage.setItem(serviceContentCacheKey(serviceId), JSON.stringify(serializeServiceContent(content)));
  } catch {
    // Ignored on purpose — a cache is an optimisation, never a requirement.
  }
}
