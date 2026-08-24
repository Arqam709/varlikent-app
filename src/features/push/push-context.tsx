import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useAuth } from '@/features/auth/auth-context';
import {
  detachPushDevice,
  registerAnonymousPushDevice,
  registerPushDevice,
} from './push-api';
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
 * A push token belongs to an installation and remains useful while signed out.
 * Its optional backend user association is what enables PERSONAL pushes. Auth
 * changes therefore update ownership without regenerating the Expo token.
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
  | { type: 'message'; conversationId?: string; propertyId?: string }
  | { type: 'new_property'; propertyId?: string }
  | { type: 'property_match'; propertyId?: string }
  | { type?: string; [key: string]: unknown };

export function PushProvider({ children }: { children: React.ReactNode }) {
  const { status, token } = useAuth();
  const router = useRouter();

  /** One native-token read per app process; auth changes reuse this value. */
  const deviceRef = useRef<{
    token: string;
    platform: 'android' | 'ios';
  } | null>(null);

  /**
   * JWTs that may own the token server-side.
   *
   * A request can reach the server and then lose its response. Keeping every
   * attempted association lets logout detach whichever account actually won,
   * without accepting an unsafe unauthenticated detach endpoint.
   */
  const associationJwtCandidatesRef = useRef(new Set<string>());

  /** Serializes auth transitions so an old login cannot finish after logout. */
  const syncQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    // Session restoration must finish before deciding whether this is an
    // anonymous or account-linked registration.
    if (status === 'loading') return;

    const requestedStatus = status;
    const requestedJwt = token;

    syncQueueRef.current = syncQueueRef.current
      .catch(() => {})
      .then(async () => {
        let device = deviceRef.current;
        if (!device) {
          const result = await getPushToken();
          if (result.type !== 'token') return;
          device = { token: result.token, platform: result.platform };
          deviceRef.current = device;
        }

        if (requestedStatus === 'authenticated' && requestedJwt) {
          associationJwtCandidatesRef.current.add(requestedJwt);
          await registerPushDevice(requestedJwt, device.token, device.platform);
          return;
        }

        // Queue ordering guarantees every prior association attempt has
        // settled before detach starts. The JWT value is retained in this ref
        // even though AuthContext has already removed it from SecureStore.
        for (const jwt of [...associationJwtCandidatesRef.current]) {
          try {
            await detachPushDevice(jwt, device.token);
            associationJwtCandidatesRef.current.delete(jwt);
          } catch {
            // Keep the candidate for a later auth transition. Push lifecycle
            // failures never block logout or make the app unusable.
          }
        }

        await registerAnonymousPushDevice(device.token, device.platform);
      })
      .catch(() => {
        // Push is an enhancement, never a gate for startup, login or logout.
      });
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

      /**
       * A reply from the agent opens the exact thread.
       *
       * Guarded on the id: a payload missing or mistyping conversationId is
       * ignored rather than pushing a route with an undefined param, which
       * would land on a screen that can only fail. The conversation screen
       * still authorises the id against the session — a notification is a
       * routing hint, never a grant.
       */
      if (data.type === 'message' && typeof data.conversationId === 'string') {
        router.push({ pathname: '/messages/[id]', params: { id: data.conversationId } });
        return;
      }

      // Phase 8C: navigate to the matched property. Guarded on the id so a
      // malformed payload cannot push a route with an undefined param.
      /**
       * A newly listed property, and a saved-alert match, open the same screen.
       * They are separate types because the notifications READ differently —
       * one says a listing appeared, the other says it matches a saved search —
       * and 8C.2 needs to tell them apart when deciding who gets which.
       */
      if (
        (data.type === 'new_property' || data.type === 'property_match') &&
        typeof data.propertyId === 'string'
      ) {
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
