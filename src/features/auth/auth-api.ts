import { apiRequest } from '@/services/api-client';
import type { AuthResponse, MeResponse } from '@/types/api';

export function login(email: string, password: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export function register(name: string, email: string, password: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: { name, email, password },
  });
}

export function getMe(token: string): Promise<MeResponse> {
  return apiRequest<MeResponse>('/auth/me', { token });
}
