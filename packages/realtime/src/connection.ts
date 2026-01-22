/**
 * @package @forge/realtime
 * @description WebSocket connection management
 */

import {
  ConnectionConfig,
  ConnectionState,
  ConnectionStats,
  ConnectionEvent,
  Message,
  MessageType,
  Unsubscribe,
} from './realtime.types';

/**
 * Default connection configuration
 */
export const DEFAULT_CONNECTION_CONFIG: Required<Omit<ConnectionConfig, 'url' | 'token' | 'tenantId' | 'headers'>> = {
  connectionTimeout: 10000,
  autoReconnect: true,
  reconnect: {
    enabled: true,
    maxAttempts: 10,
    initialDelay: 1000,
    maxDelay: 30000,
    multiplier: 2,
    jitter: true,
  },
  heartbeat: {
    enabled: true,
    interval: 30000,
    timeout: 10000,
  },
  debug: false,
};

/**
 * Event handler type
 */
type EventHandler = (...args: unknown[]) => void;

/**
 * WebSocket connection manager
 */
export class Connection {
  private ws: WebSocket | null = null;
  private config: ConnectionConfig;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  private connectionTimer: ReturnType<typeof setTimeout> | null = null;
  private eventHandlers: Map<ConnectionEvent, Set<EventHandler>> = new Map();
  private messageQueue: Message[] = [];
  private connectedAt: Date | null = null;
  private lastActivity: Date | null = null;
  private messagesSent = 0;
  private messagesReceived = 0;
  private lastLatency: number | null = null;
  private pingTimestamp: number | null = null;
  private pendingAcks: Map<string, { resolve: (msg: Message) => void; reject: (err: Error) => void; timeout: ReturnType<typeof setTimeout> }> = new Map();

