import { API_BASE_URL } from '@/constants/config';
import { ApiError, extractErrorCode, extractMessage, kindForStatus } from '@/services/api-client';

/**
 * AUTHENTICATED MULTIPART UPLOADS — the one low-level path for sending a file.
 *
 * `apiRequest` only sends JSON. Files go through here instead, and every
 * upload (profile photo, room photo) shares the same behaviour:
 *
 *   - `Authorization: Bearer <token>`, and no Content-Type header of our own:
 *     fetch must write the multipart boundary itself, or the backend cannot
 *     parse the body
 *   - a longer timeout than JSON requests, because photos travel over mobile
 *     data and the backend then stores them before answering
 *   - the same defensive parsing and `ApiError` mapping as `apiRequest`,
 *     including the backend's machine-readable `code` when it sends one
 */

/** The shape React Native's FormData accepts for a local file. */
export type UploadFile = { uri: string; name: string; type: string };

type UploadOptions = {
  method?: 'POST' | 'PUT';
  token: string;
  form: FormData;
  /** Defaults to 90 s: long enough for a photo on a slow connection plus a Render cold start. */
  timeoutMs?: number;
  /** Shown when the timeout is reached. */
  timeoutMessage?: string;
};

export const UPLOAD_TIMEOUT_MS = 90_000;

export async function apiUpload<T>(path: string, options: UploadOptions): Promise<T> {
  const {
    method = 'POST',
    token,
    form,
    timeoutMs = UPLOAD_TIMEOUT_MS,
    timeoutMessage = 'The upload took too long. Please try again.',
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      body: form,
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) throw new ApiError('timeout', timeoutMessage);
    throw new ApiError('network', 'Cannot reach the server. Check your connection and try again.');
  } finally {
    clearTimeout(timeoutId);
  }

  // Defensive parse: an infrastructure failure answers with HTML, not JSON.
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
    throw new ApiError(
      kindForStatus(response.status),
      extractMessage(payload, response.status),
      response.status,
      extractErrorCode(payload)
    );
  }

  return payload as T;
}

/** Appends a local file the way React Native's FormData expects it. */
export function appendFile(form: FormData, field: string, file: UploadFile): void {
  form.append(field, file as unknown as Blob);
}
