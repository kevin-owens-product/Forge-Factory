/**
 * @package @forge/realtime
 * @description Main realtime service for managing connections and channels
 */

import { Connection, createConnection } from './connection';
import { ChannelManager, Channel } from './channel';
import { PresenceManager, createPresenceManager } from './presence';
import {
  RealtimeConfig,
  ConnectionState,
  ConnectionStats,
  ChannelHandle,
  SubscribeOptions,
  PresenceState,
  Message,
  ConnectionEvent,
  Unsubscribe,
} from './realtime.types';

/**
 * Realtime service for WebSocket communication
 */
export class RealtimeService {
  private connection: Connection;
  private channelManager: ChannelManager;
  private presenceManagers: Map<string, PresenceManager> = new Map();
  private config: RealtimeConfig;
  private eventHandlers: Map<string, Set<(...args: unknown[]) => void>> = new Map();

  constructor(config: RealtimeConfig) {
    this.config = config;
    this.connection = createConnection(config);
    this.channelManager = new ChannelManager(this.connection);

    // Set up connection event forwarding
    this.setupConnectionEvents();
  }

  /**
   * Get connection state
   */
  getConnectionState(): ConnectionState {
    return this.connection.getState();
  }

  /**
   * Get connection statistics
   */
  getStats(): ConnectionStats {
    return this.connection.getStats();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connection.isConnected();
  }

  /**
   * Connect to the realtime server
   */
  async connect(): Promise<void> {
    await this.connection.connect();
  }

  /**
   * Disconnect from the realtime server
   */
  disconnect(): void {
    // Unsubscribe from all channels
    this.channelManager.unsubscribeAll();

    // Clean up presence managers
    for (const manager of this.presenceManagers.values()) {
      manager.cleanup();
    }
    this.presenceManagers.clear();

    // Disconnect
    this.connection.disconnect();
  }

  /**
   * Subscribe to a channel
   */
  async subscribe(channelName: string, options?: SubscribeOptions): Promise<ChannelHandle> {
    const channel = this.channelManager.channel(channelName, {
      presence: options?.presenceData !== undefined,
    });

    await channel.subscribe(options);
    return channel;
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channelName: string): void {
    this.channelManager.removeChannel(channelName);
    this.presenceManagers.delete(channelName);
  }

  /**
   * Get a channel
   */
  channel(channelName: string): Channel | undefined {
    return this.channelManager.getChannel(channelName);
  }

  /**
   * Publish a message to a channel
   */
  publish<T>(channelName: string, event: string, data: T): void {
    const channel = this.channelManager.getChannel(channelName);
    if (channel) {
      channel.publish(event, data);
    } else {
      throw new Error(`Not subscribed to channel: ${channelName}`);
    }
  }

  /**
   * Get presence for a channel
   */
  getPresence(channelName: string): PresenceState | null {
    const manager = this.presenceManagers.get(channelName);
    if (manager) {
      return manager.getState();
    }

    const channel = this.channelManager.getChannel(channelName);
    if (channel?.presence) {
      return channel.presence.get();
    }

    return null;
  }

  /**
   * Update presence data for a channel
   */
  updatePresence(channelName: string, data: Record<string, unknown>): void {
    const channel = this.channelManager.getChannel(channelName);
    if (channel?.presence) {
      channel.presence.update(data);
    } else {
      const manager = this.presenceManagers.get(channelName);
      if (manager) {
        manager.update(data);
      } else {
        throw new Error(`Not tracking presence for channel: ${channelName}`);
      }
    }
  }

  /**
   * Join presence for a channel
   */
  joinPresence(channelName: string, userId: string, data?: Record<string, unknown>): PresenceManager {
    let manager = this.presenceManagers.get(channelName);
    if (!manager) {
      manager = createPresenceManager(channelName, this.connection);
      this.presenceManagers.set(channelName, manager);
    }
    manager.join(userId, data);
    return manager;
  }

  /**
   * Leave presence for a channel
   */
  leavePresence(channelName: string): void {
    const manager = this.presenceManagers.get(channelName);
    if (manager) {
      manager.leave();
    }
  }

  /**
   * Subscribe to connection events
   */
  on(event: 'connected' | 'disconnected' | 'reconnecting' | 'reconnected' | 'error' | 'message', handler: (...args: unknown[]) => void): Unsubscribe {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  /**
   * Unsubscribe from connection events
   */
  off(event: string, handler: (...args: unknown[]) => void): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Send raw message
   */
  send<T>(message: Message<T>): void {
    this.connection.send(message);
  }

  /**
   * Get all subscribed channels
   */
  getSubscribedChannels(): Channel[] {
    return this.channelManager.getSubscribedChannels();
  }

  /**
   * Check if subscribed to a channel
   */
  isSubscribed(channelName: string): boolean {
    return this.channelManager.isSubscribed(channelName);
  }

  /**
   * Set up connection event forwarding
   */
  private setupConnectionEvents(): void {
    this.connection.on(ConnectionEvent.CONNECTED, () => {
      this.emit('connected');
      this.config.onConnectionChange?.(ConnectionState.CONNECTED);
    });

    this.connection.on(ConnectionEvent.DISCONNECTED, (...args) => {
      this.emit('disconnected', ...args);
      this.config.onConnectionChange?.(ConnectionState.DISCONNECTED);
    });

    this.connection.on(ConnectionEvent.RECONNECTING, (...args) => {
      this.emit('reconnecting', ...args);
      this.config.onConnectionChange?.(ConnectionState.RECONNECTING);
    });

    this.connection.on(ConnectionEvent.RECONNECTED, () => {
      this.emit('reconnected');
      // Re-subscribe to channels after reconnection
      this.resubscribeChannels();
    });

    this.connection.on(ConnectionEvent.ERROR, (error) => {
      this.emit('error', error);
      this.config.onError?.(error as Error);
    });

    this.connection.on(ConnectionEvent.MESSAGE, (message) => {
      this.emit('message', message);
    });
  }

  /**
   * Re-subscribe to channels after reconnection
   */
  private async resubscribeChannels(): Promise<void> {
    const channels = this.channelManager.getSubscribedChannels();
    for (const channel of channels) {
      try {
        await channel.subscribe();
      } catch (error) {
        console.error(`Failed to resubscribe to channel ${channel.name}:`, error);
      }
    }
  }

  /**
   * Emit event to handlers
   */
  private emit(event: string, ...args: unknown[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(...args);
        } catch (error) {
          console.error('Event handler error:', error);
        }
      });
    }
  }
}

/**
 * Create a realtime service instance
 */
export function createRealtimeService(config: RealtimeConfig): RealtimeService {
  return new RealtimeService(config);
}
