/**
 * App-wide configuration.
 *
 * Everything environment-specific lives here so that exactly one file has to
 * change when we switch between a local backend and the deployed Render
 * backend. Nothing in this file performs a network request — it only holds
 * values.
 *
 * Web equivalent: your `import.meta.env.VITE_API_URL` / `.env` file.
 */

/** Used when no `.env` is present, so a fresh clone runs with no setup. */
const DEFAULT_API_BASE_URL = 'https://varli-kent-backend.onrender.com/api';

/**
 * Base URL of the Varlikent backend, INCLUDING the `/api` prefix.
 * The backend mounts every auth endpoint under `/api/auth/...`
 * (backend/server.js), so `${API_BASE_URL}/auth/login` resolves correctly.
 *
 * ── How EXPO_PUBLIC_* works ──────────────────────────────────────────────
 * Expo CLI loads `.env`, then Metro INLINES the literal value at build time —
 * it textually replaces `process.env.EXPO_PUBLIC_API_URL` with the string
 * before the bundle ships. Three consequences follow:
 *
 *   1. It must be written in dot notation exactly as below. Dynamic access
 *      like process.env['EXPO_PUBLIC_' + name] is NOT replaced and yields
 *      undefined.
 *   2. Editing .env needs a full app reload to take effect (and often
 *      `npx expo start --clear`), because the old value is already baked in.
 *   3. The value ends up in the shipped bundle IN PLAIN TEXT. So it is only
 *      ever appropriate for public configuration. A public API URL qualifies;
 *      a JWT secret or database URI never would.
 *
 * ── Switching to a local backend ─────────────────────────────────────────
 * Set EXPO_PUBLIC_API_URL in .env to http://192.168.100.200:5000/api
 * (phone and PC on the same Wi-Fi, Windows Firewall allowing Node). Note that
 * `localhost` can never work from a physical phone — it resolves to the phone.
 * ─────────────────────────────────────────────────────────────────────────
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_BASE_URL;

/**
 * How long to wait before giving up on a request, in milliseconds.
 *
 * Raised from 30s to 60s deliberately. The backend is deployed on Render, and
 * a service that has spun down after inactivity typically takes 30-50 seconds
 * to answer its first request. At a 30s ceiling we would abort during exactly
 * that cold start and report a timeout for a request that was about to
 * succeed — the most confusing possible failure on a first login.
 *
 * The cost is that a genuinely unreachable server takes longer to report. That
 * is acceptable because the submit button shows a loading state throughout, so
 * the user always sees that work is in progress. (A warm response measured
 * ~0.7s, so this ceiling is only ever reached in the cold-start case.)
 */
export const REQUEST_TIMEOUT_MS = 60_000;

/**
 * The key the JWT will be stored under on the device.
 *
 * Declared here (rather than typed as a string literal in several places)
 * so a typo can never cause "saved under one key, read from another".
 * Nothing reads or writes it yet — that is Step 5.
 */
export const AUTH_TOKEN_KEY = 'varlikent_auth_token';

/**
 * The Varlikent WEB/SERVER Google OAuth client ID.
 *
 * ── Why the WEB client, on an Android app ────────────────────────────────
 * This is the counter-intuitive part of native Google Sign-In, and getting it
 * wrong is the single most common way the flow fails. There are two Google
 * OAuth clients involved on Android and they do different jobs:
 *
 *   Android client  binds `com.varlikent.app` + the signing SHA-1. It is how
 *                   Google recognises the installed app as legitimate. It is
 *                   never named in code and never sent anywhere.
 *   Web/server      the audience the ID token is minted FOR. Passing it as
 *                   Nitro's `webClientId` is what makes Google set `aud` to
 *                   this value — which is exactly the client the backend
 *                   already trusts as GOOGLE_CLIENT_ID for the website.
 *
 * So the mobile app deliberately reuses the website's client ID here. That is
 * what lets one backend allowlist serve both, with no per-platform entry.
 * Putting the ANDROID client ID here instead produces a DEVELOPER_ERROR from
 * the native SDK.
 *
 * Public by nature — the website already serves the same value to every
 * visitor — so EXPO_PUBLIC_ is appropriate despite Metro inlining it in clear
 * text. There is deliberately NO fallback default: a wrong-but-present client
 * ID would fail deep inside Google's SDK, whereas an empty one is caught up
 * front by the sign-in wrapper and reported as a configuration problem.
 */
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
