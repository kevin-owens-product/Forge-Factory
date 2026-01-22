/**
 * @package @forge/realtime
 * @description Presence tracking for real-time user status
 */

import { Connection } from './connection';
import {
  PresenceState,
  PresenceMember,
  PresenceUpdate,
  PresenceConfig,
  PresenceEvent,
  Message,
  MessageType,
  Unsubscribe,
  ConnectionEvent,
} from './realtime.types';

/**
 * Default presence configuration
 */
export const DEFAULT_PRESENCE_CONFIG: Required<PresenceConfig> = {
  data: {},
  trackUpdates: true,
  heartbeatInterval: 60000,
};

/**
 * Presence manager for a channel
 */
export class PresenceManager<T = Record<string, unknown>> {
  private channel: string;
  private connection: Connection;
  private config: Required<PresenceConfig>;
  private members: Map<string, PresenceMember<T>> = new Map();
  private currentMember: PresenceMember<T> | null = null;
  private synced = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  private eventHandlers: {
    [PresenceEvent.JOIN]: Set<(member: PresenceMember<T>) => void>;
    [PresenceEvent.LEAVE]: Set<(member: PresenceMember<T>) => void>;
    [PresenceEvent.UPDATE]: Set<(member: PresenceMember<T>) => void>;
    [PresenceEvent.SYNC]: Set<(members: PresenceMember<T>[]) => void>;
  } = {
    [PresenceEvent.JOIN]: new Set(),
    [PresenceEvent.LEAVE]: new Set(),
    [PresenceEvent.UPDATE]: new Set(),
    [PresenceEvent.SYNC]: new Set(),
  };

  constructor(channel: string, connection: Connection, config?: PresenceConfig) {
    this.channel = channel;
    this.connection = connection;
    this.config = { ...DEFAULT_PRESENCE_CONFIG, ...config };

    // Listen for presence messages
    this.connection.on(ConnectionEvent.MESSAGE, (...args: unknown[]) => {
      const message = args[0] as Message;
      if (message.channel === this.channel) {
        this.handleMessage(message);
      }
    });
  }

  /**
   * Get current presence state
   */
  getState(): PresenceState<T> {
    return {
      channel: this.channel,
      members: new Map(this.members),
      me: this.currentMember ?? undefined,
    };
  }

  /**
   * Get all members
   */
  getMembers(): PresenceMember<T>[] {
    return Array.from(this.members.values());
  }

  /**
   * Get member by ID
   */
  getMember(id: string): PresenceMember<T> | undefined {
    return this.members.get(id);
  }

  /**
   * Get current user
   */
  getMe(): PresenceMember<T> | null {
    return this.currentMember;
  }

  /**
   * Get member count
   */
  getMemberCount(): number {
    return this.members.size;
  }

  /**
   * Check if presence is synced
   */
  isSynced(): boolean {
    return this.synced;
  }

  /**
   * Join presence (track current user)
   */
  join(userId: string, data?: T): void {
    this.currentMember = {
      id: userId,
      data,
      joinedAt: new Date(),
      online: true,
    };

    this.connection.send({
      type: MessageType.PRESENCE_JOIN,
      channel: this.channel,
      payload: {
        id: userId,
        data,
      },
    });

    // Start heartbeat
    this.startHeartbeat();
  }

  /**
   * Leave presence
   */
  leave(): void {
    if (!this.currentMember) return;

    this.connection.send({
      type: MessageType.PRESENCE_LEAVE,
      channel: this.channel,
      payload: {
        id: this.currentMember.id,
      },
    });

    this.stopHeartbeat();
    this.currentMember = null;
  }

  /**
   * Update presence data
   */
  update(data: Partial<T>): void {
    if (!this.currentMember) {
      throw new Error('Not joined to presence');
    }

    const newData = { ...this.currentMember.data, ...data } as T;
    this.currentMember = {
      ...this.currentMember,
      data: newData,
      updatedAt: new Date(),
    };

    this.connection.send({
      type: MessageType.PRESENCE_UPDATE,
      channel: this.channel,
      payload: {
        id: this.currentMember.id,
        data: newData,
      },
    });
  }

  /**
   * Subscribe to presence events
   */
  on(
    event: PresenceEvent,
    handler: ((member: PresenceMember<T>) => void) | ((members: PresenceMember<T>[]) => void)
  ): Unsubscribe {
    if (event === PresenceEvent.SYNC) {
      this.eventHandlers[event].add(handler as (members: PresenceMember<T>[]) => void);
    } else {
      this.eventHandlers[event].add(handler as (member: PresenceMember<T>) => void);
    }
    return () => this.off(event, handler);
  }

  /**
   * Unsubscribe from presence events
   */
  off(
    event: PresenceEvent,
    handler: ((member: PresenceMember<T>) => void) | ((members: PresenceMember<T>[]) => void)
  ): void {
    if (event === PresenceEvent.SYNC) {
      this.eventHandlers[event].delete(handler as (members: PresenceMember<T>[]) => void);
    } else {
      this.eventHandlers[event].delete(handler as (member: PresenceMember<T>) => void);
    }
  }

