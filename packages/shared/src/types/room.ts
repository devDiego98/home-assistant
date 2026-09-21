export interface Room {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoomWithLights extends Room {
  lightIds: string[];
  lightsOn: number;
  lightCount: number;
  partyActive: boolean;
}

export interface CreateRoomRequest {
  name: string;
}

export type PartySceneAction = 'start' | 'stop';

export interface ApplyColorRequest {
  h: number; // 0-360
  s: number; // 0-1000
  v: number; // 0-1000
}

export interface ApplyWhiteRequest {
  brightness: number; // 0-100
  colorTemp: number; // 0-1000 (0 = warmest, 1000 = coolest)
}

export type PresetMode = 'colour' | 'white';

export interface RoomPreset {
  id: string;
  roomId: string;
  name: string;
  mode: PresetMode;
  hue: number | null;
  saturation: number | null;
  brightness: number;
  colorTemp: number | null;
  createdAt: string;
}

export interface CreateRoomPresetRequest {
  name: string;
  mode: PresetMode;
  h?: number; // colour mode only, 0-360
  s?: number; // colour mode only, 0-1000
  brightness: number; // 0-100, both modes (colour mode's "value" reuses this, scaled to 0-1000 on apply)
  colorTemp?: number; // white mode only, 0-1000
}
