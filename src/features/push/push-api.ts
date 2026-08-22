import { apiRequest } from '@/services/api-client';
import type { MessageResponse } from '@/types/api';

/**
 * Device registration against the Varlikent backend.
 *
 * The backend is the durable record of which devices belong to which account —
 * nothing about registration is cached on the phone, because the phone is not
 * the thing doing the sending.
 */

/** `POST`/`DELETE /push/devices` reply. Only a success flag is returned. */
type PushDeviceResponse = Pick<MessageResponse, 'success'>;

/**
 * Registers this installation for push.
 *
 * Idempotent server-side (upsert keyed on the token), so calling it on every
 * authenticated launch is the intended usage rather than something to guard
 * against. That repetition is also what keeps `lastSeenAt` meaningful and what
 * re-activates a device after a sign-out.
 */
export function registerPushDevice(
  token: string,
  expoPushToken: string,
  platform: 'android' | 'ios'
): Promise<PushDeviceResponse> {
  return apiRequest<PushDeviceResponse>('/push/devices', {
    method: 'POST',
    token,
    body: { token: expoPushToken, platform },
  });
}

/**
 * Stops notifications for this installation.
 *
 * Called while the user is still authenticated — it needs their JWT to prove
 * ownership, so it must run BEFORE the session is cleared on sign-out.
 */
export function unregisterPushDevice(
  token: string,
  expoPushToken: string
): Promise<PushDeviceResponse> {
  return apiRequest<PushDeviceResponse>('/push/devices', {
    method: 'DELETE',
    token,
    body: { token: expoPushToken },
  });
}

/**
 * Sends a test notification to this account's own devices.
 *
 * Takes no recipient: the backend targets `req.user` and nothing else.
 */
export function sendTestPush(token: string): Promise<{
  success: true;
  attempted: number;
  accepted: number;
  failed: number;
}> {
  return apiRequest('/push/test', { method: 'POST', token });
}
