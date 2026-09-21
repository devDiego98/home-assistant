import { createHmac, createHash, randomUUID } from 'node:crypto';
import { config } from '../config';

const BASE_URLS: Record<string, string> = {
  us: 'https://openapi.tuyaus.com',
  eu: 'https://openapi.tuyaeu.com',
  cn: 'https://openapi.tuyacn.com',
  in: 'https://openapi.tuyain.com',
};

interface TuyaTokenResult {
  access_token: string;
  expire_time: number;
  refresh_token: string;
  uid: string;
}

let cachedToken: TuyaTokenResult | null = null;
let tokenExpiresAt = 0;

function baseUrl(): string {
  return BASE_URLS[config.TUYA_REGION];
}

function isConfigured(): boolean {
  return Boolean(config.TUYA_CLIENT_ID && config.TUYA_CLIENT_SECRET);
}

// Tuya requires query params sorted alphabetically by key in the signed URL — a path
// with a single param (or none) is trivially "sorted", so this only bites once a second
// query param is added (e.g. pagination's last_id alongside page_size).
function sortedPath(path: string): string {
  const [base, query] = path.split('?');
  if (!query) return path;
  const sorted = [...new URLSearchParams(query).entries()].sort(([a], [b]) => a.localeCompare(b));
  return `${base}?${new URLSearchParams(sorted).toString()}`;
}

function buildSign(clientId: string, secret: string, t: string, nonce: string, accessToken: string, method: string, path: string, body: string): string {
  const bodyHash = createHash('sha256').update(body).digest('hex');
  const stringToSign = `${method}\n${bodyHash}\n\n${path}`;
  const str = `${clientId}${accessToken}${t}${nonce}${stringToSign}`;
  return createHmac('sha256', secret).update(str).digest('hex').toUpperCase();
}

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken.access_token;

  const clientId = config.TUYA_CLIENT_ID!;
  const secret = config.TUYA_CLIENT_SECRET!;
  const t = Date.now().toString();
  const nonce = randomUUID();
  const path = '/v1.0/token?grant_type=1';
  // No access token for the token request — empty string in its place
  const sign = buildSign(clientId, secret, t, nonce, '', 'GET', path, '');

  const res = await fetch(`${baseUrl()}${path}`, {
    headers: { client_id: clientId, sign, t, nonce, sign_method: 'HMAC-SHA256' },
  });

  const data = await res.json() as { success: boolean; result: TuyaTokenResult };
  if (!data.success) throw new Error(`Tuya token error: ${JSON.stringify(data)}`);

  cachedToken = data.result;
  tokenExpiresAt = Date.now() + (data.result.expire_time - 60) * 1000;
  return cachedToken.access_token;
}

async function request<T>(method: string, rawPath: string, body?: unknown): Promise<T> {
  if (!isConfigured()) throw new Error('Tuya credentials not configured');

  const path = sortedPath(rawPath);
  const clientId = config.TUYA_CLIENT_ID!;
  const secret = config.TUYA_CLIENT_SECRET!;
  const accessToken = await getToken();
  const t = Date.now().toString();
  const nonce = randomUUID();
  const bodyStr = body ? JSON.stringify(body) : '';
  const sign = buildSign(clientId, secret, t, nonce, accessToken, method, path, bodyStr);

  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      client_id: clientId,
      access_token: accessToken,
      sign,
      t,
      nonce,
      sign_method: 'HMAC-SHA256',
      'Content-Type': 'application/json',
    },
    body: bodyStr || undefined,
  });

  const data = await res.json() as { success: boolean; result: T; msg?: string };
  if (!data.success) throw new Error(`Tuya API error: ${data.msg ?? JSON.stringify(data)}`);
  return data.result;
}

export const tuyaService = {
  isConfigured,

  async listDevices(): Promise<Array<{ id: string; name: string; online: boolean; category: string }>> {
    // /v2.0/cloud/thing/device's `result` IS the device array (max page_size is 20, so
    // multiple devices require paging via `last_id`). `name` is the product/model name
    // ("Dicroica PAR16 GU10 Smart BAW 13") — the user-assigned name is `customName`.
    // Online status is `isOnline`, not `online`.
    type TuyaDeviceEntry = { id: string; name: string; customName?: string; category: string; isOnline: boolean };
    const devices: TuyaDeviceEntry[] = [];
    let lastId = '';

    for (;;) {
      const page = await request<TuyaDeviceEntry[]>(
        'GET',
        `/v2.0/cloud/thing/device?page_size=20${lastId ? `&last_id=${lastId}` : ''}`,
      );
      if (!page || page.length === 0) break;
      devices.push(...page);
      if (page.length < 20) break;
      const last = devices[devices.length - 1];
      if (!last) break;
      lastId = last.id;
    }

    return devices.map((d) => ({ id: d.id, name: d.customName || d.name, category: d.category, online: d.isOnline }));
  },

  async getDeviceStatus(deviceId: string): Promise<Array<{ code: string; value: unknown }>> {
    return request<Array<{ code: string; value: unknown }>>('GET', `/v1.0/iot-03/devices/${deviceId}/status`);
  },

  // Read-only — doesn't touch the controllable-device-pool quota. Used once per device
  // to provision local LAN control (see services/tuyaLocal.ts).
  async getDeviceLocalInfo(deviceId: string): Promise<{ localKey: string; ip: string }> {
    const result = await request<{ local_key: string; ip: string }>('GET', `/v2.0/cloud/thing/${deviceId}`);
    return { localKey: result.local_key, ip: result.ip };
  },

  // Maps each function's semantic `code` (e.g. "switch_led") to its numeric local DP id —
  // local commands address DPs by number, cloud commands by code, and Tuya doesn't
  // otherwise document a per-device mapping between the two.
  async getDevicePropertyDpIds(deviceId: string): Promise<Record<string, number>> {
    const result = await request<{ properties: Array<{ code: string; dp_id: number }> }>(
      'GET',
      `/v2.0/cloud/thing/${deviceId}/shadow/properties`,
    );
    return Object.fromEntries((result.properties ?? []).map((p) => [p.code, p.dp_id]));
  },
};
