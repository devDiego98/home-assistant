import 'dotenv/config';
import { createHmac, createHash, randomBytes } from 'node:crypto';

// Verify exact byte lengths — catches invisible chars from copy-paste

const clientId = process.env['TUYA_CLIENT_ID'] ?? '';
const secret = process.env['TUYA_CLIENT_SECRET'] ?? '';
const region = process.env['TUYA_REGION'] ?? 'us';

const BASE_URLS: Record<string, string> = {
  us: 'https://openapi.tuyaus.com',
  eu: 'https://openapi.tuyaeu.com',
  cn: 'https://openapi.tuyacn.com',
  in: 'https://openapi.tuyain.com',
};

const baseUrl = BASE_URLS[region] ?? BASE_URLS['us'];

console.log('--- Tuya Debug ---');
console.log('Client ID :', clientId.slice(0, 6) + '... (length:', clientId.length, ')');
console.log('Secret    :', secret.slice(0, 6) + '... (length:', secret.length, ')');
console.log('Region    :', region);
console.log('Base URL  :', baseUrl);

// Try 1: Old simple signature (v1.0 style)
{
  const t = Date.now().toString();
  const sign = createHmac('sha256', secret).update(clientId + t).digest('hex').toUpperCase();
  console.log('\n[Test 1] Simple signature (clientId + t)');
  const res = await fetch(`${baseUrl}/v1.0/token?grant_type=1`, {
    headers: { client_id: clientId, sign, t, sign_method: 'HMAC-SHA256' },
  });
  const data = await res.json();
  console.log('Result:', JSON.stringify(data));
}

// Try 2: Full signature with nonce — no dashes in nonce
{
  const t = Date.now().toString();
  const nonce = randomBytes(16).toString('hex'); // 32 hex chars, no dashes
  const path = '/v1.0/token?grant_type=1';
  const bodyHash = createHash('sha256').update('').digest('hex');
  const stringToSign = `GET\n${bodyHash}\n\n${path}`;
  const str = `${clientId}${t}${nonce}\n${stringToSign}`;
  const sign = createHmac('sha256', secret).update(str).digest('hex').toUpperCase();
  console.log('\n[Test 2] Full signature (no access_token, nonce no dashes)');
  console.log('Nonce     :', nonce);
  console.log('Str signed:', str.replace(clientId, '[ID]'));
  const res = await fetch(`${baseUrl}/v1.0/token?grant_type=1`, {
    headers: { client_id: clientId, sign, t, nonce, sign_method: 'HMAC-SHA256' },
  });
  const data = await res.json();
  console.log('Result:', JSON.stringify(data));
}

// Try 3: Full signature but path WITHOUT query string in the signed string
{
  const t = Date.now().toString();
  const nonce = randomBytes(16).toString('hex');
  const signPath = '/v1.0/token';
  const fetchUrl = '/v1.0/token?grant_type=1';
  const bodyHash = createHash('sha256').update('').digest('hex');
  const stringToSign = `GET\n${bodyHash}\n\n${signPath}`;
  const str = `${clientId}${t}${nonce}\n${stringToSign}`;
  const sign = createHmac('sha256', secret).update(str).digest('hex').toUpperCase();
  console.log('\n[Test 3] Full signature (path WITHOUT query string)');
  const res = await fetch(`${baseUrl}${fetchUrl}`, {
    headers: { client_id: clientId, sign, t, nonce, sign_method: 'HMAC-SHA256' },
  });
  const data = await res.json();
  console.log('Result:', JSON.stringify(data));
}

// Try 4: Use node:https directly (HTTP/1.1, bypasses fetch/undici)
{
  const https = await import('node:https');
  const t = Date.now().toString();
  const nonce = randomBytes(16).toString('hex');
  const path = '/v1.0/token?grant_type=1';
  const bodyHash = createHash('sha256').update('').digest('hex');
  const stringToSign = `GET\n${bodyHash}\n\n${path}`;
  const str = `${clientId}${t}${nonce}\n${stringToSign}`;
  const sign = createHmac('sha256', secret).update(str).digest('hex').toUpperCase();

  const body = await new Promise<string>((resolve, reject) => {
    const req = https.request({
      hostname: 'openapi.tuyaus.com',
      path,
      method: 'GET',
      headers: { client_id: clientId, sign, t, nonce, sign_method: 'HMAC-SHA256' },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.end();
  });
  console.log('\n[Test 4] node:https module (HTTP/1.1)');
  console.log('Result:', body);
}

// Try 5: Secret decoded as hex binary (16 bytes instead of 32 ASCII bytes)
{
  const t = Date.now().toString();
  const nonce = randomBytes(16).toString('hex');
  const path = '/v1.0/token?grant_type=1';
  const bodyHash = createHash('sha256').update('').digest('hex');
  const stringToSign = `GET\n${bodyHash}\n\n${path}`;
  const str = `${clientId}${t}${nonce}\n${stringToSign}`;
  const binarySecret = Buffer.from(secret, 'hex'); // 16 bytes instead of 32
  const sign = createHmac('sha256', binarySecret).update(str).digest('hex').toUpperCase();
  console.log('\n[Test 5] Full signature (secret decoded as hex binary)');
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { client_id: clientId, sign, t, nonce, sign_method: 'HMAC-SHA256' },
  });
  const data = await res.json();
  console.log('Result:', JSON.stringify(data));
}

// Print a ready-to-run curl command so you can test completely outside Node.js
{
  const t = Date.now().toString();
  const nonce = randomBytes(16).toString('hex');
  const path = '/v1.0/token?grant_type=1';
  const bodyHash = createHash('sha256').update('').digest('hex');
  const stringToSign = `GET\n${bodyHash}\n\n${path}`;
  const str = `${clientId}${t}${nonce}\n${stringToSign}`;
  const sign = createHmac('sha256', secret).update(str).digest('hex').toUpperCase();
  console.log('\n--- Run this curl to test outside Node.js ---');
  console.log(`curl -s -X GET "${baseUrl}/v1.0/token?grant_type=1" \\`);
  console.log(`  -H "client_id: ${clientId}" \\`);
  console.log(`  -H "sign: ${sign}" \\`);
  console.log(`  -H "t: ${t}" \\`);
  console.log(`  -H "nonce: ${nonce}" \\`);
  console.log(`  -H "sign_method: HMAC-SHA256" | python3 -m json.tool`);
}
