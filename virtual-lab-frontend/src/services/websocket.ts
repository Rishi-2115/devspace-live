import { io, Socket } from 'socket.io-client';

export interface WebSocketConfig {
  url: string;
  namespace?: string;
  options?: any;
}

export class WebSocketService {
  private socket: Socket | null = null;
  private config: WebSocketConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 1000;
  private listeners: Map<string, Function[]> = new Map();

  constructor(config: WebSocketConfig) {
    this.config = config;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = this.config.namespace 
        ? `${this.config.url}${this.config.namespace}`
        : this.config.url;

      this.socket = io(url, {
        transports: ['websocket'],
        timeout: 5000,
        reconnection: false, // Handle reconnection manually
        ...this.config.options
      });

      this.socket.on('connect', () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.reattachListeners();
        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
        if (reason === 'io server disconnect') {
          this.handleReconnect();
        }
      });

      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        reject(error);
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit(event: string, data: any) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('WebSocket not connected, cannot emit event:', event);
    }
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);

    if (this.socket) {
      this.socket.on(event, callback as any);
    }
  }

  off(event: string, callback?: Function) {
    if (callback) {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        const index = eventListeners.indexOf(callback);
        if (index > -1) {
          eventListeners.splice(index, 1);
        }
      }

      if (this.socket) {
        this.socket.off(event, callback as any);
      }
    } else {
      this.listeners.delete(event);
      if (this.socket) {
        this.socket.off(event);
      }
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch(() => {
        this.handleReconnect();
      });
    }, this.reconnectInterval * this.reconnectAttempts);
  }

  private reattachListeners() {
    if (!this.socket) return;

    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach(callback => {
        this.socket!.on(event, callback as any);
      });
    });
  }

  get isConnected(): boolean {
    return this.socket?.connected || false;
  }

  get id(): string | undefined {
    return this.socket?.id;
  }
}

// Create singleton instances for different namespaces
export const collaborationWS = new WebSocketService({
  url: process.env.REACT_APP_WS_URL || 'ws://localhost:3001',
  namespace: '/collaboration'
});

export const terminalWS = new WebSocketService({
  url: process.env.REACT_APP_WS_URL || 'ws://localhost:3001',
  namespace: '/terminal'
});

export const resourcesWS = new WebSocketService({
  url: process.env.REACT_APP_WS_URL || 'ws://localhost:3001',
  namespace: '/resources'
});
