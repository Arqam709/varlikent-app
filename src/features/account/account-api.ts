import type { SharedThemeId } from '@/features/theme/theme-contract';
import { apiRequest } from '@/services/api-client';
import { apiUpload, appendFile, type UploadFile } from '@/services/api-upload';
import type { SafeUser } from '@/types/user';


type UserResponse = { success: true; user: unknown };

export async function updateProfile(
  token: string,
  input: { name: string; email: string }
): Promise<unknown> {
  const response = await apiRequest<UserResponse>('/users/me/profile', {
    method: 'PUT',
    token,
    body: { name: input.name, email: input.email },
  });
  return response.user;
}

export async function updatePassword(
  token: string,
  input: { currentPassword: string; newPassword: string; confirmPassword: string }
): Promise<void> {
  await apiRequest('/users/me/password', { method: 'PUT', token, body: input });
}

/**
 * Stores the account's theme preference.
 *
 * Typed to `SharedThemeId`, not `string`: the endpoint validates against the
 * canonical eight and returns 400 for anything else, so a local-only mobile id
 * reaching here is a bug that should be caught at compile time rather than
 * swallowed at runtime. Translate with `toSharedThemeId` before calling.
 */
export async function updateThemePreference(
  token: string,
  theme: SharedThemeId
): Promise<void> {
  await apiRequest('/users/me/theme', { method: 'PUT', token, body: { theme } });
}

export async function uploadAvatar(
  token: string,
  file: UploadFile
): Promise<unknown> {
  const form = new FormData();
  // The field name must be "avatar" — that is what `upload.single('avatar')`
  // looks for, and any other name arrives as "No image provided".
  appendFile(form, 'avatar', file);

  // The shared upload path: Bearer token, 90 s timeout, defensive parsing and
  // the same ApiError mapping as every other request.
  const response = await apiUpload<UserResponse | null>('/users/me/avatar', { method: 'PUT', token, form });
  return response?.user;
}

/** The support address for account deletion, taken from the website's own copy. */
export const SUPPORT_EMAIL = 'info@varlikent.com';

/** Two-letter initials for the avatar fallback. Never renders empty. */
export function initialsOf(name: string, email: string): string {
  const fromName = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  if (fromName) return fromName;
  return email.trim().charAt(0).toUpperCase() || 'V';
}

/** Whether this account can change a Varlikent password at all. See password screen. */
export function hasLocalPassword(user: Pick<SafeUser, 'provider'> | null): boolean {
  return (user?.provider ?? 'local') === 'local';
}
