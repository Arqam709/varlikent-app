import { apiRequest } from '@/services/api-client';
import { propertyTypeKey } from '@/utils/property-labels';
import type {
  PropertyAlert,
  PropertyAlertInput,
  PropertyAlertResponse,
  PropertyAlertsResponse,
} from '@/types/property-alert';

/**
 * SAVED PROPERTY ALERT ENDPOINTS
 *
 * Pure network layer. Every call needs a token — alerts are per-user and the
 * backend scopes each query by the authenticated id, so there is no userId to
 * pass and none is accepted.
 */

/** GET /api/property-alerts → this user's alerts, newest first. */
export async function getPropertyAlerts(token: string): Promise<PropertyAlert[]> {
  const response = await apiRequest<PropertyAlertsResponse>('/property-alerts', { token });
  return Array.isArray(response?.alerts) ? response.alerts : [];
}

/** POST /api/property-alerts → 201 with the created alert. */
export async function createPropertyAlert(
  token: string,
  input: PropertyAlertInput
): Promise<PropertyAlert> {
  const response = await apiRequest<PropertyAlertResponse>('/property-alerts', {
    method: 'POST',
    token,
    body: input,
  });
  return response.alert;
}

/**
 * PATCH /api/property-alerts/:id
 *
 * Send the COMPLETE set of criteria. Anything omitted is cleared server-side,
 * so removing a filter genuinely widens the alert instead of silently keeping
 * the old value.
 */
export async function updatePropertyAlert(
  token: string,
  id: string,
  input: PropertyAlertInput
): Promise<PropertyAlert> {
  const response = await apiRequest<PropertyAlertResponse>(`/property-alerts/${id}`, {
    method: 'PATCH',
    token,
    body: input,
  });
  return response.alert;
}

/** DELETE /api/property-alerts/:id — 404 if it is not this user's alert. */
export async function deletePropertyAlert(token: string, id: string): Promise<void> {
  await apiRequest(`/property-alerts/${id}`, { method: 'DELETE', token });
}

/**
 * Builds the human label for an alert, e.g. "Apartments for Sale in Sarıyer".
 *
 * Derived rather than stored: a saved name would duplicate the criteria and
 * go stale the moment someone edits the alert without renaming it.
 */
type Translate = (key: string, vars?: Record<string, string>) => string;

export function describeAlert(alert: PropertyAlert, t: Translate): string {
  const type = alert.propertyType
    ? t(propertyTypeKey(alert.propertyType))
    : t('properties.title');
  const intent =
    alert.listingType === 'Rent'
      ? t('alerts.summaryRent', { type })
      : alert.listingType === 'Sale'
        ? t('alerts.summarySale', { type })
        : type;

  return alert.district
    ? t('alerts.summaryDistrict', { summary: intent, district: alert.district })
    : intent;
}
