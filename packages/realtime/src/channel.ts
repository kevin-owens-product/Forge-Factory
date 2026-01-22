/**
 * @package @forge/realtime
 * @description Channel/room subscription management
 */

import { Connection } from './connection';
import {
  ChannelConfig,
  ChannelState,
  ChannelInfo,
  ChannelEvent,
  ChannelHandle,
  SubscribeOptions,
  Message,
  MessageType,
  MessageHandler,
  Unsubscribe,
  PresenceState,
  PresenceMember,
  ConnectionEvent,
} from './realtime.types';

/**
 * Event handler type
 */
type EventHandler = (...args: unknown[]) => void;

/**
 * Channel subscription
 */
export class Channel implements ChannelHandle {
  readonly name: string;
  private config: ChannelConfig;
  private connection: Connection;
  private _state: ChannelState = ChannelState.UNSUBSCRIBED;
  private eventHandlers: Map<string, Set<MessageHandler>> = new Map();
  private channelEventHandlers: Map<ChannelEvent, Set<EventHandler>> = new Map();
  private subscribedAt: Date | null = null;
  private presenceState: PresenceState | null = null;
  private presenceHandlers: {
    join: Set<(member: PresenceMember) => void>;
    leave: Set<(member: PresenceMember) => void>;
    update: Set<(member: PresenceMember) => void>;
  } = {
    join: new Set(),
    leave: new Set(),
    update: new Set(),
  };

  constructor(config: ChannelConfig, connection: Connection) {
    this.name = config.name;
    this.config = config;
    this.connection = connection;

    // Listen for messages from this channel
    this.connection.on(ConnectionEvent.MESSAGE, (...args: unknown[]) => {
      const message = args[0] as Message;
      if (message.channel === this.name) {
        this.handleMessage(message);
      }
    });
  }

  /**
   * Get current channel state
   */
  get state(): ChannelState {
    return this._state;
  }

  /**
   * Get channel info
   */
  getInfo(): ChannelInfo {
    return {
      name: this.name,
      state: this._state,
      presence: this.config.presence ?? false,
      subscribedAt: this.subscribedAt ?? undefined,
    };
  }

  /**
   * Subscribe to channel
   */
  subscribe(options?: SubscribeOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._state === ChannelState.SUBSCRIBED) {
        resolve();
        return;
      }

      if (this._state === ChannelState.SUBSCRIBING) {
        reject(new Error('Subscription already in progress'));
        return;
      }

      this.setState(ChannelState.SUBSCRIBING);

      const message: Message = {
        type: MessageType.SUBSCRIBE,
        channel: this.name,
        payload: {
          private: this.config.private,
          presence: this.config.presence,
          history: options?.history,
          historyCount: options?.historyCount,
          presenceData: options?.presenceData,
          metadata: this.config.metadata,
        },
      };

