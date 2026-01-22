/**
 * @package @forge/realtime
 * @description React hook for presence tracking
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRealtimeContext } from './FeatureFlagProvider';
import { useChannel } from './useChannel';
import {
  PresenceState,
  PresenceMember,
  UsePresenceReturn,
} from '../realtime.types';

/**
 * Hook for tracking presence in a channel
 */
export function usePresence<T extends Record<string, unknown> = Record<string, unknown>>(
  channelName: string,
  initialData?: T
): UsePresenceReturn<T> {
  const { getPresence, updatePresence } = useRealtimeContext();
  const { channel } = useChannel(channelName, {
    autoSubscribe: true,
    subscribeOptions: {
      presenceData: initialData as Record<string, unknown> | undefined,
    },
  });

  const [presence, setPresence] = useState<PresenceState<T> | null>(null);
  const [isSynced, setIsSynced] = useState(false);

  // Update presence state
  useEffect(() => {
    if (!channel) return;

    const updateState = (): void => {
      const state = getPresence(channelName);
      if (state) {
        setPresence(state as PresenceState<T>);
        setIsSynced(true);
      }
    };

    updateState();

    // Poll for updates (in production, this would be event-driven)
    const interval = setInterval(updateState, 1000);
    return () => clearInterval(interval);
  }, [channelName, channel, getPresence]);

  // Update presence data
  const update = useCallback(
    (data: Partial<T>): void => {
      updatePresence(channelName, data as Record<string, unknown>);
    },
    [channelName, updatePresence]
  );

  // Get members array
  const members = presence ? Array.from(presence.members.values()) : [];
  const me = presence?.me ?? null;

  return {
    presence,
    members,
    me,
    update,
    isSynced,
  };
}

/**
 * Hook for getting list of online members
 */
export function usePresenceMembers<T extends Record<string, unknown> = Record<string, unknown>>(
  channelName: string
): PresenceMember<T>[] {
  const { members } = usePresence<T>(channelName);
  return members;
}

/**
 * Hook for getting current user's presence
 */
export function useMyPresence<T extends Record<string, unknown> = Record<string, unknown>>(
  channelName: string,
  initialData?: T
): {
  me: PresenceMember<T> | null;
  update: (data: Partial<T>) => void;
} {
  const { me, update } = usePresence<T>(channelName, initialData);
  return { me, update };
}

/**
 * Hook for subscribing to presence events
 */
export function usePresenceEvent(
  channelName: string,
  event: 'join' | 'leave' | 'update',
  handler: (member: PresenceMember) => void
): void {
  const { channel } = useChannel(channelName);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!channel) return;

    // Note: In a full implementation, this would subscribe to presence events
    // For now, this is a placeholder that shows the pattern
    void event; // Acknowledge usage
  }, [channel, event]);
}

/**
 * Hook for tracking member count
 */
export function useMemberCount(channelName: string): number {
  const { members } = usePresence(channelName);
  return members.length;
}

/**
 * Hook for checking if a specific user is online
 */
export function useIsUserOnline(channelName: string, userId: string): boolean {
  const { members } = usePresence(channelName);
  return members.some((m) => m.id === userId && m.online);
}

/**
 * Hook for getting a specific member's data
 */
export function useMemberData<T extends Record<string, unknown> = Record<string, unknown>>(
  channelName: string,
  memberId: string
): T | null {
  const { members } = usePresence<T>(channelName);
  const member = members.find((m) => m.id === memberId);
  return member?.data ?? null;
}

/**
 * Hook to track typing indicators
 */
export function useTypingIndicator(
  channelName: string,
  userId: string
): {
  typingUsers: string[];
  setTyping: (isTyping: boolean) => void;
} {
  const { update } = usePresence<{ isTyping?: boolean }>(channelName);
  const { members } = usePresence<{ isTyping?: boolean }>(channelName);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const typingUsers = members
    .filter((m) => m.id !== userId && m.data?.isTyping)
    .map((m) => m.name || m.id);

  const setTyping = useCallback(
    (isTyping: boolean): void => {
      update({ isTyping });

      // Clear typing after 3 seconds
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      if (isTyping) {
        timeoutRef.current = setTimeout(() => {
          update({ isTyping: false });
        }, 3000);
      }
    },
    [update]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    typingUsers,
    setTyping,
  };
}
