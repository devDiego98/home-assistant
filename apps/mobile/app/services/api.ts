import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../store/auth';
import type { ApiResult, LoginRequest, LoginResponse, RoomWithLights, CreateRoomRequest, PartySceneAction, CreateFloorLightRequest, TuyaSyncResult, ApplyColorRequest, ApplyWhiteRequest, RoomPreset, CreateRoomPresetRequest } from '@casa/shared';

const BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000';

// Paths that legitimately return 401 on their own (bad credentials / dead refresh
// token) — must not trigger the refresh-and-retry loop below.
const AUTH_PATHS = new Set(['/api/auth/login', '/api/auth/refresh']);

async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync('access_token');
}

async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync('refresh_token');
}

// Dedupes concurrent 401s during the same tick into a single refresh call.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return null;

      try {
        const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: refreshToken }),
        });
        const data = (await res.json()) as ApiResult<{ accessToken: string; refreshToken: string; expiresIn: number }>;
        if (!data.success) return null;

        await Promise.all([
          SecureStore.setItemAsync('access_token', data.data.accessToken),
          SecureStore.setItemAsync('refresh_token', data.data.refreshToken),
        ]);
        return data.data.accessToken;
      } catch {
        return null;
      }
    })();
  }

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function request<T>(
  path: string,
  options?: RequestInit,
  retried = false,
): Promise<ApiResult<T>> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    // Fastify's JSON parser rejects an empty body sent with this header, so only
    // set it when there's actually a body (e.g. bodyless POSTs like sync/toggle).
    ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options?.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401 && !retried && !AUTH_PATHS.has(path)) {
    const newAccessToken = await refreshAccessToken();
    if (newAccessToken) return request<T>(path, options, true);

    // Refresh token is dead too — sign the user out so the auth guard redirects to /login.
    await useAuthStore.getState().clearAuth();
  }

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
    sync: () => request<TuyaSyncResult>('/api/tuya/devices/sync', { method: 'POST' }),
  },

  floor: {
    listLights: () => request<unknown[]>('/api/floor/lights'),
    placeLight: (body: CreateFloorLightRequest) =>
      request<unknown>('/api/floor/lights', { method: 'POST', body: JSON.stringify(body) }),
    updateLight: (id: string, body: Partial<CreateFloorLightRequest>) =>
      request<unknown>(`/api/floor/lights/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    toggleLight: (id: string, on: boolean, brightness?: number) =>
      request<unknown>(`/api/floor/lights/${id}/toggle`, { method: 'POST', body: JSON.stringify({ on, brightness }) }),
    removeLight: (id: string) =>
      request<null>(`/api/floor/lights/${id}`, { method: 'DELETE' }),
  },

  rooms: {
    list: () => request<RoomWithLights[]>('/api/rooms'),
    create: (body: CreateRoomRequest) =>
      request<RoomWithLights>('/api/rooms', { method: 'POST', body: JSON.stringify(body) }),
    rename: (id: string, body: CreateRoomRequest) =>
      request<RoomWithLights>(`/api/rooms/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id: string) => request<null>(`/api/rooms/${id}`, { method: 'DELETE' }),
    toggle: (id: string, on: boolean) =>
      request<{ on: boolean; lightCount: number }>(`/api/rooms/${id}/toggle`, { method: 'POST', body: JSON.stringify({ on }) }),
    party: (id: string, action: PartySceneAction) =>
      request<{ partyActive: boolean }>(`/api/rooms/${id}/scenes/party`, { method: 'POST', body: JSON.stringify({ action }) }),
    applyColor: (id: string, body: ApplyColorRequest) =>
      request<{ applied: boolean }>(`/api/rooms/${id}/scenes/color`, { method: 'POST', body: JSON.stringify(body) }),
    applyWhite: (id: string, body: ApplyWhiteRequest) =>
      request<{ applied: boolean }>(`/api/rooms/${id}/scenes/white`, { method: 'POST', body: JSON.stringify(body) }),
    presets: {
      list: (roomId: string) => request<RoomPreset[]>(`/api/rooms/${roomId}/presets`),
      create: (roomId: string, body: CreateRoomPresetRequest) =>
        request<RoomPreset>(`/api/rooms/${roomId}/presets`, { method: 'POST', body: JSON.stringify(body) }),
      apply: (roomId: string, presetId: string) =>
        request<{ applied: boolean }>(`/api/rooms/${roomId}/presets/${presetId}/apply`, { method: 'POST' }),
      remove: (roomId: string, presetId: string) =>
        request<null>(`/api/rooms/${roomId}/presets/${presetId}`, { method: 'DELETE' }),
    },
  },
};
