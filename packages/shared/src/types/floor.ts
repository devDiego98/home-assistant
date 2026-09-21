export interface FloorLight {
  id: string;
  name: string;
  tuyaDeviceId: string;
  positionX: number | null;
  positionY: number | null;
  isOn: boolean;
  brightness?: number;
  roomId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TuyaDevice {
  id: string;
  name: string;
  online: boolean;
  category: string;
}

export interface CreateFloorLightRequest {
  name: string;
  tuyaDeviceId: string;
  positionX?: number | null;
  positionY?: number | null;
  roomId?: string | null;
}

export interface TuyaSyncResult {
  linked: number;
  roomsCreated: number;
  skipped: number;
}
