import TuyaDevice from 'tuyapi';
import net from 'node:net';
import { networkInterfaces } from 'node:os';
import { eq, isNotNull } from 'drizzle-orm';
import { db } from '../db/index';
import { floorLights } from '../db/schema/index';
import { tuyaService } from './tuya';

// Tuya's cloud API doesn't expose which local protocol version a device speaks —
// newer firmware uses 3.4 or 3.5, most existing devices use 3.3. Whichever connects
// successfully gets cached on the light so future calls skip straight to it.
const PROTOCOL_VERSIONS = ['3.3', '3.4', '3.5'];
const CONNECT_TIMEOUT_MS = 5000;
// Some bulbs (weaker WiFi signal, longer broadcast interval) need real patience on their
// first-ever discovery — after that the IP is cached and every future call skips this.
const DISCOVERY_TIMEOUT_SEC = 12;
// Keep a just-used connection open briefly instead of reconnecting from scratch every
// command — a fresh TCP + Tuya handshake takes a couple of seconds, which is fine once
// but unusable for e.g. party mode's setColor calls every 500ms. Kept short because Tuya
// devices only accept one TCP connection at a time (would conflict with the SmartLife app).
const IDLE_DISCONNECT_MS = 30_000;

interface LocalInfo {
  localKey: string;
  localIp: string | null;
  localVersion: string | null;
  localDpMap: Record<string, number>;
}

// tuyapi's TuyaDevice extends EventEmitter and emits 'error' on socket failures
// (unreachable device, wrong key, etc). Node kills the whole process on an unhandled
// 'error' event, so every instance MUST get a listener before any find()/connect() —
// the real failure still surfaces via the rejected connect()/find()/set() promise.
function silenceCrashOnError(device: TuyaDevice): void {
  device.on('error', () => {});
}

// Not declared in tuyapi's .d.ts, but find()/connect() populate this internal field
// with the device's real LAN IP once discovered via UDP broadcast.
function discoveredIp(device: TuyaDevice): string | null {
  const ip = (device as unknown as { device: { ip?: string } }).device.ip;
  return ip || null;
}

async function fetchAndPersistLocalInfo(lightId: string, tuyaDeviceId: string): Promise<LocalInfo> {
  const [{ localKey }, dpMap] = await Promise.all([
    tuyaService.getDeviceLocalInfo(tuyaDeviceId),
    tuyaService.getDevicePropertyDpIds(tuyaDeviceId),
  ]);

  // Cloud's `ip` field is the device's public/WAN IP as Tuya's servers see it, not its
  // LAN address — useless for direct local connection, so it's never stored. The real
  // LAN IP is only ever learned via UDP broadcast discovery in locateAndConnect().
  await db.update(floorLights)
    .set({ localKey, localDpMap: dpMap, updatedAt: new Date() })
    .where(eq(floorLights.id, lightId));

  return { localKey, localIp: null, localVersion: null, localDpMap: dpMap };
}

async function getOrFetchLocalInfo(tuyaDeviceId: string): Promise<{ lightId: string; name: string; info: LocalInfo }> {
  const [light] = await db.select().from(floorLights).where(eq(floorLights.tuyaDeviceId, tuyaDeviceId)).limit(1);
  if (!light) throw new Error(`No floor light linked to Tuya device ${tuyaDeviceId}`);

  if (light.localKey && light.localDpMap) {
    return {
      lightId: light.id,
      name: light.name,
      info: { localKey: light.localKey, localIp: light.localIp, localVersion: light.localVersion, localDpMap: light.localDpMap },
    };
  }

  return { lightId: light.id, name: light.name, info: await fetchAndPersistLocalInfo(light.id, tuyaDeviceId) };
}

