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

/**
 * `__DEV__` is a global that React Native injects automatically.
 * It is `true` when running through Metro (Expo Go, dev builds) and `false`
 * in a production build. It is the mobile equivalent of `import.meta.env.DEV`.
 */

/**
 * Base URL of the Varlikent backend, INCLUDING the `/api` prefix.
 *
 * The verified backend contract puts every auth endpoint under `/api/auth/...`,
 * so `${API_BASE_URL}/auth/login` resolves correctly.
 *
 * ────────────────────────────────────────────────────────────────────────
 * IMPORTANT — why this is still a placeholder:
 *
 * `http://localhost:5000/api` is the website's dev fallback, and it works
 * there because the browser and the server run on the same machine.
 *
 * On a physical phone running Expo Go, `localhost` means THE PHONE ITSELF.
 * It will never reach your PC. When we get to Step 4 we will replace the dev
 * value with either:
 *
 *   1. your PC's LAN IP, e.g. 'http://192.168.1.34:5000/api'
 *      (phone and PC on the same Wi-Fi, Windows Firewall allowing Node)
 *   2. the deployed Render URL, e.g. 'https://<your-api>.onrender.com/api'
 *
 * TODO(step 4): fill both of these in.
 * ────────────────────────────────────────────────────────────────────────
 */
const DEV_API_BASE_URL = 'http://localhost:5000/api';
const PROD_API_BASE_URL = 'https://REPLACE-ME.onrender.com/api';

export const API_BASE_URL = __DEV__ ? DEV_API_BASE_URL : PROD_API_BASE_URL;

/**
 * How long to wait before giving up on a request, in milliseconds.
 *
 * Mobile networks are slower and less reliable than a desktop browser, and
 * Render's free tier sleeps after inactivity — the first request after a
 * cold start can take 30-50 seconds. A generous timeout avoids showing an
 * error for a request that would have succeeded.
 */
export const REQUEST_TIMEOUT_MS = 30_000;

/**
 * The key the JWT will be stored under on the device.
 *
 * Declared here (rather than typed as a string literal in several places)
 * so a typo can never cause "saved under one key, read from another".
 * Nothing reads or writes it yet — that is Step 5.
 */
export const AUTH_TOKEN_KEY = 'varlikent_auth_token';
