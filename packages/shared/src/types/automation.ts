export type TriggerType =
  | 'time'
  | 'device_state'
  | 'detection'
  | 'presence'
  | 'manual';

export type ActionType =
  | 'device_command'
  | 'send_notification'
  | 'trigger_automation';

export interface TimeTrigger {
  type: 'time';
  cron: string;
}

export interface DeviceStateTrigger {
  type: 'device_state';
  deviceId: string;
  property: string;
  value: unknown;
}

export interface DetectionTrigger {
  type: 'detection';
  cameraId: string;
  objects: string[];
  zone?: string;
}

export type AutomationTrigger = TimeTrigger | DeviceStateTrigger | DetectionTrigger;

export interface DeviceCommandAction {
  type: 'device_command';
  deviceId: string;
  command: string;
  value: unknown;
}

export interface NotificationAction {
  type: 'send_notification';
  title: string;
  body: string;
  includeSnapshot?: boolean;
}

export type AutomationAction = DeviceCommandAction | NotificationAction;

export interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  conditions?: AutomationCondition[];
  actions: AutomationAction[];
  lastTriggeredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationCondition {
  type: 'time_range' | 'device_state';
  from?: string;
  to?: string;
  deviceId?: string;
  property?: string;
  value?: unknown;
}