  constructor(config: ConnectionConfig) {
    this.config = { ...DEFAULT_CONNECTION_CONFIG, ...config };
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get connection statistics
   */
  getStats(): ConnectionStats {
    const now = new Date();
    return {
      state: this.state,
      reconnectAttempts: this.reconnectAttempts,
      messagesSent: this.messagesSent,
      messagesReceived: this.messagesReceived,
      uptime: this.connectedAt ? now.getTime() - this.connectedAt.getTime() : 0,
      latency: this.lastLatency ?? undefined,
      connectedAt: this.connectedAt ?? undefined,
      lastActivity: this.lastActivity ?? undefined,
    };
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.state === ConnectionState.CONNECTED) {
        resolve();
        return;
      }

      if (this.state === ConnectionState.CONNECTING) {
        reject(new Error('Connection already in progress'));
        return;
      }

      this.setState(ConnectionState.CONNECTING);

      try {
        const url = this.buildUrl();
        this.log('Connecting to', url);
        this.ws = new WebSocket(url);

        // Set connection timeout
        const timeout = this.config.connectionTimeout ?? DEFAULT_CONNECTION_CONFIG.connectionTimeout;
        this.connectionTimer = setTimeout(() => {
          if (this.state === ConnectionState.CONNECTING) {
            this.ws?.close();
            this.setState(ConnectionState.FAILED);
            reject(new Error('Connection timeout'));
          }
        }, timeout);

        this.ws.onopen = () => {
          this.clearConnectionTimeout();
          this.onConnected();
          resolve();
        };

        this.ws.onclose = (event) => {
          this.onDisconnected(event);
        };

        this.ws.onerror = (event) => {
          this.onError(event);
          if (this.state === ConnectionState.CONNECTING) {
            reject(new Error('Connection failed'));
          }
        };

        this.ws.onmessage = (event) => {
          this.onMessage(event);
        };
      } catch (error) {
        this.setState(ConnectionState.FAILED);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.log('Disconnecting');
    this.cleanup();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.setState(ConnectionState.DISCONNECTED);
  }

  /**
   * Send a message
   */
  send<T>(message: Message<T>): void {
    if (!this.ws || this.state !== ConnectionState.CONNECTED) {
      this.messageQueue.push(message as Message);
      return;
    }

    const data = JSON.stringify({
      ...message,
      timestamp: Date.now(),
    });

    this.ws.send(data);
    this.messagesSent++;
    this.lastActivity = new Date();
    this.log('Sent:', message.type, message.channel);
  }

  /**
   * Send a message and wait for acknowledgment
   */
  sendWithAck<T>(message: Message<T>, timeout = 5000): Promise<Message> {
    return new Promise((resolve, reject) => {
      const id = message.id || this.generateId();
      const msgWithId = { ...message, id };

      const timeoutHandle = setTimeout(() => {
        this.pendingAcks.delete(id);
        reject(new Error('Acknowledgment timeout'));
      }, timeout);

      this.pendingAcks.set(id, { resolve, reject, timeout: timeoutHandle });
      this.send(msgWithId);
    });
  }

  /**
   * Subscribe to connection events
   */
  on(event: ConnectionEvent, handler: EventHandler): Unsubscribe {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  /**
   * Unsubscribe from connection events
   */
  off(event: ConnectionEvent, handler: EventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === ConnectionState.CONNECTED;
  }

  /**
   * Build WebSocket URL with query parameters
   */
  private buildUrl(): string {
    const url = new URL(this.config.url);

    if (this.config.token) {
      url.searchParams.set('token', this.config.token);
    }

    if (this.config.tenantId) {
      url.searchParams.set('tenantId', this.config.tenantId);
    }

    if (this.config.headers) {
      for (const [key, value] of Object.entries(this.config.headers)) {
        url.searchParams.set(key, value);
      }
    }

    return url.toString();
  }

  /**
   * Handle connection established
   */
  private onConnected(): void {
    this.log('Connected');
    this.setState(ConnectionState.CONNECTED);
    this.connectedAt = new Date();
    this.lastActivity = new Date();
    this.reconnectAttempts = 0;

    // Start heartbeat
    this.startHeartbeat();

    // Flush message queue
    this.flushMessageQueue();

    // Emit connected event
    this.emit(ConnectionEvent.CONNECTED);
  }

  /**
   * Handle disconnection
   */
  private onDisconnected(event: CloseEvent): void {
    this.log('Disconnected:', event.code, event.reason);
    this.cleanup();

    const wasConnected = this.state === ConnectionState.CONNECTED;
    this.ws = null;

    // Check if we should reconnect
    if (wasConnected && this.config.autoReconnect && this.config.reconnect?.enabled) {
      this.scheduleReconnect();
    } else {
      this.setState(ConnectionState.DISCONNECTED);
    }

    this.emit(ConnectionEvent.DISCONNECTED, { code: event.code, reason: event.reason });
  }

  /**
   * Handle connection error
   */
  private onError(event: Event): void {
    this.log('Error:', event);
    this.emit(ConnectionEvent.ERROR, new Error('WebSocket error'));
  }

  /**
   * Handle incoming message
   */
  private onMessage(event: MessageEvent): void {
    this.messagesReceived++;
    this.lastActivity = new Date();

    try {
      const message = JSON.parse(event.data as string) as Message;
      this.log('Received:', message.type, message.channel);

      // Handle pong response
      if (message.type === MessageType.PONG) {
        this.handlePong();
        return;
      }

      // Handle acknowledgment
      if (message.id && this.pendingAcks.has(message.id)) {
        const pending = this.pendingAcks.get(message.id)!;
        clearTimeout(pending.timeout);
        this.pendingAcks.delete(message.id);
        pending.resolve(message);
        return;
      }

      // Emit message event
      this.emit(ConnectionEvent.MESSAGE, message);
    } catch (error) {
      this.log('Failed to parse message:', error);
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    const reconnectConfig = this.config.reconnect!;
    const maxAttempts = reconnectConfig.maxAttempts ?? DEFAULT_CONNECTION_CONFIG.reconnect.maxAttempts!;

    if (this.reconnectAttempts >= maxAttempts) {
      this.log('Max reconnection attempts reached');
      this.setState(ConnectionState.FAILED);
      return;
    }

    this.setState(ConnectionState.RECONNECTING);
    this.reconnectAttempts++;

    const delay = this.calculateReconnectDelay();
    this.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${maxAttempts})`);

    this.emit(ConnectionEvent.RECONNECTING, { attempt: this.reconnectAttempts, delay });

    this.reconnectTimer = setTimeout(() => {
      this.connect()
        .then(() => {
          this.emit(ConnectionEvent.RECONNECTED);
        })
        .catch(() => {
          this.scheduleReconnect();
        });
    }, delay);
  }

  /**
   * Calculate reconnect delay with exponential backoff
   */
  private calculateReconnectDelay(): number {
    const config = this.config.reconnect!;
    const initialDelay = config.initialDelay ?? DEFAULT_CONNECTION_CONFIG.reconnect.initialDelay!;
    const maxDelay = config.maxDelay ?? DEFAULT_CONNECTION_CONFIG.reconnect.maxDelay!;
    const multiplier = config.multiplier ?? DEFAULT_CONNECTION_CONFIG.reconnect.multiplier!;
    const jitter = config.jitter ?? DEFAULT_CONNECTION_CONFIG.reconnect.jitter;

    let delay = initialDelay * Math.pow(multiplier, this.reconnectAttempts - 1);
    delay = Math.min(delay, maxDelay);

    if (jitter) {
      // Add random jitter of +/- 25%
      const jitterRange = delay * 0.25;
      delay += Math.random() * jitterRange * 2 - jitterRange;
    }

    return Math.floor(delay);
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    const heartbeatConfig = this.config.heartbeat;
    if (!heartbeatConfig?.enabled) return;

    const interval = heartbeatConfig.interval ?? DEFAULT_CONNECTION_CONFIG.heartbeat.interval!;

    this.heartbeatTimer = setInterval(() => {
      this.sendPing();
    }, interval);
  }

  /**
   * Send ping
   */
  private sendPing(): void {
    if (!this.ws || this.state !== ConnectionState.CONNECTED) return;

    this.pingTimestamp = Date.now();
    this.send({ type: MessageType.PING });

    // Set timeout for pong response
    const timeout = this.config.heartbeat?.timeout ?? DEFAULT_CONNECTION_CONFIG.heartbeat.timeout!;
    this.heartbeatTimeout = setTimeout(() => {
      this.log('Heartbeat timeout - reconnecting');
      this.ws?.close(4000, 'Heartbeat timeout');
    }, timeout);
  }

  /**
   * Handle pong response
   */
  private handlePong(): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }

    if (this.pingTimestamp) {
      this.lastLatency = Date.now() - this.pingTimestamp;
      this.pingTimestamp = null;
    }
  }

  /**
   * Flush queued messages
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      this.send(message);
    }
  }

  /**
   * Set state and log
   */
  private setState(state: ConnectionState): void {
    this.log(`State: ${this.state} -> ${state}`);
    this.state = state;
  }

  /**
   * Emit event to handlers
   */
  private emit(event: ConnectionEvent, ...args: unknown[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(...args);
        } catch (error) {
          this.log('Event handler error:', error);
        }
      });
    }
  }

  /**
   * Clear connection timeout
   */
  private clearConnectionTimeout(): void {
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
  }

  /**
   * Cleanup timers and handlers
   */
  private cleanup(): void {
    this.clearConnectionTimeout();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }

    // Clear pending acks
    for (const [id, pending] of this.pendingAcks) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Connection closed'));
      this.pendingAcks.delete(id);
    }
  }

  /**
   * Generate unique message ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log debug message
   */
  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log('[Realtime]', ...args);
    }
  }
}

/**
 * Create a new connection instance
 */
export function createConnection(config: ConnectionConfig): Connection {
  return new Connection(config);
}
