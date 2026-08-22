import { apiRequest } from '@/services/api-client';
import type { AuthResponse, MeResponse, MessageResponse } from '@/types/api';

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


export function googleLogin(idToken: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/google', {
    method: 'POST',
    body: { idToken },
  });
}


export function forgotPassword(email: string): Promise<MessageResponse> {
  return apiRequest<MessageResponse>('/auth/forgot-password', {
    method: 'POST',
    body: { email },
  });
}

export function resetPassword(token: string, password: string): Promise<MessageResponse> {
  return apiRequest<MessageResponse>('/auth/reset-password', {
    method: 'POST',
    body: { token, password },
  });
}
