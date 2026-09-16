import { useCallback, useEffect, useState } from 'react';

import type { ServiceContent } from '@/features/services/service-content';
import {
  peekServiceContent,
  refreshServiceContent,
  subscribeServiceContent,
  type ServiceContentOrigin,
} from '@/features/services/service-content-repository';
import type { ServiceId } from '@/features/services/services-data';

export type ServiceContentStatus = 'loading' | 'ready' | 'error';

type State = {
  serviceId: ServiceId | undefined;
  /** null = no server or cached document yet; the screen renders the bundled fallback. */
  content: ServiceContent | null;
  origin: ServiceContentOrigin | 'fallback';
  status: ServiceContentStatus;
};

function initialState(serviceId: ServiceId | undefined): State {
  const entry = serviceId ? peekServiceContent(serviceId) : null;
  if (entry) {
    return { serviceId, content: entry.content, origin: entry.origin, status: entry.origin === 'server' ? 'ready' : 'loading' };
  }
  return { serviceId, content: null, origin: 'fallback', status: serviceId ? 'loading' : 'ready' };
}

/**
 * One service's admin-managed content, loaded when that service is opened —
 * never for every service at once.
 *
 * Renders immediately (session memory or bundled fallback), then upgrades as
 * cached and live content arrive. Content stays unresolved, so a language
 * switch re-resolves without another request.
 */
export function useServiceContent(serviceId: ServiceId | undefined) {
  const [state, setState] = useState<State>(() => initialState(serviceId));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!serviceId) return;
    let active = true;

    const unsubscribe = subscribeServiceContent(serviceId, (entry) => {
      setState((prev) => ({
        serviceId,
        content: entry.content,
        origin: entry.origin,
        status: entry.origin === 'server' ? 'ready' : prev.serviceId === serviceId ? prev.status : 'loading',
      }));
    });

    refreshServiceContent(serviceId).then((ok) => {
      if (!active || ok) return;
      setState((prev) => {
        const base = prev.serviceId === serviceId ? prev : initialState(serviceId);
        return { ...base, status: base.origin === 'server' ? 'ready' : 'error' };
      });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [serviceId, attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  // A different service than the state was built for: never show its content.
  const current = state.serviceId === serviceId ? state : initialState(serviceId);
  return { content: current.content, origin: current.origin, status: current.status, retry };
}
