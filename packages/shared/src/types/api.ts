export interface ApiResponse<T> {
  data: T;
  success: true;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export type WsEventType =
  | 'device_state_changed'
  | 'alert_created'
  | 'camera_status_changed'
  | 'automation_triggered';

export interface WsEvent<T = unknown> {
  type: WsEventType;
  payload: T;
  timestamp: string;
}
