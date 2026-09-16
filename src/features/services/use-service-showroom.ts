import { useEffect, useState } from 'react';

import {
  fetchServiceShowroom,
  isShowroomEnabled,
  type ShowroomItem,
} from '@/features/services/service-showroom';
import type { ServiceId } from '@/features/services/services-data';
import { getSiteSettings } from '@/features/settings/settings-api';

/** Galleries seen this session, so reopening a service shows its images at once. */
const memory = new Map<ServiceId, ShowroomItem[]>();

type State = {
  serviceId: ServiceId | undefined;
  items: ShowroomItem[];
  /** null until Site Settings has answered (or failed), so a disabled gallery never flashes. */
  enabled: boolean | null;
};

const initialState = (serviceId: ServiceId | undefined): State => ({
  serviceId,
  items: serviceId ? memory.get(serviceId) ?? [] : [],
  enabled: null,
});

/**
 * The service's showroom media and whether its gallery is switched on.
 *
 * Fetched when the service opens, alongside its page content. No device cache:
 * the gallery is supplementary — offline, the section is simply omitted, and
 * the page's text content still renders.
 */
export function useServiceShowroom(serviceId: ServiceId | undefined) {
  const [state, setState] = useState<State>(() => initialState(serviceId));

  useEffect(() => {
    if (!serviceId) return;
    let active = true;

    fetchServiceShowroom(serviceId).then((items) => {
      if (!active || !items) return;
      memory.set(serviceId, items);
      setState((prev) => ({ serviceId, items, enabled: prev.serviceId === serviceId ? prev.enabled : null }));
    });

    // A failed settings request follows the website: the gallery stays on.
    getSiteSettings()
      .then(
        (settings) => settings,
        () => null
      )
      .then((settings) => {
        if (!active) return;
        setState((prev) => ({
          serviceId,
          items: prev.serviceId === serviceId ? prev.items : memory.get(serviceId) ?? [],
          enabled: isShowroomEnabled(settings, serviceId),
        }));
      });

    return () => {
      active = false;
    };
  }, [serviceId]);

  const current = state.serviceId === serviceId ? state : initialState(serviceId);
  return { items: current.items, enabled: current.enabled };
}
