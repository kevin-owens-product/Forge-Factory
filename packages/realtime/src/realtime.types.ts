/**
 * @package @forge/realtime
 * @description TypeScript interfaces and types for real-time communication
 */

// ============================================
// Connection Types
// ============================================

/**
 * WebSocket connection states
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed',
}

/**
 * Connection configuration
 */
export interface ConnectionConfig {
  /** WebSocket server URL */
  url: string;
  /** Authentication token */
  token?: string;
  /** Tenant ID for multi-tenant support */
  tenantId?: string;
  /** Custom headers (sent as query params) */
  headers?: Record<string, string>;
  /** Connection timeout in milliseconds */
  connectionTimeout?: number;
  /** Enable automatic reconnection */
  autoReconnect?: boolean;
  /** Reconnection configuration */
  reconnect?: ReconnectConfig;
  /** Heartbeat configuration */
  heartbeat?: HeartbeatConfig;
  /** Debug mode */
  debug?: boolean;
}

/**
 * Reconnection configuration
 */
export interface ReconnectConfig {
  /** Enable reconnection */
  enabled: boolean;
  /** Maximum reconnection attempts */
  maxAttempts?: number;
  /** Initial delay in milliseconds */
  initialDelay?: number;
  /** Maximum delay in milliseconds */
  maxDelay?: number;
  /** Backoff multiplier */
  multiplier?: number;
  /** Add random jitter to delay */
  jitter?: boolean;
}

/**
 * Heartbeat/ping-pong configuration
 */
export interface HeartbeatConfig {
  /** Enable heartbeat */
  enabled: boolean;
  /** Heartbeat interval in milliseconds */
  interval?: number;
  /** Timeout for pong response in milliseconds */
  timeout?: number;
}

/**
 * Connection event types
 */
export enum ConnectionEvent {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
  RECONNECTED = 'reconnected',
  ERROR = 'error',
  MESSAGE = 'message',
}

/**
 * Connection statistics
 */
export interface ConnectionStats {
  /** Current state */
  state: ConnectionState;
  /** Number of reconnection attempts */
  reconnectAttempts: number;
  /** Total messages sent */
  messagesSent: number;
  /** Total messages received */
  messagesReceived: number;
  /** Connection uptime in milliseconds */
  uptime: number;
  /** Last ping latency in milliseconds */
  latency?: number;
  /** Connection established timestamp */
  connectedAt?: Date;
  /** Last activity timestamp */
  lastActivity?: Date;
}

// ============================================
// Message Types
// ============================================

/**
 * Message types for the protocol
 */
export enum MessageType {
  // Connection
  CONNECT = 'connect',
  CONNECT_ACK = 'connect_ack',
  DISCONNECT = 'disconnect',
  PING = 'ping',
  PONG = 'pong',
  ERROR = 'error',

  // Channels
  SUBSCRIBE = 'subscribe',
  SUBSCRIBE_ACK = 'subscribe_ack',
  UNSUBSCRIBE = 'unsubscribe',
  UNSUBSCRIBE_ACK = 'unsubscribe_ack',
  PUBLISH = 'publish',
  MESSAGE = 'message',
  BROADCAST = 'broadcast',

  // Presence
  PRESENCE_JOIN = 'presence_join',
  PRESENCE_LEAVE = 'presence_leave',
  PRESENCE_UPDATE = 'presence_update',
  PRESENCE_STATE = 'presence_state',
  PRESENCE_SYNC = 'presence_sync',
}

/**
 * Base message structure
 */
