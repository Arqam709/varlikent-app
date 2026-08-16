/**
 * Shapes shared by every Varlikent API response.
 *
 * The backend always wraps responses in a `success` flag, so we describe that
 * envelope once here instead of re-typing it in every service function.
 */

import type { User } from './user';

/**
 * One entry from express-validator's error array.
 * Verified live: {"type":"field","value":"...","msg":"Valid email is required",
 *                 "path":"email","location":"body"}
 */
export interface ApiValidationIssue {
  msg: string;
  path?: string;
  type?: string;
  location?: string;
}

/**
 * Failures come back in TWO different shapes — confirmed against the deployed
 * backend, not assumed:
 *
 *   A) { success: false, message: "Invalid credentials" }        (401, 400)
 *   B) { success: false, errors: [ { msg: "..." }, ... ] }       (400 validator)
 *
 * Shape B has NO `message` field, so a client that only reads `.message` shows
 * a generic fallback for every validation failure. `api-client.ts` reads both.
 */
export interface ApiErrorResponse {
  success: false;
  message?: string;
  errors?: ApiValidationIssue[];
}

/** Returned by `POST /auth/login` (200) and `POST /auth/register` (201). */
export interface AuthResponse {
  success: true;
  token: string;
  user: User;
}

/** Returned by `GET /auth/me`. Note: no token — the client already has it. */
export interface MeResponse {
  success: true;
  user: User;
}

/**
 * Returned by `POST /auth/forgot-password` and `POST /auth/reset-password`.
 *
 * Forgot-password intentionally always returns the same generic message,
 * so an attacker cannot use it to discover which emails have accounts.
 * Reset-password does NOT return a JWT — the user must log in again.
 */
export interface MessageResponse {
  success: true;
  message: string;
}