// Some device firmware (confirmed: a batch sharing a distinct WiFi-module MAC vendor
// prefix, all speaking protocol 3.5) never sends the discovery beacon tuyapi's find()
// listens for — verified with clean, repeated, full-length raw packet captures that
// never once saw a broadcast from them, while every other device broadcasts every ~5s.
// For those, the only way to find them is to scan the LAN for the port they DO answer
// on and check each candidate's identity directly, since a lit-up port alone proves
// nothing — connect() succeeds against any listening Tuya device regardless of whether
// the id/key actually match it, so only an authenticated get() confirms a real match.
const TUYA_LOCAL_PORT = 6668;
const PORT_PROBE_TIMEOUT_MS = 400;
// 254 concurrent TCP probes take noticeably longer in aggregate than any single probe's
// own timeout (OS-level socket overhead) — this is a one-time cost per light, cached
// afterward, so it's fine for it to take a few seconds.
const SUBNET_SCAN_TIMEOUT_MS = 12_000;

// Excludes Tailscale's virtual interface (100.64.0.0/10 CGNAT range) — it isn't marked
// "internal" either, so without this check the scan silently probes the VPN mesh instead
// of the actual home LAN the bulbs are on.
function isPrivateLan(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  const [a, b] = parts;
  if (a === undefined || b === undefined) return false;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function localSubnetPrefix(): string | null {
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal && isPrivateLan(iface.address)) {
        const [a, b, c] = iface.address.split('.');
        return `${a}.${b}.${c}`;
      }
    }
  }
  return null;
}

function probeTuyaPort(ip: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const finish = (result: boolean) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(PORT_PROBE_TIMEOUT_MS);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(TUYA_LOCAL_PORT, ip);
  });
}

async function findCandidateIps(excludeIps: Set<string>): Promise<string[]> {
  const prefix = localSubnetPrefix();
  if (!prefix) return [];

  const hosts = Array.from({ length: 254 }, (_, i) => `${prefix}.${i + 1}`).filter((ip) => !excludeIps.has(ip));
  const results = await Promise.all(hosts.map(async (ip) => ((await probeTuyaPort(ip)) ? ip : null)));
  return results.filter((ip): ip is string => ip !== null);
}

// Verifies a candidate IP is genuinely this device (not just some other Tuya device
// with the same port open) by requiring an authenticated get() to succeed, not just a
// bare TCP connect.
async function verifyCandidate(tuyaDeviceId: string, localKey: string, ip: string, version: string): Promise<TuyaDevice | null> {
  const device = new TuyaDevice({ id: tuyaDeviceId, key: localKey, ip, version, issueGetOnConnect: false });
  silenceCrashOnError(device);
  try {
    await Promise.race([
      device.connect(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('connect timeout')), CONNECT_TIMEOUT_MS)),
    ]);
    await Promise.race([
      device.get({ schema: true }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('get timeout')), CONNECT_TIMEOUT_MS)),
    ]);
    return device;
  } catch {
    device.disconnect();
    return null;
  }
}

async function discoverViaSubnetScan(tuyaDeviceId: string, info: LocalInfo): Promise<{ device: TuyaDevice; ip: string; version: string } | null> {
  const otherLightIps = await db.select({ ip: floorLights.localIp }).from(floorLights).where(isNotNull(floorLights.localIp));
  const excludeIps = new Set(otherLightIps.map((l) => l.ip).filter((ip): ip is string => ip !== null));

  const candidates = await Promise.race([
    findCandidateIps(excludeIps),
    new Promise<string[]>((resolve) => setTimeout(() => resolve([]), SUBNET_SCAN_TIMEOUT_MS)),
  ]);
  if (candidates.length === 0) return null;

  // Every (candidate IP × protocol version) combination is tried at once rather than in
  // sequence — sequential attempts compound into minutes once there are several
  // candidates, since each failed attempt still pays its own multi-second timeout.
  const attempts = candidates.flatMap((ip) =>
    PROTOCOL_VERSIONS.map(async (version) => {
      const device = await verifyCandidate(tuyaDeviceId, info.localKey, ip, version);
      if (!device) throw new Error('no match');
      return { device, ip, version };
    }),
  );

  try {
    return await Promise.any(attempts);
  } catch {
    return null;
  }
}

interface Located {
  device: TuyaDevice;
  ip: string;
  version: string;
}