export interface Message<T = unknown> {
  /** Message type */
  type: MessageType;
  /** Channel name */
  channel?: string;
  /** Message payload */
  payload?: T;
  /** Message ID for correlation */
  id?: string;
  /** Timestamp */
  timestamp?: number;
  /** Sender information */
  sender?: {
    id: string;
    name?: string;
  };
  /** Error information */
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Outgoing message
 */
export interface OutgoingMessage<T = unknown> extends Message<T> {
  /** Acknowledgment callback */
  ack?: (response: Message) => void;
  /** Timeout for acknowledgment */
  timeout?: number;
}

/**
 * Message handler callback
 */
export type MessageHandler<T = unknown> = (message: Message<T>) => void | Promise<void>;

// ============================================
// Channel Types
// ============================================

/**
 * Channel states
 */
export enum ChannelState {
  UNSUBSCRIBED = 'unsubscribed',
  SUBSCRIBING = 'subscribing',
  SUBSCRIBED = 'subscribed',
  UNSUBSCRIBING = 'unsubscribing',
  ERROR = 'error',
}

/**
 * Channel configuration
 */
export interface ChannelConfig {
  /** Channel name */
  name: string;
  /** Private channel (requires auth) */
  private?: boolean;
  /** Presence channel */
  presence?: boolean;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Channel subscription options
 */
export interface SubscribeOptions {
  /** Receive historical messages */
  history?: boolean;
  /** Number of historical messages */
  historyCount?: number;
  /** Initial presence data */
  presenceData?: Record<string, unknown>;
}

/**
 * Channel information
 */
export interface ChannelInfo {
  /** Channel name */
  name: string;
  /** Current state */
  state: ChannelState;
  /** Is presence channel */
  presence: boolean;
  /** Number of subscribers (if known) */
  subscriberCount?: number;
  /** Subscribed timestamp */
  subscribedAt?: Date;
}

/**
 * Channel event types
 */
export enum ChannelEvent {
  SUBSCRIBED = 'subscribed',
  UNSUBSCRIBED = 'unsubscribed',
  MESSAGE = 'message',
  ERROR = 'error',
}

// ============================================
// Presence Types
// ============================================

/**
 * Presence member
 */
export interface PresenceMember<T = Record<string, unknown>> {
  /** Member ID */
  id: string;
  /** Member name */
  name?: string;
  /** Connection ID */
  connectionId?: string;
  /** Custom data */
  data?: T;
  /** Join timestamp */
  joinedAt: Date;
  /** Last update timestamp */
  updatedAt?: Date;
  /** Online status */
  online: boolean;
}

/**
 * Presence state for a channel
 */
export interface PresenceState<T = Record<string, unknown>> {
  /** Channel name */
  channel: string;
  /** All members */
  members: Map<string, PresenceMember<T>>;
  /** Current user */
  me?: PresenceMember<T>;
}

/**
 * Presence update
 */
export interface PresenceUpdate<T = Record<string, unknown>> {
  /** Channel name */
  channel: string;
  /** Updated member */
  member: PresenceMember<T>;
  /** Type of update */
  type: 'join' | 'leave' | 'update';
}

/**
 * Presence event types
 */
export enum PresenceEvent {
  JOIN = 'join',
  LEAVE = 'leave',
  UPDATE = 'update',
  SYNC = 'sync',
}

/**
 * Presence configuration
 */
export interface PresenceConfig {
  /** Presence data to track */
  data?: Record<string, unknown>;
  /** Update presence data on changes */
  trackUpdates?: boolean;
  /** Heartbeat interval for presence */
  heartbeatInterval?: number;
}

// ============================================
// Service Types
// ============================================

/**
 * Realtime service configuration
 */
export interface RealtimeConfig extends ConnectionConfig {
  /** Tenant ID for multi-tenant support */
  tenantId?: string;
  /** User context */
  user?: RealtimeUser;
  /** Event handlers */
  onConnectionChange?: (state: ConnectionState) => void;
  onError?: (error: Error) => void;
}

/**
 * User context for realtime
 */
export interface RealtimeUser {
  /** User ID */
  id: string;
  /** User name */
  name?: string;
  /** User email */
  email?: string;
  /** Custom data */
  data?: Record<string, unknown>;
}

/**
 * Event listener removal function
 */
export type Unsubscribe = () => void;

/**
 * Event emitter interface
 */
export interface EventEmitter<Events extends Record<string, unknown[]>> {
  on<K extends keyof Events>(event: K, handler: (...args: Events[K]) => void): Unsubscribe;
  off<K extends keyof Events>(event: K, handler: (...args: Events[K]) => void): void;
  emit<K extends keyof Events>(event: K, ...args: Events[K]): void;
  once<K extends keyof Events>(event: K, handler: (...args: Events[K]) => void): Unsubscribe;
}

// ============================================
// React Types
// ============================================

/**
 * Realtime provider props
 */
export interface RealtimeProviderProps {
  /** Child components */
  children: React.ReactNode;
  /** Realtime configuration */
  config: RealtimeConfig;
  /** Connect on mount */
  connectOnMount?: boolean;
  /** Loading component */
  loadingComponent?: React.ReactNode;
  /** Error component */
  errorComponent?: React.ReactNode;
}

/**
 * Realtime context value
 */
export interface RealtimeContextValue {
  /** Connection state */
  connectionState: ConnectionState;
  /** Connection stats */
  stats: ConnectionStats;
  /** Is connected */
  isConnected: boolean;
  /** Connect to server */
  connect: () => Promise<void>;
  /** Disconnect from server */
  disconnect: () => void;
  /** Subscribe to a channel */
  subscribe: (channel: string, options?: SubscribeOptions) => Promise<ChannelHandle>;
  /** Unsubscribe from a channel */
  unsubscribe: (channel: string) => void;
  /** Publish message to a channel */
  publish: <T>(channel: string, event: string, data: T) => void;
  /** Get presence for a channel */
  getPresence: (channel: string) => PresenceState | null;
  /** Update presence data */
  updatePresence: (channel: string, data: Record<string, unknown>) => void;
  /** Error if any */
  error?: Error;
}

/**
 * Channel handle returned from subscribe
 */
export interface ChannelHandle {
  /** Channel name */
  name: string;
  /** Channel state */
  state: ChannelState;
  /** Subscribe to events */
  on: <T>(event: string, handler: MessageHandler<T>) => Unsubscribe;
  /** Publish to channel */
  publish: <T>(event: string, data: T) => void;
  /** Unsubscribe from channel */
  unsubscribe: () => void;
  /** Get presence (for presence channels) */
  presence?: {
    get: () => PresenceState;
    update: (data: Record<string, unknown>) => void;
    onJoin: (handler: (member: PresenceMember) => void) => Unsubscribe;
    onLeave: (handler: (member: PresenceMember) => void) => Unsubscribe;
    onUpdate: (handler: (member: PresenceMember) => void) => Unsubscribe;
  };
}

/**
 * useChannel hook options
 */
export interface UseChannelOptions {
  /** Auto-subscribe on mount */
  autoSubscribe?: boolean;
  /** Subscribe options */
  subscribeOptions?: SubscribeOptions;
  /** Event handlers */
  onMessage?: MessageHandler;
  onSubscribed?: () => void;
  onUnsubscribed?: () => void;
  onError?: (error: Error) => void;
}

/**
 * useChannel hook return value
 */
export interface UseChannelReturn {
  /** Channel info */
  channel: ChannelInfo | null;
  /** Is subscribed */
  isSubscribed: boolean;
  /** Is subscribing */
  isSubscribing: boolean;
  /** Subscribe to channel */
  subscribe: (options?: SubscribeOptions) => Promise<void>;
  /** Unsubscribe from channel */
  unsubscribe: () => void;
  /** Publish to channel */
  publish: <T>(event: string, data: T) => void;
  /** Add event listener */
  on: <T>(event: string, handler: MessageHandler<T>) => Unsubscribe;
  /** Error if any */
  error?: Error;
}

/**
 * usePresence hook return value
 */
export interface UsePresenceReturn<T = Record<string, unknown>> {
  /** Presence state */
  presence: PresenceState<T> | null;
  /** List of members */
  members: PresenceMember<T>[];
  /** Current user */
  me: PresenceMember<T> | null;
  /** Update presence data */
  update: (data: Partial<T>) => void;
  /** Is synced */
  isSynced: boolean;
}
