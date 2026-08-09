/**
 * The shape of a Varlikent user, as returned by the backend.
 *
 * Taken directly from the verified Step 0 audit of the real backend code.
 * These are TypeScript types only — they are erased at build time and produce
 * no JavaScript. Writing them down now means the editor can autocomplete and
 * type-check every screen we build from Step 2 onwards.
 */

/** Which login method created the account. */
export type AuthProvider = 'local' | 'google' | 'microsoft';

/**
 * The user object returned by `/auth/login`, `/auth/register` and `/auth/me`.
 *
 * NOTE: MongoDB uses `_id`, not `id`. This trips people up coming from other
 * backends, so we mirror the real field name rather than renaming it.
 */
export interface User {
  _id: string;
  name: string;
  email: string;
  provider: AuthProvider;
  role: string;
  permissions: string[];
  avatar?: string;
  themePreference?: string;
  favourites?: string[];
  isActive: boolean;
  createdAt: string;
}

/**
 * The subset of the user we are willing to keep on the device.
 *
 * Why this exists: the Step 0 audit found that `/auth/me` can currently
 * include `resetPasswordToken` / `resetPasswordExpires`, because the backend's
 * `protect` middleware only excludes `password`. We must not blindly persist
 * the whole response to storage. When we implement session restore (Step 8),
 * we will map the response down to these fields.
 *
 * This is a client-side safeguard, not a fix. The real fix is server-side and
 * is deliberately out of scope for now.
 */
export type SafeUser = Pick<
  User,
  | '_id'
  | 'name'
  | 'email'
  | 'provider'
  | 'role'
  | 'permissions'
  | 'avatar'
  | 'themePreference'
  | 'isActive'
>;