  /**
   * Cleanup presence manager
   */
  cleanup(): void {
    this.stopHeartbeat();
    this.members.clear();
    this.currentMember = null;
    this.synced = false;
    this.eventHandlers[PresenceEvent.JOIN].clear();
    this.eventHandlers[PresenceEvent.LEAVE].clear();
    this.eventHandlers[PresenceEvent.UPDATE].clear();
    this.eventHandlers[PresenceEvent.SYNC].clear();
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: Message): void {
    switch (message.type) {
      case MessageType.PRESENCE_JOIN:
        this.handleJoin(message);
        break;
      case MessageType.PRESENCE_LEAVE:
        this.handleLeave(message);
        break;
      case MessageType.PRESENCE_UPDATE:
        this.handleUpdate(message);
        break;
      case MessageType.PRESENCE_SYNC:
        this.handleSync(message);
        break;
      case MessageType.PRESENCE_STATE:
        this.handleState(message);
        break;
    }
  }

  /**
   * Handle member join
   */
  private handleJoin(message: Message): void {
    const payload = message.payload as { id: string; name?: string; data?: T } | undefined;
    if (!payload) return;

    const member: PresenceMember<T> = {
      id: payload.id,
      name: payload.name,
      data: payload.data,
      joinedAt: new Date(),
      online: true,
    };

    this.members.set(member.id, member);
    this.emit(PresenceEvent.JOIN, member);
  }

  /**
   * Handle member leave
   */
  private handleLeave(message: Message): void {
    const payload = message.payload as { id: string } | undefined;
    if (!payload) return;

    const member = this.members.get(payload.id);
    if (member) {
      this.members.delete(payload.id);
      this.emit(PresenceEvent.LEAVE, member);
    }
  }

  /**
   * Handle member update
   */
  private handleUpdate(message: Message): void {
    const payload = message.payload as { id: string; data?: T } | undefined;
    if (!payload) return;

    const existingMember = this.members.get(payload.id);
    if (existingMember) {
      const updatedMember: PresenceMember<T> = {
        ...existingMember,
        data: payload.data !== undefined ? { ...existingMember.data, ...payload.data } : existingMember.data,
        updatedAt: new Date(),
      };
      this.members.set(payload.id, updatedMember);
      this.emit(PresenceEvent.UPDATE, updatedMember);
    }
  }

  /**
   * Handle presence sync (full state)
   */
  private handleSync(message: Message): void {
    const payload = message.payload as { members?: Array<{ id: string; name?: string; data?: T; joinedAt?: string }> } | undefined;
    if (!payload?.members) return;

    this.members.clear();

    for (const m of payload.members) {
      const member: PresenceMember<T> = {
        id: m.id,
        name: m.name,
        data: m.data,
        joinedAt: m.joinedAt ? new Date(m.joinedAt) : new Date(),
        online: true,
      };
      this.members.set(member.id, member);
    }

    this.synced = true;
    this.emitSync(Array.from(this.members.values()));
  }

  /**
   * Handle presence state response
   */
  private handleState(message: Message): void {
    // Same as sync for now
    this.handleSync(message);
  }

  /**
   * Emit presence event
   */
  private emit(event: PresenceEvent.JOIN | PresenceEvent.LEAVE | PresenceEvent.UPDATE, member: PresenceMember<T>): void {
    const handlers = this.eventHandlers[event];
    handlers.forEach((handler) => {
      try {
        handler(member);
      } catch (error) {
        console.error(`Presence ${event} handler error:`, error);
      }
    });
  }

  /**
   * Emit sync event
   */
  private emitSync(members: PresenceMember<T>[]): void {
    const handlers = this.eventHandlers[PresenceEvent.SYNC];
    handlers.forEach((handler) => {
      try {
        handler(members);
      } catch (error) {
        console.error('Presence sync handler error:', error);
      }
    });
  }

  /**
   * Start presence heartbeat
   */
  private startHeartbeat(): void {
    if (!this.config.trackUpdates) return;

    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.currentMember) {
        // Send heartbeat to keep presence alive
        this.connection.send({
          type: MessageType.PRESENCE_UPDATE,
          channel: this.channel,
          payload: {
            id: this.currentMember.id,
            heartbeat: true,
          },
        });
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop presence heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

/**
 * Create presence update event
 */
export function createPresenceUpdate<T>(
  channel: string,
  member: PresenceMember<T>,
  type: 'join' | 'leave' | 'update'
): PresenceUpdate<T> {
  return {
    channel,
    member,
    type,
  };
}

/**
 * Create a presence manager
 */
export function createPresenceManager<T = Record<string, unknown>>(
  channel: string,
  connection: Connection,
  config?: PresenceConfig
): PresenceManager<T> {
  return new PresenceManager<T>(channel, connection, config);
}
