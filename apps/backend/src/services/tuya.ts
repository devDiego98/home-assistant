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

function buildSign(clientId: string, secret: string, t: string, nonce: string, accessToken: string, method: string, path: string, body: string): string {
  const bodyHash = createHash('sha256').update(body).digest('hex');
  const stringToSign = `${method}\n${bodyHash}\n\n${path}`;
  const str = `${clientId}${accessToken}${t}${nonce}\n${stringToSign}`;
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

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!isConfigured()) throw new Error('Tuya credentials not configured');

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
    const result = await request<{ devices: Array<{ id: string; name: string; online: boolean; category: string }> }>(
      'GET',
      '/v2.0/cloud/thing/device?page_size=50',
    );
    return result.devices ?? [];
  },

  async getDeviceStatus(deviceId: string): Promise<Array<{ code: string; value: unknown }>> {
    return request<Array<{ code: string; value: unknown }>>('GET', `/v1.0/iot-03/devices/${deviceId}/status`);
  },

  async controlDevice(deviceId: string, commands: Array<{ code: string; value: unknown }>): Promise<boolean> {
    return request<boolean>('POST', `/v1.0/iot-03/devices/${deviceId}/commands`, { commands });
  },

  async toggleLight(deviceId: string, on: boolean): Promise<boolean> {
    return tuyaService.controlDevice(deviceId, [{ code: 'switch_led', value: on }]);
  },

  async setBrightness(deviceId: string, brightness: number): Promise<boolean> {
    return tuyaService.controlDevice(deviceId, [
      { code: 'switch_led', value: brightness > 0 },
      { code: 'bright_value_v2', value: Math.round((brightness / 100) * 1000) },
    ]);
  },
};