      this.connection.sendWithAck(message, 10000)
        .then((response) => {
          if (response.error) {
            this.setState(ChannelState.ERROR);
            this.emitChannelEvent(ChannelEvent.ERROR, new Error(response.error.message));
            reject(new Error(response.error.message));
            return;
          }

          this.setState(ChannelState.SUBSCRIBED);
          this.subscribedAt = new Date();
          this.emitChannelEvent(ChannelEvent.SUBSCRIBED);

          // Initialize presence if applicable
          if (this.config.presence && response.payload) {
            const payload = response.payload as { presence?: { members?: Array<{ id: string; data?: Record<string, unknown>; joinedAt?: string }> } };
            this.initializePresence(payload.presence);
          }

          resolve();
        })
        .catch((error) => {
          this.setState(ChannelState.ERROR);
          this.emitChannelEvent(ChannelEvent.ERROR, error);
          reject(error);
        });
    });
  }

  /**
   * Unsubscribe from channel
   */
  unsubscribe(): void {
    if (this._state === ChannelState.UNSUBSCRIBED) {
      return;
    }

    this.setState(ChannelState.UNSUBSCRIBING);

    this.connection.send({
      type: MessageType.UNSUBSCRIBE,
      channel: this.name,
    });

    this.cleanup();
    this.setState(ChannelState.UNSUBSCRIBED);
    this.emitChannelEvent(ChannelEvent.UNSUBSCRIBED);
  }

  /**
   * Publish message to channel
   */
  publish<T>(event: string, data: T): void {
    if (this._state !== ChannelState.SUBSCRIBED) {
      throw new Error('Cannot publish: not subscribed to channel');
    }

    this.connection.send({
      type: MessageType.PUBLISH,
      channel: this.name,
      payload: {
        event,
        data,
      },
    });
  }

  /**
   * Subscribe to channel events
   */
  on<T>(event: string, handler: MessageHandler<T>): Unsubscribe {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler as MessageHandler);
    return () => this.off(event, handler);
  }

  /**
   * Unsubscribe from channel events
   */
  off<T>(event: string, handler: MessageHandler<T>): void {
    this.eventHandlers.get(event)?.delete(handler as MessageHandler);
  }

  /**
   * Subscribe to channel state events
   */
  onChannelEvent(event: ChannelEvent, handler: EventHandler): Unsubscribe {
    if (!this.channelEventHandlers.has(event)) {
      this.channelEventHandlers.set(event, new Set());
    }
    this.channelEventHandlers.get(event)!.add(handler);
    return () => this.offChannelEvent(event, handler);
  }

  /**
   * Unsubscribe from channel state events
   */
  offChannelEvent(event: ChannelEvent, handler: EventHandler): void {
    this.channelEventHandlers.get(event)?.delete(handler);
  }

  /**
   * Get presence interface (for presence channels)
   */
  get presence() {
    if (!this.config.presence) {
      return undefined;
    }

    return {
      get: () => this.getPresence(),
      update: (data: Record<string, unknown>) => this.updatePresence(data),
      onJoin: (handler: (member: PresenceMember) => void) => {
        this.presenceHandlers.join.add(handler);
        return () => this.presenceHandlers.join.delete(handler);
      },
      onLeave: (handler: (member: PresenceMember) => void) => {
        this.presenceHandlers.leave.add(handler);
        return () => this.presenceHandlers.leave.delete(handler);
      },
      onUpdate: (handler: (member: PresenceMember) => void) => {
        this.presenceHandlers.update.add(handler);
        return () => this.presenceHandlers.update.delete(handler);
      },
    };
  }

  /**
   * Get presence state
   */
  getPresence(): PresenceState {
    if (!this.presenceState) {
      this.presenceState = {
        channel: this.name,
        members: new Map(),
      };
    }
    return this.presenceState;
  }

  /**
   * Update presence data
   */
  updatePresence(data: Record<string, unknown>): void {
    if (!this.config.presence) {
      throw new Error('Cannot update presence: not a presence channel');
    }

    this.connection.send({
      type: MessageType.PRESENCE_UPDATE,
      channel: this.name,
      payload: { data },
    });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: Message): void {
    switch (message.type) {
      case MessageType.MESSAGE:
        this.handleChannelMessage(message);
        break;
      case MessageType.BROADCAST:
        this.handleBroadcast(message);
        break;
      case MessageType.PRESENCE_JOIN:
        this.handlePresenceJoin(message);
        break;
      case MessageType.PRESENCE_LEAVE:
        this.handlePresenceLeave(message);
        break;
      case MessageType.PRESENCE_UPDATE:
        this.handlePresenceUpdate(message);
        break;
      case MessageType.PRESENCE_SYNC:
        this.handlePresenceSync(message);
        break;
      case MessageType.SUBSCRIBE_ACK:
        // Handled by sendWithAck
        break;
      case MessageType.UNSUBSCRIBE_ACK:
        // Already handled
        break;
      case MessageType.ERROR:
        this.emitChannelEvent(ChannelEvent.ERROR, new Error(message.error?.message || 'Unknown error'));
        break;
    }
  }

  /**
   * Handle channel message
   */
  private handleChannelMessage(message: Message): void {
    const payload = message.payload as { event?: string; data?: unknown } | undefined;
    const event = payload?.event || 'message';
    const data = payload?.data;

    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const eventMessage: Message = {
        ...message,
        payload: data,
      };
      handlers.forEach((handler) => {
        try {
          handler(eventMessage);
        } catch (error) {
          console.error('Message handler error:', error);
        }
      });
    }

    // Also emit to 'message' handlers
    this.emitChannelEvent(ChannelEvent.MESSAGE, message);
  }

  /**
   * Handle broadcast message
   */
  private handleBroadcast(message: Message): void {
    const payload = message.payload as { event?: string; data?: unknown } | undefined;
    const event = payload?.event || 'broadcast';
    const data = payload?.data;

    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const eventMessage: Message = {
        ...message,
        payload: data,
      };
      handlers.forEach((handler) => {
        try {
          handler(eventMessage);
        } catch (error) {
          console.error('Broadcast handler error:', error);
        }
      });
    }
  }

  /**
   * Initialize presence state
   */
  private initializePresence(presence?: { members?: Array<{ id: string; data?: Record<string, unknown>; joinedAt?: string }> }): void {
    this.presenceState = {
      channel: this.name,
      members: new Map(),
    };

    if (presence?.members) {
      for (const member of presence.members) {
        this.presenceState.members.set(member.id, {
          id: member.id,
          data: member.data,
          joinedAt: member.joinedAt ? new Date(member.joinedAt) : new Date(),
          online: true,
        });
      }
    }
  }

  /**
   * Handle presence join
   */
  private handlePresenceJoin(message: Message): void {
    const payload = message.payload as { id: string; name?: string; data?: Record<string, unknown> } | undefined;
    if (!payload) return;

    const member: PresenceMember = {
      id: payload.id,
      name: payload.name,
      data: payload.data,
      joinedAt: new Date(),
      online: true,
    };

    if (this.presenceState) {
      this.presenceState.members.set(member.id, member);
    }

    this.presenceHandlers.join.forEach((handler) => {
      try {
        handler(member);
      } catch (error) {
        console.error('Presence join handler error:', error);
      }
    });
  }

  /**
   * Handle presence leave
   */
  private handlePresenceLeave(message: Message): void {
    const payload = message.payload as { id: string } | undefined;
    if (!payload) return;

    const member = this.presenceState?.members.get(payload.id);
    if (member) {
      this.presenceState?.members.delete(payload.id);

      this.presenceHandlers.leave.forEach((handler) => {
        try {
          handler(member);
        } catch (error) {
          console.error('Presence leave handler error:', error);
        }
      });
    }
  }

  /**
   * Handle presence update
   */
  private handlePresenceUpdate(message: Message): void {
    const payload = message.payload as { id: string; data?: Record<string, unknown> } | undefined;
    if (!payload) return;

    const existingMember = this.presenceState?.members.get(payload.id);
    if (existingMember) {
      const updatedMember: PresenceMember = {
        ...existingMember,
        data: { ...existingMember.data, ...payload.data },
        updatedAt: new Date(),
      };
      this.presenceState?.members.set(payload.id, updatedMember);

      this.presenceHandlers.update.forEach((handler) => {
        try {
          handler(updatedMember);
        } catch (error) {
          console.error('Presence update handler error:', error);
        }
      });
    }
  }

  /**
   * Handle presence sync
   */
  private handlePresenceSync(message: Message): void {
    const payload = message.payload as { members?: Array<{ id: string; name?: string; data?: Record<string, unknown>; joinedAt?: string }> } | undefined;
    if (!payload?.members) return;

    this.presenceState = {
      channel: this.name,
      members: new Map(),
    };

    for (const m of payload.members) {
      this.presenceState.members.set(m.id, {
        id: m.id,
        name: m.name,
        data: m.data,
        joinedAt: m.joinedAt ? new Date(m.joinedAt) : new Date(),
        online: true,
      });
    }
  }

  /**
   * Set channel state
   */
  private setState(state: ChannelState): void {
    this._state = state;
  }

  /**
   * Emit channel event
   */
  private emitChannelEvent(event: ChannelEvent, ...args: unknown[]): void {
    const handlers = this.channelEventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(...args);
        } catch (error) {
          console.error('Channel event handler error:', error);
        }
      });
    }
  }

  /**
   * Cleanup channel resources
   */
  private cleanup(): void {
    this.eventHandlers.clear();
    this.subscribedAt = null;
    this.presenceState = null;
    this.presenceHandlers.join.clear();
    this.presenceHandlers.leave.clear();
    this.presenceHandlers.update.clear();
  }
}

