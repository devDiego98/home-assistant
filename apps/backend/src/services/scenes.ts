import { tuyaLocalService } from './tuyaLocal';

const partyIntervals = new Map<string, NodeJS.Timeout>();

function randomHue(): number {
  return Math.floor(Math.random() * 360);
}

export const scenesService = {
  isPartyActive(roomId: string): boolean {
    return partyIntervals.has(roomId);
  },

  startParty(roomId: string, tuyaDeviceIds: string[]): void {
    scenesService.stopParty(roomId);
    if (tuyaDeviceIds.length === 0) return;

    const tick = () => {
      for (const deviceId of tuyaDeviceIds) {
        tuyaLocalService.setColor(deviceId, randomHue(), 1000, 1000).catch(() => {});
      }
    };
    tick();
    partyIntervals.set(roomId, setInterval(tick, 500));
  },

  stopParty(roomId: string): void {
    const interval = partyIntervals.get(roomId);
    if (interval) {
      clearInterval(interval);
      partyIntervals.delete(roomId);
    }
  },

  async applyColor(tuyaDeviceIds: string[], h: number, s: number, v: number): Promise<void> {
    await Promise.all(tuyaDeviceIds.map((id) => tuyaLocalService.setColor(id, h, s, v).catch(() => {})));
  },

  async applyWhite(tuyaDeviceIds: string[], brightness: number, colorTemp: number): Promise<void> {
    await Promise.all(tuyaDeviceIds.map((id) => tuyaLocalService.setWhite(id, brightness, colorTemp).catch(() => {})));
  },

  async toggleRoom(tuyaDeviceIds: string[], on: boolean): Promise<void> {
    await Promise.all(tuyaDeviceIds.map((id) => tuyaLocalService.toggleLight(id, on).catch(() => {})));
  },
};
