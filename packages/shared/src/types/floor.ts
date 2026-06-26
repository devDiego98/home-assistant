export interface FloorLight {
  id: string;
  name: string;
  tuyaDeviceId: string;
  positionX: number;
  positionY: number;
  isOn: boolean;
  brightness?: number;
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
  positionX: number;
  positionY: number;
}
