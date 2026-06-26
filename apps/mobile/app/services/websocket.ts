import * as SecureStore from 'expo-secure-store';
import type { WsEvent } from '@casa/shared';

type EventHandler = (event: WsEvent) => void;

const BASE_WS_URL = (process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000')
  .replace('https://', 'wss://')
  .replace('http://', 'ws://');

class CasaWebSocket {
  private ws: WebSocket | null = null;
  private handlers = new Set<EventHandler>();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  async connect(): Promise<void> {
    const token = await SecureStore.getItemAsync('access_token');
    const url = `${BASE_WS_URL}/api/ws/events?token=${token ?? ''}`;

    this.ws = new WebSocket(url);

    this.ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as WsEvent;
        this.handlers.forEach((h) => h(event));
      } catch {}
    };

    this.ws.onclose = () => {
      this.reconnectTimeout = setTimeout(() => this.connect(), 3000);
    };
  }

  disconnect(): void {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.ws?.close();
    this.ws = null;
  }

  subscribe(handler: EventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }
}

export const casaWs = new CasaWebSocket();
