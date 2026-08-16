import type { AuthProvider, SafeUser } from '@/types/user';

/**
 * RUNTIME USER SANITISATION
 *
 * TypeScript types are erased at build time — they describe what we EXPECT,
 * they do not filter anything at runtime. Assigning a `/auth/me` response to a
 * `SafeUser`-typed variable would keep every extra field, including
 * `resetPasswordToken`, sitting in React state.
 *
 * This function is the runtime counterpart: it copies across a fixed whitelist
 * and drops everything else. Anything the backend adds later — including new
 * sensitive fields — is excluded by default rather than included by default.
 *
 * Needed because the two endpoints disagree:
 *   /auth/login, /auth/register → already sanitised by safeUser() server-side
 *   /auth/me                    → only `password` removed; reset-token fields
 *                                 can still be present
 */

const KNOWN_PROVIDERS: AuthProvider[] = ['local', 'google', 'microsoft', 'apple'];

/** Reads a string property, returning a fallback if it is missing or wrong-typed. */
function str(source: Record<string, unknown>, key: string, fallback = ''): string {
  const value = source[key];
  return typeof value === 'string' ? value : fallback;
}

/** Reads an array of strings, dropping any non-string entries. */
function strArray(source: Record<string, unknown>, key: string): string[] {
  const value = source[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

/**
 * Maps any backend user payload down to exactly the fields we allow on-device.
 *
 * @throws if the payload is not an object or has no `_id` — a user we cannot
 *         identify is not a user we should treat as signed in.
 */
export function sanitizeUser(raw: unknown): SafeUser {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Unexpected user payload from the server.');
  }

  const source = raw as Record<string, unknown>;
  const id = str(source, '_id');
  if (!id) {
    throw new Error('Unexpected user payload from the server.');
  }

  const provider = str(source, 'provider', 'local') as AuthProvider;

  return {
    _id: id,
    name: str(source, 'name'),
    email: str(source, 'email'),
    // Fall back rather than trust an unrecognised value from the wire.
    provider: KNOWN_PROVIDERS.includes(provider) ? provider : 'local',
    role: str(source, 'role', 'user'),
    permissions: strArray(source, 'permissions'),
    avatar: str(source, 'avatar'),
    themePreference: str(source, 'themePreference', 'default'),
    favourites: strArray(source, 'favourites'),
    // Default to true: the backend only lets inactive users past /login, and
    // every protected route rejects them anyway.
    isActive: typeof source.isActive === 'boolean' ? source.isActive : true,
    createdAt: str(source, 'createdAt'),
  };

  // NOT copied, deliberately: password, resetPasswordToken,
  // resetPasswordExpires, googleId, microsoftId, appleId, __v.
}
