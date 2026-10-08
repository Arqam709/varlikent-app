import { API_BASE_URL } from '@/constants/config';
import {
  serviceRequestFromServer,
  type ServiceRequest,
} from '@/features/service-requests/service-request';
import { ApiError, apiRequest } from '@/services/api-client';
import { apiUpload, appendFile, type UploadFile } from '@/services/api-upload';

type RequestResponse = { success: boolean; request?: unknown; duplicate?: boolean };
type RequestsResponse = { success: boolean; requests?: unknown[] };

const requestOrThrow = (response: RequestResponse | null | undefined): ServiceRequest => {
  const request = serviceRequestFromServer(response?.request);
  if (!request) throw new ApiError('unknown', 'The server returned an unreadable request.');
  return request;
};

/**
 * POST /api/service-requests.
 *
 * ONE call carries the details and every photo, so there are no temporary
 * uploads for the server to clean up if the customer abandons the form. With
 * no photos it is plain JSON; with photos it is multipart (`payload` + `photos`).
 *
 * The payload carries an idempotency key: resending the same attempt after a
 * lost response returns the request already created, not a second one.
 */
export async function submitServiceRequest(
  token: string,
  payload: Record<string, unknown>,
  photos: readonly UploadFile[]
): Promise<ServiceRequest> {
  if (photos.length === 0) {
    return requestOrThrow(
      await apiRequest<RequestResponse>('/service-requests', { method: 'POST', token, body: payload })
    );
  }

  const form = new FormData();
  form.append('payload', JSON.stringify(payload));
  photos.forEach((photo, index) => appendFile(form, 'photos', { ...photo, name: `photo-${index + 1}.jpg` }));
  return requestOrThrow(await apiUpload<RequestResponse>('/service-requests', { token, form }));
}

/** GET /api/service-requests — the caller's own requests, newest first. */
export async function fetchServiceRequests(token: string): Promise<ServiceRequest[]> {
  const response = await apiRequest<RequestsResponse>('/service-requests', { token });
  if (!Array.isArray(response?.requests)) {
    throw new ApiError('unknown', 'The server returned an unreadable list of requests.');
  }
  // One unreadable entry is skipped, never allowed to hide the rest.
  return response.requests
    .map(serviceRequestFromServer)
    .filter((request): request is ServiceRequest => request !== null);
}

export async function fetchServiceRequest(token: string, id: string): Promise<ServiceRequest> {
  return requestOrThrow(await apiRequest<RequestResponse>(`/service-requests/${id}`, { token }));
}

/**
 * A request photo, from the API with the Bearer token — never a storage URL.
 * The server only answers for the request's own owner.
 */
export function serviceRequestPhotoSource(token: string, requestId: string, photoId: string) {
  return {
    uri: `${API_BASE_URL}/service-requests/${requestId}/photos/${photoId}`,
    headers: { Authorization: `Bearer ${token}` },
  };
}
