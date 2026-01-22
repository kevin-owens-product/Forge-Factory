/**
 * @package @forge/realtime
 * @description React context provider for realtime functionality
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { RealtimeService, createRealtimeService } from '../realtime.service';
import {
  RealtimeConfig,
  RealtimeContextValue,
  RealtimeProviderProps,
  ConnectionState,
  ConnectionStats,
  ChannelHandle,
  SubscribeOptions,
  PresenceState,
} from '../realtime.types';

/**
 * Default context value
 */
const defaultContextValue: RealtimeContextValue = {
  connectionState: ConnectionState.DISCONNECTED,
  stats: {
    state: ConnectionState.DISCONNECTED,
    reconnectAttempts: 0,
    messagesSent: 0,
    messagesReceived: 0,
    uptime: 0,
  },
  isConnected: false,
  connect: async () => {},
  disconnect: () => {},
  subscribe: async () => ({} as ChannelHandle),
  unsubscribe: () => {},
  publish: () => {},
  getPresence: () => null,
  updatePresence: () => {},
};

/**
 * Realtime context
 */
export const RealtimeContext = createContext<RealtimeContextValue>(defaultContextValue);

/**
 * Realtime provider component
 */
export function RealtimeProvider({
  children,
  config,
  connectOnMount = true,
  loadingComponent,
  errorComponent,
}: RealtimeProviderProps): JSX.Element {
  const serviceRef = useRef<RealtimeService | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [stats, setStats] = useState<ConnectionStats>(defaultContextValue.stats);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize service
  useEffect(() => {
    const serviceConfig: RealtimeConfig = {
      ...config,
      onConnectionChange: (state) => {
        setConnectionState(state);
        config.onConnectionChange?.(state);
      },
      onError: (err) => {
        setError(err);
        config.onError?.(err);
      },
    };

    serviceRef.current = createRealtimeService(serviceConfig);
    setIsInitialized(true);

    return () => {
      serviceRef.current?.disconnect();
      serviceRef.current = null;
    };
  }, [config]);

  // Connect on mount if configured
  useEffect(() => {
    if (connectOnMount && serviceRef.current && isInitialized) {
      serviceRef.current.connect().catch((err) => {
        setError(err);
      });
    }
  }, [connectOnMount, isInitialized]);

  // Update stats periodically
  useEffect(() => {
    if (!serviceRef.current) return;

    const updateStats = () => {
      if (serviceRef.current) {
        setStats(serviceRef.current.getStats());
      }
    };

    updateStats();
    const interval = setInterval(updateStats, 1000);
    return () => clearInterval(interval);
  }, [isInitialized]);

  const connect = useCallback(async (): Promise<void> => {
    if (serviceRef.current) {
      await serviceRef.current.connect();
    }
  }, []);

  const disconnect = useCallback((): void => {
    serviceRef.current?.disconnect();
  }, []);

  const subscribe = useCallback(
    async (channel: string, options?: SubscribeOptions): Promise<ChannelHandle> => {
      if (!serviceRef.current) {
        throw new Error('Realtime service not initialized');
      }
      return serviceRef.current.subscribe(channel, options);
    },
    []
  );

  const unsubscribe = useCallback((channel: string): void => {
    serviceRef.current?.unsubscribe(channel);
  }, []);

  const publish = useCallback(<T,>(channel: string, event: string, data: T): void => {
    serviceRef.current?.publish(channel, event, data);
  }, []);

  const getPresence = useCallback((channel: string): PresenceState | null => {
    return serviceRef.current?.getPresence(channel) ?? null;
  }, []);

  const updatePresence = useCallback((channel: string, data: Record<string, unknown>): void => {
    serviceRef.current?.updatePresence(channel, data);
  }, []);

  const value: RealtimeContextValue = useMemo(
    () => ({
      connectionState,
      stats,
      isConnected: connectionState === ConnectionState.CONNECTED,
      connect,
      disconnect,
      subscribe,
      unsubscribe,
      publish,
      getPresence,
      updatePresence,
      error,
    }),
    [connectionState, stats, connect, disconnect, subscribe, unsubscribe, publish, getPresence, updatePresence, error]
  );

  // Show loading state
  if (!isInitialized && loadingComponent) {
    return loadingComponent as JSX.Element;
  }

  // Show error state
  if (error && errorComponent) {
    return errorComponent as JSX.Element;
  }

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  ) as JSX.Element;
}

/**
 * Hook to access realtime context
 */
export function useRealtimeContext(): RealtimeContextValue {
  return useContext(RealtimeContext);
}

/**
 * Hook to get connection state
 */
export function useConnectionState(): ConnectionState {
  const { connectionState } = useRealtimeContext();
  return connectionState;
}

/**
 * Hook to check if connected
 */
export function useIsConnected(): boolean {
  const { isConnected } = useRealtimeContext();
  return isConnected;
}

/**
 * Hook to get connection stats
 */
export function useConnectionStats(): ConnectionStats {
  const { stats } = useRealtimeContext();
  return stats;
}
