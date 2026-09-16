import { fetchServiceContent } from '@/features/services/service-content-api';
import { readCachedServiceContent, writeCachedServiceContent } from '@/features/services/service-content-cache';
import type { ServiceContent } from '@/features/services/service-content';
import type { ServiceId } from '@/features/services/services-data';

/**
 * One content source per service — the About repository's pattern, keyed.
 *
 *   - the newest document seen this session, per service
 *   - one in-flight request per service, shared by concurrent readers
 *   - readers of a service are told when newer content for THAT service arrives
 *
 * Precedence only moves forward: bundled fallback → cached → server. A cache
 * read that finishes after that service's server content arrived is discarded.
 * Services never touch each other's entries.
 */

export type ServiceContentOrigin = 'cache' | 'server';

export type ServiceContentEntry = { content: ServiceContent; origin: ServiceContentOrigin };

type Listener = (entry: ServiceContentEntry) => void;

const latest = new Map<ServiceId, ServiceContentEntry>();
const inflight = new Map<ServiceId, Promise<ServiceContent | null>>();
const listeners = new Map<ServiceId, Set<Listener>>();

function publish(serviceId: ServiceId, entry: ServiceContentEntry) {
  latest.set(serviceId, entry);
  for (const listener of listeners.get(serviceId) ?? []) listener(entry);
}

export function peekServiceContent(serviceId: ServiceId): ServiceContentEntry | null {
  return latest.get(serviceId) ?? null;
}

export function subscribeServiceContent(serviceId: ServiceId, listener: Listener): () => void {
  const set = listeners.get(serviceId) ?? new Set<Listener>();
  set.add(listener);
  listeners.set(serviceId, set);
  return () => {
    set.delete(listener);
  };
}

function loadFromServer(serviceId: ServiceId): Promise<ServiceContent | null> {
  let request = inflight.get(serviceId);
  if (!request) {
    request = fetchServiceContent(serviceId).finally(() => {
      inflight.delete(serviceId);
    });
    inflight.set(serviceId, request);
  }
  return request;
}

/**
 * Loads this service's cached copy (once per session) and live copy in
 * parallel, publishing each usable result. Resolves `true` when the server
 * answered with a document. Never rejects.
 */
export function refreshServiceContent(serviceId: ServiceId): Promise<boolean> {
  if (!latest.has(serviceId)) {
    void readCachedServiceContent(serviceId).then((cached) => {
      if (cached && latest.get(serviceId)?.origin !== 'server') publish(serviceId, { content: cached, origin: 'cache' });
    });
  }

  return loadFromServer(serviceId).then((fresh) => {
    if (!fresh) return false;
    if (latest.get(serviceId)?.content !== fresh) {
      publish(serviceId, { content: fresh, origin: 'server' });
      void writeCachedServiceContent(serviceId, fresh);
    }
    return true;
  });
}

/** Test seam: forget every service's memory, requests and listeners. */
export function resetServiceContentMemory(): void {
  latest.clear();
  inflight.clear();
  listeners.clear();
}
