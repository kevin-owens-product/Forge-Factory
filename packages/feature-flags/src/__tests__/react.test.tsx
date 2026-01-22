/**
 * @package @forge/feature-flags
 * @description Tests for React components and hooks
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import {
  FeatureFlagProvider,
  useFeatureFlagContext,
} from '../react/FeatureFlagProvider';
import {
  useFeatureFlag,
  useFeatureFlagValue,
  useFeatureFlagDetails,
  useVariant,
  useUserContext,
  useFeatureFlagStatus,
  useFeatureFlags,
  useAnyFeatureFlag,
  useAllFeatureFlags,
  useFeatureFlagCallback,
} from '../react/useFeatureFlag';
import {
  FeatureFlag,
  Feature,
  FeatureFlagOff,
  FeatureMatch,
  VariantMatch,
  FeatureSwitch,
  ABTest,
  WithFeatureFlag,
  WithFeatureValue,
  WithVariant,
} from '../react/FeatureFlag';
import { InMemoryFlagProvider } from '../flag';
import { UserContext as FFUserContext } from '../feature-flags.types';

describe('FeatureFlagProvider', () => {
  it('should render children', async () => {
    render(
      <FeatureFlagProvider>
        <div data-testid="child">Child content</div>
      </FeatureFlagProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });
  });

  it('should show loading component while loading', () => {
    const provider = new InMemoryFlagProvider();
    vi.spyOn(provider, 'getAllFlags').mockImplementation(() => new Promise(() => {}));
    render(
      <FeatureFlagProvider
        config={{ flagProvider: provider }}
        loadingComponent={<div data-testid="loading">Loading...</div>}
      >
        <div>Content</div>
      </FeatureFlagProvider>
    );
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('should show error component on error', async () => {
    const provider = new InMemoryFlagProvider();
    vi.spyOn(provider, 'getAllFlags').mockRejectedValue(new Error('Load failed'));
    render(
      <FeatureFlagProvider
        config={{ flagProvider: provider }}
        errorComponent={<div data-testid="error">Error occurred</div>}
      >
        <div>Content</div>
      </FeatureFlagProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('error')).toBeInTheDocument();
    });
  });

  it('should accept user context', async () => {
    const userContext: FFUserContext = { id: 'user-123', role: 'admin' };
    render(
      <FeatureFlagProvider userContext={userContext}>
        <UserContextTestComponent />
      </FeatureFlagProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('user-id')).toHaveTextContent('user-123');
    });
  });
});

describe('useFeatureFlagContext', () => {
  it('should throw error when used outside provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      render(<OutsideProviderComponent />);
    }).toThrow('useFeatureFlagContext must be used within a FeatureFlagProvider');
    consoleError.mockRestore();
  });

  it('should provide context methods', async () => {
    render(
      <FeatureFlagProvider>
        <ContextMethodsTestComponent />
      </FeatureFlagProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('has-methods')).toHaveTextContent('true');
    });
  });
});

describe('useFeatureFlag', () => {
  it('should return default value for missing flag', async () => {
    render(
      <FeatureFlagProvider>
        <TestComponent flagKey="missing-flag" defaultValue={true} />
      </FeatureFlagProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('flag-value')).toHaveTextContent('true');
    });
  });

  it('should return false by default for missing flag', async () => {
    render(
      <FeatureFlagProvider>
        <TestComponent flagKey="missing-flag" />
      </FeatureFlagProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('flag-value')).toHaveTextContent('false');
    });
  });
});

describe('useFeatureFlagValue', () => {
  it('should return default value for missing flag', async () => {
    render(
      <FeatureFlagProvider>
        <StringValueTestComponent />
      </FeatureFlagProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('value')).toHaveTextContent('light');
    });
  });
});

describe('useFeatureFlagDetails', () => {
  it('should return evaluation details', async () => {
    render(
      <FeatureFlagProvider>
        <DetailsTestComponent />
      </FeatureFlagProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('flag-key')).toHaveTextContent('test-flag');
    });
  });
});

describe('useVariant', () => {
  it('should return null when no user context', async () => {
    render(
      <FeatureFlagProvider>
        <VariantTestComponent />
      </FeatureFlagProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('variant')).toHaveTextContent('null');
    });
  });
});

describe('useUserContext', () => {
  it('should return user context', async () => {
    const userContext: FFUserContext = { id: 'user-123' };
    render(
      <FeatureFlagProvider userContext={userContext}>
        <UserContextTestComponent />
      </FeatureFlagProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('user-id')).toHaveTextContent('user-123');
    });
  });

  it('should update user context', async () => {
    render(
      <FeatureFlagProvider>
        <UpdateUserContextTestComponent />
      </FeatureFlagProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('has-set-context')).toHaveTextContent('true');
    });
  });
});

describe('useFeatureFlagStatus', () => {
  it('should return loading state', async () => {
    render(
      <FeatureFlagProvider>
        <StatusTestComponent />
      </FeatureFlagProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
    });
  });

  it('should return refresh function', async () => {
    render(
      <FeatureFlagProvider>
        <StatusTestComponent />
      </FeatureFlagProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('has-refresh')).toHaveTextContent('true');
    });
  });
});

describe('useFeatureFlags', () => {
  it('should return false for missing flags', async () => {
    render(
      <FeatureFlagProvider>
        <MultipleFlagsTestComponent />
      </FeatureFlagProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('flag-1')).toHaveTextContent('false');
      expect(screen.getByTestId('flag-2')).toHaveTextContent('false');
    });
  });
});

describe('useAnyFeatureFlag', () => {
  it('should return false if no flags are enabled', async () => {
    render(
      <FeatureFlagProvider>
        <AnyFlagTestComponent />
      </FeatureFlagProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('any-enabled')).toHaveTextContent('false');
    });
  });
});

describe('useAllFeatureFlags', () => {
  it('should return false if any flag is disabled', async () => {
    render(
      <FeatureFlagProvider>
        <AllFlagsTestComponent />
      </FeatureFlagProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('all-enabled')).toHaveTextContent('false');
    });
  });
});

describe('useFeatureFlagCallback', () => {
  it('should provide callback functions', async () => {
    render(
      <FeatureFlagProvider>
        <CallbackTestComponent />
      </FeatureFlagProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('has-callbacks')).toHaveTextContent('true');
    });
  });
});

describe('FeatureFlag component', () => {
  it('should render fallback when flag is not found', async () => {
    render(
      <FeatureFlagProvider>
        <FeatureFlag
          flagKey="test-flag"
          fallback={<div data-testid="fallback">Fallback content</div>}
        >
          <div data-testid="content">Enabled content</div>
        </FeatureFlag>
      </FeatureFlagProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('fallback')).toBeInTheDocument();
    });
  });

  it('should use default value for missing flag', async () => {
    render(
      <FeatureFlagProvider>
        <FeatureFlag flagKey="missing-flag" defaultValue={true}>
          <div data-testid="content">Content</div>
        </FeatureFlag>
      </FeatureFlagProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });
  });
});

describe('Feature component', () => {
  it('should render fallback for null value', async () => {
    render(
      <FeatureFlagProvider>
        <Feature
          flagKey="missing"
          defaultValue={null as unknown as string}
          render={(value) => <div>{value}</div>}
          fallback={<div data-testid="fallback">Fallback</div>}
        />
      </FeatureFlagProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('fallback')).toBeInTheDocument();
    });
  });

  it('should render with default value', async () => {
    render(
      <FeatureFlagProvider>
        <Feature
          flagKey="missing"
          defaultValue="default-value"
          render={(value) => <div data-testid="value">{value}</div>}
        />
      </FeatureFlagProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('value')).toHaveTextContent('default-value');
    });
  });
});

describe('FeatureFlagOff component', () => {
  it('should render when flag is not found (disabled)', async () => {
    render(
      <FeatureFlagProvider>
        <FeatureFlagOff flagKey="test-flag">
          <div data-testid="off-content">Disabled content</div>
        </FeatureFlagOff>
      </FeatureFlagProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('off-content')).toBeInTheDocument();
    });
  });
});

describe('FeatureMatch component', () => {
  it('should not render when value does not match', async () => {
    render(
      <FeatureFlagProvider>
        <FeatureMatch flagKey="theme" value="dark" defaultValue="light">
          <div data-testid="match">Dark theme</div>
        </FeatureMatch>
      </FeatureFlagProvider>
    );
    await waitFor(() => {
      expect(screen.queryByTestId('match')).not.toBeInTheDocument();
    });
  });

  it('should render when value matches default', async () => {
    render(
      <FeatureFlagProvider>
        <FeatureMatch flagKey="theme" value="light" defaultValue="light">
          <div data-testid="match">Light theme</div>
        </FeatureMatch>
      </FeatureFlagProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('match')).toBeInTheDocument();
    });
  });
});

describe('VariantMatch component', () => {
  it('should render fallback when no variant', async () => {
    render(
      <FeatureFlagProvider>
        <VariantMatch
          flagKey="ab-test"
          variantId="treatment"
          fallback={<div data-testid="fallback">Fallback</div>}
        >
          <div data-testid="variant-match">Treatment variant</div>
        </VariantMatch>
      </FeatureFlagProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('fallback')).toBeInTheDocument();
    });
  });
});

describe('FeatureSwitch component', () => {
  it('should render default case when no match', async () => {
    render(
      <FeatureFlagProvider>
        <FeatureSwitch
          flagKey="missing"
          cases={{}}
          defaultCase={<div data-testid="default">Default case</div>}
        />
      </FeatureFlagProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('default')).toBeInTheDocument();
    });
  });
});

describe('ABTest component', () => {
  it('should render control when flag is not found', async () => {
    render(
      <FeatureFlagProvider>
        <ABTest
          flagKey="ab-test"
          control={<div data-testid="control">Control</div>}
          treatment={<div data-testid="treatment">Treatment</div>}
        />
      </FeatureFlagProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('control')).toBeInTheDocument();
    });
  });
});

describe('WithFeatureFlag component', () => {
  it('should pass flag state to render function', async () => {
    render(
      <FeatureFlagProvider>
        <WithFeatureFlag flagKey="test-flag">
          {(isEnabled) => <div data-testid="result">{String(isEnabled)}</div>}
        </WithFeatureFlag>
      </FeatureFlagProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('result')).toHaveTextContent('false');
    });
  });

  it('should use default value', async () => {
    render(
      <FeatureFlagProvider>
        <WithFeatureFlag flagKey="missing" defaultValue={true}>
          {(isEnabled) => <div data-testid="result">{String(isEnabled)}</div>}
        </WithFeatureFlag>
      </FeatureFlagProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('result')).toHaveTextContent('true');
    });
  });
});

describe('WithFeatureValue component', () => {
  it('should pass default value to render function', async () => {
    render(
      <FeatureFlagProvider>
        <WithFeatureValue flagKey="theme" defaultValue="light">
          {(value) => <div data-testid="result">{value}</div>}
        </WithFeatureValue>
      </FeatureFlagProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('result')).toHaveTextContent('light');
    });
  });
});

describe('WithVariant component', () => {
  it('should pass null variant to render function when no user context', async () => {
    render(
      <FeatureFlagProvider>
        <WithVariant flagKey="ab-test">
          {(variant) => <div data-testid="result">{variant?.variantId || 'none'}</div>}
        </WithVariant>
      </FeatureFlagProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('result')).toHaveTextContent('none');
    });
  });
});

// Test helper components
function TestComponent({ flagKey, defaultValue = false }: { flagKey: string; defaultValue?: boolean }) {
  const isEnabled = useFeatureFlag(flagKey, { defaultValue });
  return <div data-testid="flag-value">{String(isEnabled)}</div>;
}

function OutsideProviderComponent() {
  useFeatureFlagContext();
  return <div>Test</div>;
}

function ContextMethodsTestComponent() {
  const context = useFeatureFlagContext();
  const hasMethods = typeof context.isEnabled === 'function' &&
                     typeof context.getValue === 'function' &&
                     typeof context.refresh === 'function';
  return <div data-testid="has-methods">{String(hasMethods)}</div>;
}

function StringValueTestComponent() {
  const value = useFeatureFlagValue('theme', 'light');
  return <div data-testid="value">{value}</div>;
}

function DetailsTestComponent() {
  const details = useFeatureFlagDetails('test-flag', false);
  return <div data-testid="flag-key">{details.flagKey}</div>;
}

function VariantTestComponent() {
  const variant = useVariant('ab-test');
  return <div data-testid="variant">{variant ? variant.variantId : 'null'}</div>;
}

function UserContextTestComponent() {
  const { userContext } = useUserContext();
  return <div data-testid="user-id">{userContext?.id || 'none'}</div>;
}

function UpdateUserContextTestComponent() {
  const { setUserContext } = useUserContext();
  React.useEffect(() => {
    setUserContext({ id: 'new-user' });
  }, [setUserContext]);
  return <div data-testid="has-set-context">true</div>;
}

function StatusTestComponent() {
  const { isLoading, refresh } = useFeatureFlagStatus();
  return (
    <>
      <div data-testid="is-loading">{String(isLoading)}</div>
      <div data-testid="has-refresh">{String(typeof refresh === 'function')}</div>
    </>
  );
}

function MultipleFlagsTestComponent() {
  const flags = useFeatureFlags(['flag-1', 'flag-2']);
  return (
    <>
      <div data-testid="flag-1">{String(flags['flag-1'])}</div>
      <div data-testid="flag-2">{String(flags['flag-2'])}</div>
    </>
  );
}

function AnyFlagTestComponent() {
  const anyEnabled = useAnyFeatureFlag(['flag-1', 'flag-2']);
  return <div data-testid="any-enabled">{String(anyEnabled)}</div>;
}

function AllFlagsTestComponent() {
  const allEnabled = useAllFeatureFlags(['flag-1', 'flag-2']);
  return <div data-testid="all-enabled">{String(allEnabled)}</div>;
}

function CallbackTestComponent() {
  const { isEnabled, getValue } = useFeatureFlagCallback();
  const hasCallbacks = typeof isEnabled === 'function' && typeof getValue === 'function';
  return <div data-testid="has-callbacks">{String(hasCallbacks)}</div>;
}