async function connectAt(tuyaDeviceId: string, key: string, ip: string, version: string): Promise<TuyaDevice> {
  const device = new TuyaDevice({ id: tuyaDeviceId, key, ip, version });
  silenceCrashOnError(device);
  try {
    await Promise.race([
      device.connect(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Local connect timed out')), CONNECT_TIMEOUT_MS)),
    ]);
    return device;
  } catch (err) {
    device.disconnect();
    throw err;
  }
}

async function viaBroadcast(tuyaDeviceId: string, key: string, version: string): Promise<Located> {
  const device = new TuyaDevice({ id: tuyaDeviceId, key, version });
  silenceCrashOnError(device);
  try {
    await device.find({ timeout: DISCOVERY_TIMEOUT_SEC });
    await Promise.race([
      device.connect(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Local connect timed out')), CONNECT_TIMEOUT_MS)),
    ]);
    const ip = discoveredIp(device);
    if (!ip) throw new Error('find() resolved without an IP');
    return { device, ip, version };
  } catch (err) {
    device.disconnect();
    throw err;
  }
}

async function viaSubnetScan(tuyaDeviceId: string, info: LocalInfo): Promise<Located> {
  const found = await discoverViaSubnetScan(tuyaDeviceId, info);
  if (!found) throw new Error('Subnet scan found no match');
  return found;
}

// Connects to a device, using its cached LAN IP directly if known (fast path). Otherwise,
// races broadcast discovery (every known protocol version) against a subnet port-scan —
// run concurrently, not sequentially, since some device firmware never sends the
// broadcast tuyapi listens for and would otherwise waste the full discovery timeout
// budget on every protocol version before the fallback ever got a turn. Persists
// whatever IP/version actually worked so future calls skip straight to it.
async function locateAndConnect(tuyaDeviceId: string, lightId: string, info: LocalInfo): Promise<TuyaDevice> {
  if (info.localIp) {
    const version = info.localVersion ?? PROTOCOL_VERSIONS[0]!;
    const device = await connectAt(tuyaDeviceId, info.localKey, info.localIp, version);
    await persistLocatedInfo(lightId, info, info.localIp, version);
    return device;
  }

  try {
    const found = await Promise.any([
      ...PROTOCOL_VERSIONS.map((version) => viaBroadcast(tuyaDeviceId, info.localKey, version)),
      viaSubnetScan(tuyaDeviceId, info),
    ]);
    await persistLocatedInfo(lightId, info, found.ip, found.version);
    return found.device;
  } catch {
    throw new Error('Device not reachable via broadcast discovery or subnet scan');
  }
}

async function persistLocatedInfo(lightId: string, info: LocalInfo, ip: string | null, version: string): Promise<void> {
  const updates: { updatedAt: Date; localIp?: string; localVersion?: string } = { updatedAt: new Date() };
  if (ip && ip !== info.localIp) updates.localIp = ip;
  if (version !== info.localVersion) updates.localVersion = version;
  if (updates.localIp || updates.localVersion) {
    await db.update(floorLights).set(updates).where(eq(floorLights.id, lightId));
  }
}

interface PooledConnection {
  device: TuyaDevice;
  idleTimer: ReturnType<typeof setTimeout>;
}

const connections = new Map<string, PooledConnection>();

function evict(tuyaDeviceId: string): void {
  const pooled = connections.get(tuyaDeviceId);
  if (!pooled) return;
  clearTimeout(pooled.idleTimer);
  connections.delete(tuyaDeviceId);
  pooled.device.disconnect();
}

function pool(tuyaDeviceId: string, device: TuyaDevice): void {
  const idleTimer = setTimeout(() => evict(tuyaDeviceId), IDLE_DISCONNECT_MS);
  connections.set(tuyaDeviceId, { device, idleTimer });
  // Whichever fires first — either way the connection is no longer usable, drop it from
  // the pool so the next command reconnects rather than sending on a dead socket.
  device.on('error', () => evict(tuyaDeviceId));
  device.on('disconnected', () => evict(tuyaDeviceId));
}

async function getConnection(tuyaDeviceId: string, lightId: string, info: LocalInfo): Promise<TuyaDevice> {
  const pooled = connections.get(tuyaDeviceId);
  if (pooled && pooled.device.isConnected()) {
    clearTimeout(pooled.idleTimer);
    pooled.idleTimer = setTimeout(() => evict(tuyaDeviceId), IDLE_DISCONNECT_MS);
    return pooled.device;
  }

  const device = await locateAndConnect(tuyaDeviceId, lightId, info);
  pool(tuyaDeviceId, device);
  return device;
}

type DpValue = string | number | boolean;

async function sendDps(tuyaDeviceId: string, dps: Record<number, DpValue>): Promise<void> {
  const data: Record<string, DpValue> = Object.fromEntries(Object.entries(dps).map(([id, value]) => [id, value]));
  const { lightId, name, info } = await getOrFetchLocalInfo(tuyaDeviceId);

  try {
    const device = await getConnection(tuyaDeviceId, lightId, info);
    await device.set({ multiple: true, data });
    return;
  } catch {
    // Cached IP/key may be stale (DHCP lease change, device re-paired) — drop the cached
    // IP to force fresh broadcast discovery, refresh the key from the cloud, and retry once.
    evict(tuyaDeviceId);
    const refreshed = await fetchAndPersistLocalInfo(lightId, tuyaDeviceId);
    try {
      const device = await getConnection(tuyaDeviceId, lightId, refreshed);
      await device.set({ multiple: true, data });
    } catch (err) {
      evict(tuyaDeviceId);
      throw new Error(`"${name}" is unreachable on the LAN: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

// Different firmware batches within the same product line expose different code
// variants for the same function (e.g. "bright_value_v2" vs. the legacy "bright_value") —
// confirmed against real devices in this fleet, which aren't uniform. Tries each
// candidate in order and uses whichever the device actually reports.
function dpId(dpMap: Record<string, number>, ...codes: string[]): number {
  for (const code of codes) {
    const id = dpMap[code];
    if (id !== undefined) return id;
  }
  throw new Error(`Device has no DP mapped for any of: ${codes.join(', ')}`);
}

function encodeColour(h: number, s: number, v: number): string {
  const hex = (n: number) => Math.round(n).toString(16).padStart(4, '0');
  return `${hex(h)}${hex(s)}${hex(v)}`;
}

export const tuyaLocalService = {
  async toggleLight(tuyaDeviceId: string, on: boolean): Promise<void> {
    const { info } = await getOrFetchLocalInfo(tuyaDeviceId);
    await sendDps(tuyaDeviceId, { [dpId(info.localDpMap, 'switch_led')]: on });
  },

  async setBrightness(tuyaDeviceId: string, brightness: number): Promise<void> {
    const { info } = await getOrFetchLocalInfo(tuyaDeviceId);
    await sendDps(tuyaDeviceId, {
      [dpId(info.localDpMap, 'switch_led')]: brightness > 0,
      [dpId(info.localDpMap, 'bright_value_v2', 'bright_value')]: Math.round((brightness / 100) * 1000),
    });
  },

  /** h: 0-360, s/v: 0-1000. Requires an RGB-capable device (e.g. BAW color spot lights). */
  async setColor(tuyaDeviceId: string, h: number, s: number, v: number): Promise<void> {
    const { info } = await getOrFetchLocalInfo(tuyaDeviceId);
    await sendDps(tuyaDeviceId, {
      [dpId(info.localDpMap, 'switch_led')]: true,
      [dpId(info.localDpMap, 'work_mode')]: 'colour',
      [dpId(info.localDpMap, 'colour_data_v2', 'colour_data')]: encodeColour(h, s, v),
    });
  },

  /** brightness: 0-100. colorTemp: 0-1000 (0 = warmest, 1000 = coolest). */
  async setWhite(tuyaDeviceId: string, brightness: number, colorTemp: number): Promise<void> {
    const { info } = await getOrFetchLocalInfo(tuyaDeviceId);
    await sendDps(tuyaDeviceId, {
      [dpId(info.localDpMap, 'switch_led')]: true,
      [dpId(info.localDpMap, 'work_mode')]: 'white',
      [dpId(info.localDpMap, 'bright_value_v2', 'bright_value')]: Math.round((brightness / 100) * 1000),
      [dpId(info.localDpMap, 'temp_value_v2', 'temp_value')]: Math.round(colorTemp),
    });
  },
};
