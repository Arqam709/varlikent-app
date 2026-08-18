import { API_BASE_URL } from '@/constants/config';
import { ApiError, apiRequest } from '@/services/api-client';
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

export async function updateThemePreference(token: string, theme: string): Promise<void> {
  await apiRequest('/users/me/theme', { method: 'PUT', token, body: { theme } });
}

export async function uploadAvatar(
  token: string,
  file: { uri: string; name: string; type: string }
): Promise<unknown> {
  const form = new FormData();
  // The field name must be "avatar" — that is what `upload.single('avatar')`
  // looks for, and any other name arrives as "No image provided".
  form.append('avatar', file as unknown as Blob);

  const controller = new AbortController();
  // Longer than the standard request timeout: this uploads an image over mobile
  // data and then waits for Cloudinary, so the usual ceiling is too tight.
  const timeoutId = setTimeout(() => controller.abort(), 90_000);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/users/me/avatar`, {
      method: 'PUT',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      body: form,
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      throw new ApiError('timeout', 'The upload took too long. Please try again.');
    }
    throw new ApiError('network', 'Cannot reach the server. Check your connection and try again.');
  } finally {
    clearTimeout(timeoutId);
  }

  // Defensive parse, matching api-client: an infrastructure failure returns HTML,
  // and calling .json() on that throws a confusing parse error instead of a
  // useful message.
  let payload: unknown = null;
  const raw = await response.text();
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && typeof (payload as { message?: unknown }).message === 'string'
        ? ((payload as { message: string }).message)
        : 'Your photo could not be uploaded.';
    throw new ApiError(
      response.status === 401 || response.status === 403 ? 'auth' : response.status >= 500 ? 'server' : 'validation',
      message,
      response.status
    );
  }

  return (payload as UserResponse | null)?.user;
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