/**
 * Channel manager for handling multiple channels
 */
export class ChannelManager {
  private channels: Map<string, Channel> = new Map();
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Get or create a channel
   */
  channel(name: string, config?: Partial<ChannelConfig>): Channel {
    let channel = this.channels.get(name);
    if (!channel) {
      channel = new Channel(
        { name, ...config },
        this.connection
      );
      this.channels.set(name, channel);
    }
    return channel;
  }

  /**
   * Get a channel if it exists
   */
  getChannel(name: string): Channel | undefined {
    return this.channels.get(name);
  }

  /**
   * Check if subscribed to channel
   */
  isSubscribed(name: string): boolean {
    const channel = this.channels.get(name);
    return channel?.state === ChannelState.SUBSCRIBED;
  }

  /**
   * Get all channels
   */
  getChannels(): Channel[] {
    return Array.from(this.channels.values());
  }

  /**
   * Get subscribed channels
   */
  getSubscribedChannels(): Channel[] {
    return this.getChannels().filter((ch) => ch.state === ChannelState.SUBSCRIBED);
  }

  /**
   * Unsubscribe from all channels
   */
  unsubscribeAll(): void {
    for (const channel of this.channels.values()) {
      if (channel.state === ChannelState.SUBSCRIBED) {
        channel.unsubscribe();
      }
    }
  }

  /**
   * Remove a channel
   */
  removeChannel(name: string): void {
    const channel = this.channels.get(name);
    if (channel) {
      channel.unsubscribe();
      this.channels.delete(name);
    }
  }

  /**
   * Clear all channels
   */
  clear(): void {
    this.unsubscribeAll();
    this.channels.clear();
  }
}

/**
 * Create a channel manager
 */
export function createChannelManager(connection: Connection): ChannelManager {
  return new ChannelManager(connection);
}
