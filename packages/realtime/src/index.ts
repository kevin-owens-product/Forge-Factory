/**
 * @package @forge/realtime
 * @description WebSocket client for real-time communication in Forge Factory
 */

// Types
export * from './realtime.types';

// Connection
export {
  Connection,
  createConnection,
  DEFAULT_CONNECTION_CONFIG,
} from './connection';

// Channels
export {
  Channel,
  ChannelManager,
  createChannelManager,
} from './channel';

// Presence
export {
  PresenceManager,
  createPresenceManager,
  createPresenceUpdate,
  DEFAULT_PRESENCE_CONFIG,
} from './presence';

// Reconnection
export {
  ReconnectManager,
  ReconnectEvent,
  calculateBackoffDelay,
  createReconnectManager,
  DEFAULT_RECONNECT_CONFIG,
} from './reconnect';
export type { ReconnectState, ReconnectHandler } from './reconnect';

// Service
export {
  RealtimeService,
  createRealtimeService,
} from './realtime.service';

// React
export {
  RealtimeContext,
  RealtimeProvider,
  useRealtimeContext,
  useConnectionState,
  useIsConnected,
  useConnectionStats,
  useChannel,
  useChannelEvent,
  useChannelState,
  useIsSubscribed,
  usePresence,
  usePresenceMembers,
  useMyPresence,
  usePresenceEvent,
  useMemberCount,
  useIsUserOnline,
  useMemberData,
  useTypingIndicator,
} from './react';
