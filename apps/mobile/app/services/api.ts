import * as SecureStore from 'expo-secure-store';
import type { ApiResult, LoginRequest, LoginResponse } from '@casa/shared';

const BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000';

async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync('access_token');
}

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<ApiResult<T>> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  return res.json() as Promise<ApiResult<T>>;
}

export const api = {
  auth: {
    login: (body: LoginRequest) =>
      request<LoginResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    refresh: (token: string) =>
      request<{ accessToken: string; refreshToken: string; expiresIn: number }>('/api/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
    logout: (token: string) =>
      request<null>('/api/auth/logout', { method: 'POST', body: JSON.stringify({ token }) }),
  },

  devices: {
    list: () => request<unknown[]>('/api/devices'),
    get: (id: string) => request<unknown>(`/api/devices/${id}`),
    command: (id: string, command: string, value: unknown) =>
      request<{ queued: boolean }>(`/api/devices/${id}/command`, {
        method: 'POST',
        body: JSON.stringify({ command, value }),
      }),
  },

  cameras: {
    list: () => request<unknown[]>('/api/cameras'),
    get: (id: string) => request<unknown>(`/api/cameras/${id}`),
    stream: (id: string) => request<{ cameraId: string; protocol: string; url: string }>(`/api/cameras/${id}/stream`),
    recordings: (id: string) => request<unknown[]>(`/api/cameras/${id}/recordings`),
  },

  alerts: {
    list: (params?: { acknowledged?: boolean; from?: string; to?: string }) => {
      const qs = new URLSearchParams();
      if (params?.acknowledged !== undefined) qs.set('acknowledged', String(params.acknowledged));
      if (params?.from) qs.set('from', params.from);
      if (params?.to) qs.set('to', params.to);
      return request<unknown[]>(`/api/alerts?${qs.toString()}`);
    },
    acknowledge: (id: string) =>
      request<{ id: string; acknowledged: boolean }>(`/api/alerts/${id}/acknowledge`, { method: 'POST' }),
  },

  tuya: {
    listDevices: () => request<unknown[]>('/api/tuya/devices'),
  },

  floor: {
    listLights: () => request<unknown[]>('/api/floor/lights'),
    placeLight: (body: { name: string; tuyaDeviceId: string; positionX: number; positionY: number }) =>
      request<unknown>('/api/floor/lights', { method: 'POST', body: JSON.stringify(body) }),
    updateLight: (id: string, body: { name?: string; positionX?: number; positionY?: number }) =>
      request<unknown>(`/api/floor/lights/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    toggleLight: (id: string, on: boolean, brightness?: number) =>
      request<unknown>(`/api/floor/lights/${id}/toggle`, { method: 'POST', body: JSON.stringify({ on, brightness }) }),
    removeLight: (id: string) =>
      request<null>(`/api/floor/lights/${id}`, { method: 'DELETE' }),
  },
};
