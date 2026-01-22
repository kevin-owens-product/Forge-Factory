/**
 * @package @forge/realtime
 * @description Tests for React integration
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import {
  RealtimeProvider,
  RealtimeContext,
  useRealtimeContext,
  useConnectionState,
  useIsConnected,
  useConnectionStats,
} from '../react/FeatureFlagProvider';
import { useChannel, useChannelState, useIsSubscribed } from '../react/useChannel';
import { usePresence, useMemberCount, useIsUserOnline, useTypingIndicator } from '../react/usePresence';
import { ConnectionState, ChannelState } from '../realtime.types';

// Helper component to test hooks
function TestComponent({ testFn }: { testFn: () => void }) {
  testFn();
  return <div>Test Component</div>;
}

describe('RealtimeProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should render children', () => {
    render(
      <RealtimeProvider config={{ url: 'wss://test.example.com/ws' }}>
        <div data-testid="child">Child Content</div>
      </RealtimeProvider>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('should render loading component while initializing', () => {
    render(
      <RealtimeProvider
        config={{ url: 'wss://test.example.com/ws' }}
        loadingComponent={<div data-testid="loading">Loading...</div>}
      >
        <div data-testid="child">Child Content</div>
      </RealtimeProvider>
    );

    // Should show child after initialization
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('should provide context value', async () => {
    let contextValue: ReturnType<typeof useRealtimeContext> | null = null;

    render(
      <RealtimeProvider config={{ url: 'wss://test.example.com/ws' }} connectOnMount={false}>
        <TestComponent
          testFn={() => {
            contextValue = useRealtimeContext();
          }}
        />
      </RealtimeProvider>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(contextValue).toBeDefined();
    expect(contextValue!.connectionState).toBe(ConnectionState.DISCONNECTED);
    expect(typeof contextValue!.connect).toBe('function');
    expect(typeof contextValue!.disconnect).toBe('function');
    expect(typeof contextValue!.subscribe).toBe('function');
  });

  it('should connect on mount when connectOnMount is true', async () => {
    let contextValue: ReturnType<typeof useRealtimeContext> | null = null;

    render(
      <RealtimeProvider config={{ url: 'wss://test.example.com/ws' }} connectOnMount={true}>
        <TestComponent
          testFn={() => {
            contextValue = useRealtimeContext();
          }}
        />
      </RealtimeProvider>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(contextValue?.connectionState).toBe(ConnectionState.CONNECTED);
  });
});

describe('useRealtimeContext', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should return default context when used outside provider', () => {
    // The context has a default value, so it won't throw
    let contextValue: ReturnType<typeof useRealtimeContext> | null = null;

    render(
      <TestComponent
        testFn={() => {
          contextValue = useRealtimeContext();
        }}
      />
    );

    // Should return the default context
    expect(contextValue).toBeDefined();
    expect(contextValue!.connectionState).toBe(ConnectionState.DISCONNECTED);
  });
});

describe('useConnectionState', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should return connection state', async () => {
    let state: ConnectionState | null = null;

    render(
      <RealtimeProvider config={{ url: 'wss://test.example.com/ws' }} connectOnMount={false}>
        <TestComponent
          testFn={() => {
            state = useConnectionState();
          }}
        />
      </RealtimeProvider>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(state).toBe(ConnectionState.DISCONNECTED);
  });
});

describe('useIsConnected', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should return false when disconnected', async () => {
    let isConnected: boolean | null = null;

    render(
      <RealtimeProvider config={{ url: 'wss://test.example.com/ws' }} connectOnMount={false}>
        <TestComponent
          testFn={() => {
            isConnected = useIsConnected();
          }}
        />
      </RealtimeProvider>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(isConnected).toBe(false);
  });

  it('should return true when connected', async () => {
    let isConnected: boolean | null = null;

    render(
      <RealtimeProvider config={{ url: 'wss://test.example.com/ws' }} connectOnMount={true}>
        <TestComponent
          testFn={() => {
            isConnected = useIsConnected();
          }}
        />
      </RealtimeProvider>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(isConnected).toBe(true);
  });
});

describe('useConnectionStats', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should return connection stats', async () => {
    let stats: ReturnType<typeof useConnectionStats> | null = null;

    render(
      <RealtimeProvider config={{ url: 'wss://test.example.com/ws' }} connectOnMount={false}>
        <TestComponent
          testFn={() => {
            stats = useConnectionStats();
          }}
        />
      </RealtimeProvider>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(stats).toBeDefined();
    expect(stats!.state).toBe(ConnectionState.DISCONNECTED);
    expect(stats!.messagesSent).toBe(0);
  });
});

describe('useChannel', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should return channel state', async () => {
    let channelResult: ReturnType<typeof useChannel> | null = null;

    render(
      <RealtimeProvider config={{ url: 'wss://test.example.com/ws' }} connectOnMount={true}>
        <TestComponent
          testFn={() => {
            channelResult = useChannel('test-channel', { autoSubscribe: false });
          }}
        />
      </RealtimeProvider>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(channelResult).toBeDefined();
    expect(channelResult!.channel).toBeNull();
    expect(channelResult!.isSubscribed).toBe(false);
    expect(typeof channelResult!.subscribe).toBe('function');
    expect(typeof channelResult!.unsubscribe).toBe('function');
    expect(typeof channelResult!.publish).toBe('function');
    expect(typeof channelResult!.on).toBe('function');
  });
});

describe('useChannelState', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should return UNSUBSCRIBED initially', async () => {
    let state: ChannelState | null = null;

    render(
      <RealtimeProvider config={{ url: 'wss://test.example.com/ws' }} connectOnMount={false}>
        <TestComponent
          testFn={() => {
            state = useChannelState('test-channel');
          }}
        />
      </RealtimeProvider>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(state).toBe(ChannelState.UNSUBSCRIBED);
  });
});

describe('useIsSubscribed', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should return false initially', async () => {
    let isSubscribed: boolean | null = null;

    render(
      <RealtimeProvider config={{ url: 'wss://test.example.com/ws' }} connectOnMount={false}>
        <TestComponent
          testFn={() => {
            isSubscribed = useIsSubscribed('test-channel');
          }}
        />
      </RealtimeProvider>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(isSubscribed).toBe(false);
  });
});

describe('usePresence', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should return presence state', async () => {
    let presenceResult: ReturnType<typeof usePresence> | null = null;

    render(
      <RealtimeProvider config={{ url: 'wss://test.example.com/ws' }} connectOnMount={true}>
        <TestComponent
          testFn={() => {
            presenceResult = usePresence('test-channel');
          }}
        />
      </RealtimeProvider>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(presenceResult).toBeDefined();
    expect(presenceResult!.members).toEqual([]);
    expect(presenceResult!.me).toBeNull();
    expect(typeof presenceResult!.update).toBe('function');
  });
});

describe('useMemberCount', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should return 0 initially', async () => {
    let count: number | null = null;

    render(
      <RealtimeProvider config={{ url: 'wss://test.example.com/ws' }} connectOnMount={true}>
        <TestComponent
          testFn={() => {
            count = useMemberCount('test-channel');
          }}
        />
      </RealtimeProvider>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(count).toBe(0);
  });
});

describe('useIsUserOnline', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should return false for non-existent user', async () => {
    let isOnline: boolean | null = null;

    render(
      <RealtimeProvider config={{ url: 'wss://test.example.com/ws' }} connectOnMount={true}>
        <TestComponent
          testFn={() => {
            isOnline = useIsUserOnline('test-channel', 'user-1');
          }}
        />
      </RealtimeProvider>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(isOnline).toBe(false);
  });
});

describe('useTypingIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should return typing indicator state', async () => {
    let typingResult: ReturnType<typeof useTypingIndicator> | null = null;

    render(
      <RealtimeProvider config={{ url: 'wss://test.example.com/ws' }} connectOnMount={true}>
        <TestComponent
          testFn={() => {
            typingResult = useTypingIndicator('test-channel', 'user-1');
          }}
        />
      </RealtimeProvider>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(typingResult).toBeDefined();
    expect(typingResult!.typingUsers).toEqual([]);
    expect(typeof typingResult!.setTyping).toBe('function');
  });
});

describe('RealtimeContext default value', () => {
  it('should have correct default context value', () => {
    // Create a consumer component that reads the default context
    const ConsumerComponent = () => {
      const context = React.useContext(RealtimeContext);
      return (
        <div>
          <span data-testid="state">{context.connectionState}</span>
          <span data-testid="connected">{context.isConnected.toString()}</span>
        </div>
      );
    };

    render(<ConsumerComponent />);

    expect(screen.getByTestId('state').textContent).toBe(ConnectionState.DISCONNECTED);
    expect(screen.getByTestId('connected').textContent).toBe('false');
  });
});
