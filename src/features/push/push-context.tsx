import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useAuth } from '@/features/auth/auth-context';
import { registerPushDevice, unregisterPushDevice } from './push-api';
import {
  addNotificationResponseListener,
  getLastNotificationResponse,
  getPushToken,
} from './push-notifications';

/**
 * PUSH REGISTRATION + TAP ROUTING
 *
 * Renders nothing. It exists so the two things that must follow the SESSION —
 * registering a device and reacting to a tap — live in one place rather than
 * being scattered through screens.
 *
 * ── Why registration is keyed on the account ─────────────────────────────
 * A push token belongs to a phone; a registration belongs to a person. When the
 * account changes, the same token has to be re-registered so it points at the
 * new user — otherwise the previous account keeps receiving notifications on a
 * device somebody else is now holding. The backend upsert reassigns ownership,
 * so this side only has to notice that the account changed.
 */

/**
 * The payload a notification carries.
 *
 * Phase 8A only ever sends `test`. The union is written now so Phase 8B adds a
 * member rather than inventing a shape, and so an unknown `type` from a future
 * server is ignored rather than crashing a tap handler.
 */
type PushData =
  | { type: 'test' }
  | { type: 'property_match'; propertyId?: string }
  | { type?: string; [key: string]: unknown };

export function PushProvider({ children }: { children: React.ReactNode }) {
  const { status, token } = useAuth();
  const router = useRouter();

  /**
   * The Expo token this session registered, kept so sign-out can deregister
   * exactly it. Held in a ref rather than state because nothing renders from
   * it and a change must not cause a re-render.
   */
  const registeredTokenRef = useRef<string | null>(null);

  /** Which JWT the current registration was made with. */
  const registeredForTokenRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    /**
     * Signed out: release the device, using the JWT we still hold from the
     * previous session. Ordering matters — once AuthContext clears the token
     * there is nothing left to prove ownership with, so the attempt is made
     * here, on the transition, and simply skipped if it is already too late.
     */
    if (status !== 'authenticated' || !token) {
      const expoToken = registeredTokenRef.current;
      const previousJwt = registeredForTokenRef.current;

      registeredTokenRef.current = null;
      registeredForTokenRef.current = null;

      if (expoToken && previousJwt) {
        // Failure is silently acceptable: the backend also deactivates a token
        // the moment Expo reports it undeliverable, so a missed deregistration
        // self-corrects rather than notifying the wrong person forever.
        unregisterPushDevice(previousJwt, expoToken).catch(() => {});
      }
      return;
    }

    // Same account, already registered — nothing to do. Without this the effect
    // would re-register on every unrelated auth re-render.
    if (registeredForTokenRef.current === token) return;

    const register = async () => {
      const result = await getPushToken();

      if (cancelled || result.type !== 'token') return;

      try {
        await registerPushDevice(token, result.token, result.platform);
        if (cancelled) return;

        registeredTokenRef.current = result.token;
        registeredForTokenRef.current = token;
      } catch {
        /**
         * Push is an enhancement, never a gate. A failed registration must not
         * surface an error over a screen the user opened for another reason,
         * and must not block sign-in — it is simply retried on the next launch.
         */
      }
    };

    register();

    return () => {
      cancelled = true;
    };
  }, [status, token]);

  /**
   * Where a tapped notification goes.
   *
   * Routing happens through Expo Router directly rather than through an HTTPS
   * link: a push tap is already inside the app, so bouncing it out to a URL and
   * back would be slower and would depend on App Links being verified.
   */
  useEffect(() => {
    const handle = (data: PushData | undefined) => {
      if (!data) return;

      // Phase 8B: navigate to the matched property. Guarded on the id so a
      // malformed payload cannot push a route with an undefined param.
      if (data.type === 'property_match' && typeof data.propertyId === 'string') {
        router.push({ pathname: '/properties/[id]', params: { id: data.propertyId } });
        return;
      }

      // 'test' — and any type this build does not recognise — simply opens the
      // app, which the tap has already done.
    };

    /**
     * A tap that LAUNCHED the app from a terminated state is not delivered to
     * the listener below; it is waiting here instead. Checking both is what
     * makes the cold-start case work.
     */
    getLastNotificationResponse()
      .then((response) => handle(response?.notification.request.content.data as PushData))
      .catch(() => {});

    const subscription = addNotificationResponseListener((response) => {
      handle(response.notification.request.content.data as PushData);
    });

    return () => subscription.remove();
  }, [router]);

  return <>{children}</>;
}
