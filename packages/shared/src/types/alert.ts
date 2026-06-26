import type { DetectionObject } from './camera.js';

export type AlertType = 'detection' | 'device_offline' | 'motion' | 'door_open' | 'lock_tamper' | 'system';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  cameraId?: string;
  deviceId?: string;
  snapshotUrl?: string;
  clipUrl?: string;
  detectedObjects?: DetectionObject[];
  acknowledgedAt?: string;
  createdAt: string;
}

export interface AlertFilter {
  type?: AlertType;
  severity?: AlertSeverity;
  cameraId?: string;
  acknowledged?: boolean;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}
