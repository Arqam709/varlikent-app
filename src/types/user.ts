/**
 * The shape of a Varlikent user, as returned by the backend.
 *
 * Taken directly from the verified Step 0 audit of the real backend code.
 * These are TypeScript types only — they are erased at build time and produce
 * no JavaScript. Writing them down now means the editor can autocomplete and
 * type-check every screen we build from Step 2 onwards.
 */

/** Which login method created the account. Mirrors the backend enum. */
export type AuthProvider = 'local' | 'google' | 'microsoft' | 'apple';

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
 * The ONLY user shape allowed into React state.
 *
 * Why this exists — confirmed by reading the real backend:
 *
 *   `/auth/login` and `/auth/register` run the response through `safeUser()`
 *   (backend/routes/auth.js:16), which deletes password, resetPasswordToken
 *   and resetPasswordExpires.
 *
 *   `/auth/me` does NOT. It returns `req.user` straight from the `protect`
 *   middleware, which only does `.select('-password')`
 *   (backend/middleware/auth.js:13). So a user with a password reset in
 *   progress has their resetPasswordToken and resetPasswordExpires in that
 *   response.
 *
 * The two endpoints therefore return DIFFERENT shapes, and the mobile app must
 * not trust either blindly. `sanitizeUser()` in features/auth maps both down
 * to exactly these fields.
 *
 * Also excluded: googleId / microsoftId / appleId — internal identity linkage
 * the UI has no use for.
 *
 * This is a client-side safeguard, not a fix. The server-side fix would be to
 * use `safeUser()` in `/auth/me` too, and is out of scope.
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
  | 'favourites'
  | 'isActive'
  | 'createdAt'
>;
