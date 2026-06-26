export type CameraStatus = 'online' | 'offline' | 'recording' | 'error';
export type StreamProtocol = 'rtsp' | 'webrtc' | 'hls';

export interface Camera {
  id: string;
  name: string;
  location: string;
  status: CameraStatus;
  rtspUrl?: string;
  hasAudio: boolean;
  hasNightVision: boolean;
  resolutionWidth: number;
  resolutionHeight: number;
  frigateId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CameraStream {
  cameraId: string;
  protocol: StreamProtocol;
  url: string;
  expiresAt?: string;
}

export interface DetectionZone {
  id: string;
  cameraId: string;
  name: string;
  coordinates: Array<[number, number]>;
  enabledObjects: DetectionObject[];
}

export type DetectionObject = 'person' | 'car' | 'motorcycle' | 'bicycle' | 'dog' | 'cat' | 'package';

export interface Recording {
  id: string;
  cameraId: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  thumbnailUrl?: string;
  clipUrl?: string;
  hasDetections: boolean;
}
