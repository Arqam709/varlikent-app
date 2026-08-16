import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';

import { useAuth } from '@/features/auth/auth-context';
import { createSocket } from '@/services/socket-client';

/**
 * ONE authenticated socket per running app session.
 *
 * ── Why a provider and not a socket per screen ──────────────────────────
 * Both the Chats tab and an open conversation want live updates, and Expo
 * Router mounts and unmounts those screens constantly as the customer
 * navigates. A socket owned by a screen would be rebuilt on every navigation —
 * dropping events during the gap, and disconnecting exactly when the customer
 * backs out to Chats and most needs the list to be current. Session-scoped, it
 * survives all of it.
 *
 * ── Lifecycle ───────────────────────────────────────────────────────────
 *   sign in / session restored  → status 'authenticated' + token → connect
 *   sign out                    → token cleared                  → disconnect
 *   token changes               → old socket discarded, new one opened
 *
 * AuthContext.logout() sets both `token` to null and `status` to
 * 'unauthenticated', so disconnection needs no cooperation from the logout
 * path — it falls out of this effect's dependency array.
 *
 * ── Deliberately NOT here ───────────────────────────────────────────────
 * No AppState handling and no refetch-on-reconnect. Recovering messages missed
 * while the phone was asleep is Phase RT-3 and belongs with the screens that
 * own the message state. RT-0 is connection infrastructure only.
 */

type RealtimeContextValue = {
  /** The live socket, or null when signed out. Read at subscription time. */
  socket: React.RefObject<Socket | null>;
  isConnected: boolean;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { token, status } = useAuth();

  const [isConnected, setIsConnected] = useState(false);

  // A ref, not state: consumers must not re-render every time the socket's
  // internals change. Only `isConnected` is render-relevant.
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // `status` is checked as well as `token` because AuthProvider starts at
    // 'loading' while it reads SecureStore — connecting before the session is
    // resolved would open a socket the app may be about to discard.
    if (status !== 'authenticated' || !token) {
      return undefined;
    }

    const socket = createSocket(token);
    socketRef.current = socket;

    const onConnect = () => {
      setIsConnected(true);
      if (__DEV__) console.log('[realtime] connected');
    };

    const onDisconnect = (reason: string) => {
      setIsConnected(false);
      if (__DEV__) console.log('[realtime] disconnected:', reason);
    };

    const onConnectError = (error: Error) => {
      setIsConnected(false);
      // Expected and harmless when the Render free instance is asleep, when the
      // phone is offline, or when a token has expired. Never fatal: every
      // screen still works over REST exactly as it does today.
      if (__DEV__) console.log('[realtime] connection error:', error.message);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      // disconnect() rather than close(): it also cancels any pending
      // reconnection timer, so a signed-out session cannot quietly come back
      // with a stale token.
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [token, status]);

  const value = useMemo<RealtimeContextValue>(
    () => ({ socket: socketRef, isConnected }),
    [isConnected]
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

/**
 * Reads the realtime state.
 *
 * Returns null outside the provider rather than throwing, unlike useAuth. The
 * realtime layer is an enhancement — a screen that renders perfectly well
 * without live updates should never crash because of where it was mounted.
 */
export function useRealtime(): RealtimeContextValue | null {
  return useContext(RealtimeContext);
}
