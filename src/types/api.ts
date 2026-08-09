/**
 * Shapes shared by every Varlikent API response.
 *
 * The backend always wraps responses in a `success` flag, so we describe that
 * envelope once here instead of re-typing it in every service function.
 */

import type { User } from './user';

/** Every failed response looks like this. */
export interface ApiErrorResponse {
  success: false;
  message: string;
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
