/**
 * @package @forge/realtime
 * @description React hook for channel subscriptions
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRealtimeContext } from './FeatureFlagProvider';
import {
  ChannelInfo,
  ChannelState,
  ChannelHandle,
  UseChannelOptions,
  UseChannelReturn,
  MessageHandler,
  SubscribeOptions,
  Unsubscribe,
} from '../realtime.types';

/**
 * Hook for subscribing to and interacting with a channel
 */
export function useChannel(
  channelName: string,
  options: UseChannelOptions = {}
): UseChannelReturn {
  const { subscribe, unsubscribe } = useRealtimeContext();
  const [channel, setChannel] = useState<ChannelInfo | null>(null);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const handleRef = useRef<ChannelHandle | null>(null);
  const listenersRef = useRef<Map<string, Set<MessageHandler>>>(new Map());
  const isSubscribingRef = useRef(false);

  const {
    autoSubscribe = true,
    subscribeOptions,
    onMessage,
    onSubscribed,
    onUnsubscribed,
    onError,
  } = options;

  // Subscribe to channel
  const doSubscribe = useCallback(
    async (opts?: SubscribeOptions): Promise<void> => {
      if (handleRef.current || isSubscribingRef.current) return;

      isSubscribingRef.current = true;
      setIsSubscribing(true);
      setError(undefined);

      try {
        const handle = await subscribe(channelName, opts || subscribeOptions);
        handleRef.current = handle;

        setChannel({
          name: handle.name,
          state: handle.state,
          presence: !!handle.presence,
          subscribedAt: new Date(),
        });

        // Set up message listeners
        if (onMessage) {
          handle.on('message', onMessage);
        }

        // Add any pending listeners
        for (const [event, handlers] of listenersRef.current) {
          for (const handler of handlers) {
            handle.on(event, handler);
          }
        }

        onSubscribed?.();
      } catch (err) {
        const errInstance = err instanceof Error ? err : new Error(String(err));
        setError(errInstance);
        onError?.(errInstance);
      } finally {
        isSubscribingRef.current = false;
        setIsSubscribing(false);
      }
    },
    [channelName, subscribe, subscribeOptions, onMessage, onSubscribed, onError]
  );

  // Unsubscribe from channel
  const doUnsubscribe = useCallback((): void => {
    if (handleRef.current) {
      handleRef.current.unsubscribe();
      handleRef.current = null;
    }
    unsubscribe(channelName);
    setChannel(null);
    listenersRef.current.clear();
    onUnsubscribed?.();
  }, [channelName, unsubscribe, onUnsubscribed]);

  // Publish to channel
  const publish = useCallback(<T>(event: string, data: T): void => {
    if (!handleRef.current) {
      throw new Error('Not subscribed to channel');
    }
    handleRef.current.publish(event, data);
  }, []);

  // Add event listener
  const on = useCallback(<T>(event: string, handler: MessageHandler<T>): Unsubscribe => {
    // Store listener in ref
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(handler as MessageHandler);

    // If already subscribed, add listener to handle
    let unsub: Unsubscribe | undefined;
    if (handleRef.current) {
      unsub = handleRef.current.on(event, handler);
    }

    return (): void => {
      listenersRef.current.get(event)?.delete(handler as MessageHandler);
      unsub?.();
    };
  }, []);

  // Auto-subscribe on mount
  useEffect(() => {
    if (autoSubscribe) {
      doSubscribe().catch(() => {
        // Error is already handled in doSubscribe
      });
    }

    return () => {
      doUnsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSubscribe]); // Only on mount/unmount

  return {
    channel,
    isSubscribed: channel?.state === ChannelState.SUBSCRIBED,
    isSubscribing,
    subscribe: doSubscribe,
    unsubscribe: doUnsubscribe,
    publish,
    on,
    error,
  };
}

/**
 * Hook for subscribing to a specific event on a channel
 */
export function useChannelEvent<T = unknown>(
  channelName: string,
  event: string,
  handler: MessageHandler<T>,
  deps: unknown[] = []
): void {
  const { on } = useChannel(channelName);

  useEffect(() => {
    const unsub = on(event, handler);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, event, ...deps]);
}

/**
 * Hook for getting channel state
 */
export function useChannelState(channelName: string): ChannelState {
  const { channel } = useChannel(channelName, { autoSubscribe: false });
  return channel?.state ?? ChannelState.UNSUBSCRIBED;
}

/**
 * Hook for checking if subscribed to a channel
 */
export function useIsSubscribed(channelName: string): boolean {
  const { isSubscribed } = useChannel(channelName, { autoSubscribe: false });
  return isSubscribed;
}
