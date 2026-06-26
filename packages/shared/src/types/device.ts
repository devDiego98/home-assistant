export type DeviceType =
  | 'light'
  | 'switch'
  | 'plug'
  | 'lock'
  | 'thermostat'
  | 'sensor_motion'
  | 'sensor_door'
  | 'sensor_temperature'
  | 'sensor_humidity';

export type DeviceProtocol = 'zigbee' | 'wifi' | 'zwave' | 'mqtt';

export type DeviceStatus = 'online' | 'offline' | 'unavailable';

export interface DeviceCapabilities {
  on_off?: boolean;
  brightness?: boolean;
  color_temp?: boolean;
  color_rgb?: boolean;
  lock_unlock?: boolean;
  temperature_set?: boolean;
}

export interface DeviceState {
  power?: boolean;
  brightness?: number;
  colorTemp?: number;
  colorRgb?: [number, number, number];
  locked?: boolean;
  targetTemp?: number;
  currentTemp?: number;
  humidity?: number;
  motion?: boolean;
  contact?: boolean;
}

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  protocol: DeviceProtocol;
  status: DeviceStatus;
  room?: string;
  capabilities: DeviceCapabilities;
  state: DeviceState;
  lastSeen?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceCommand {
  deviceId: string;
  command: keyof DeviceCapabilities;
  value: boolean | number | [number, number, number];
}
