import { API_BASE_URL, REQUEST_TIMEOUT_MS } from '@/constants/config';
import type { ApiErrorResponse } from '@/types/api';

export type ApiErrorKind =
  /** 401 — bad credentials, or an expired/invalid/inactive token. */
  | 'auth'
  /** 400 — validator or business-rule rejection (e.g. email already in use). */
  | 'validation'
  /** 5xx — the backend itself failed. */
  | 'server'
  /** The request never reached the server (offline, DNS, refused). */
  | 'network'
  /** The request was aborted after REQUEST_TIMEOUT_MS. */
  | 'timeout'
  /** Anything we could not classify. */
  | 'unknown';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

/** Maps an HTTP status onto our error kinds. */
function kindForStatus(status: number): ApiErrorKind {
  if (status === 401 || status === 403) return 'auth';
  if (status >= 400 && status < 500) return 'validation';
  if (status >= 500) return 'server';
  return 'unknown';
}

/** User-facing fallback when the body carried no usable message. */
function fallbackMessage(status: number): string {
  if (status === 401) return 'Invalid credentials.';
  if (status === 403) return 'Your account does not have access.';
  if (status === 404) return 'That request could not be found.';
  if (status >= 500) return 'The server had a problem. Please try again shortly.';
  return 'Something went wrong. Please try again.';
}

/**
 * Pulls the most useful human-readable message out of an error body,
 * handling BOTH backend shapes.
 *
 * Never returns a stack trace or raw internal error text.
 */
function extractMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const data = body as ApiErrorResponse;

    // Shape B first — validator errors are more specific than any generic
    // message, and this shape has no `message` field at all.
    if (Array.isArray(data.errors)) {
      const messages = data.errors
        .map((issue) => (typeof issue?.msg === 'string' ? issue.msg.trim() : ''))
        .filter(Boolean);

      // The backend can return several at once (e.g. bad email AND empty
      // password), so show them all rather than making the user fix one,
      // resubmit, and discover the next.
      if (messages.length > 0) return messages.join('\n');
    }

    // Shape A.
    if (typeof data.message === 'string' && data.message.trim()) {
      return data.message.trim();
    }
  }

  return fallbackMessage(status);
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** Serialised as JSON. */
  body?: unknown;
  /** When present, sent as `Authorization: Bearer <token>`. */
  token?: string;
};

/**
 * Performs one API request and returns the parsed JSON body.
 * Throws `ApiError` for every failure mode — never returns a partial result.
 *
 * @param path Path relative to API_BASE_URL, e.g. '/auth/login'.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;

  /**
   * `fetch` has no timeout of its own — without this it can hang indefinitely
   * on a dead network. AbortController is the standard way to add one.
   */
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    // A rejected fetch means the request never got a response at all. The two
    // cases are indistinguishable except by the abort flag.
    if (controller.signal.aborted) {
      throw new ApiError(
        'timeout',
        'The server took too long to respond. It may be waking up — please try again.'
      );
    }
    throw new ApiError(
      'network',
      'Cannot reach the server. Check your internet connection and try again.'
    );
  } finally {
    clearTimeout(timeoutId);
  }

  /**
   * Parse defensively. A healthy backend returns JSON, but an infrastructure
   * failure (Render 502/503, a proxy error page) returns HTML, and calling
   * .json() on that throws a parse error that would otherwise surface as a
   * confusing 'unknown' failure.
   */
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
      response.status
    );
  }

  return payload as T;
}
