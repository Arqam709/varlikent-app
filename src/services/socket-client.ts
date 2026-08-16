import { io, type Socket } from 'socket.io-client';

import { API_BASE_URL } from '@/constants/config';

/**
 * The app's Socket.IO connection.
 *
 * ── What this is for ────────────────────────────────────────────────────
 * A server → client notification channel. REST stays the authoritative API:
 * loading conversations, loading messages, sending and marking read all still
 * go through services/api-client.ts exactly as before, and MongoDB remains the
 * source of truth. Phase RT-0 opens the connection and nothing more — no events
 * are sent or received yet.
 *
 * ── Expo compatibility ──────────────────────────────────────────────────
 * socket.io-client is pure JavaScript and rides on React Native's built-in
 * global WebSocket. There is no native module, so this works in Expo Go, in a
 * development build and in a production build identically — no prebuild, no
 * config plugin, no ejecting.
 */

/**
 * Turns the REST base URL into the Socket.IO origin.
 *
 *   https://varli-kent-backend.onrender.com/api  →  https://varli-kent-backend.onrender.com
 *   http://192.168.100.200:5000/api              →  http://192.168.100.200:5000
 *   http://192.168.100.200:5000/api/             →  http://192.168.100.200:5000
 *
 * Derived from the ONE existing configuration value (API_BASE_URL, which is
 * already switchable via EXPO_PUBLIC_API_URL) rather than adding a second
 * environment variable. Two URLs pointing at the same backend is two things to
 * keep in step, and one of them eventually goes stale — most painfully when
 * someone switches to a LAN backend and only remembers to change one.
 *
 * ── Why this regex and not .replace('/api', '') ─────────────────────────
 * A bare replace rewrites the FIRST match anywhere in the string, which would
 * turn https://api.varlikent.com/api into https://.varlikent.com/api. The `$`
 * anchor makes it strictly the trailing segment, so only a real `/api` suffix
 * is removed and a host that merely contains those letters is untouched.
 */
export function socketOrigin(baseUrl: string = API_BASE_URL): string {
  return baseUrl.replace(/\/api\/?$/, '');
}

/**
 * Opens an authenticated socket.
 *
 * ── Never write ws:// or wss:// ─────────────────────────────────────────
 * The URL passed in is http(s) and socket.io-client derives the WebSocket
 * scheme itself — https upgrades to wss, http to ws. Hardcoding either breaks
 * one of the two environments.
 *
 * ── Why the token goes in `auth` ────────────────────────────────────────
 * `auth` travels in the Socket.IO handshake payload. A query string would write
 * a seven-day credential into Render's access logs and every proxy log along
 * the way. The backend reads `socket.handshake.auth.token` and nothing else —
 * it never accepts a user id from the client.
 */
export function createSocket(token: string): Socket {
  return io(socketOrigin(), {
    auth: { token },

    /*
     * Skip the HTTP long-polling handshake and open a WebSocket directly.
     *
     * The browser keeps the default polling→upgrade path because corporate
     * proxies sometimes block raw upgrades. React Native has no such proxy to
     * accommodate: it always has a working global WebSocket, while its XHR
     * implementation makes the polling handshake both slower and less reliable.
     * Pinning the transport removes a round trip and a failure mode.
     */
    transports: ['websocket'],

    /*
     * Reconnection applies to a connection that was established and then
     * dropped — leaving Wi-Fi, or the Render free instance going to sleep.
     * A handshake REJECTED by the auth middleware is not retried, which is
     * correct: an invalid token will not become valid by asking again.
     *
     * RT-0 deliberately does NOT recover missed messages on reconnect. That is
     * RT-3, and it belongs with the screens that own the message state.
     */
    reconnection: true,
  });
}
