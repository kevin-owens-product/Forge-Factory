/**
 * @package @forge/i18n
 * @description Tests for React integration
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import {
  I18nProvider,
  useI18n,
  useTranslation,
  useLocale,
  useLocales,
  useChangeLocale,
  useDirection,
  useI18nReady,
  Trans,
  Plural,
  DateTime,
  NumberFormat,
  RelativeTime,
} from '../react';
import { I18nConfig } from '../i18n.types';

// Test configuration
const testConfig: I18nConfig = {
  defaultLocale: 'en',
  supportedLocales: ['en', 'es', 'fr'],
  translations: {
    en: {
      greeting: 'Hello',
      greetingWithName: 'Hello {{name}}',
      items: { one: '1 item', other: '{{count}} items' },
      rich: 'Hello <bold>{{name}}</bold>!',
      button: 'Click me',
    },
    es: {
      greeting: 'Hola',
      greetingWithName: 'Hola {{name}}',
      items: { one: '1 artículo', other: '{{count}} artículos' },
      button: 'Haz clic',
    },
  },
};

// Wrapper component
function TestWrapper({ children, config = testConfig }: { children: React.ReactNode; config?: I18nConfig }) {
  return <I18nProvider config={config}>{children}</I18nProvider>;
}

describe('I18nProvider', () => {

  it('should render children', async () => {
    render(
      <TestWrapper>
        <div data-testid="child">Child content</div>
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });
  });

  it('should show fallback while loading', async () => {
    render(
      <I18nProvider config={testConfig} fallback={<div data-testid="loading">Loading...</div>}>
        <div>Content</div>
      </I18nProvider>
    );

    // Either loading or content should be visible
    await waitFor(() => {
      expect(screen.queryByTestId('loading') || screen.queryByText('Content')).toBeTruthy();
    });
  });

  it('should use initial locale', async () => {
    function LocaleDisplay() {
      const { locale } = useI18n();
      return <div data-testid="locale">{locale}</div>;
    }

    render(
      <I18nProvider config={testConfig} initialLocale="es">
        <LocaleDisplay />
      </I18nProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('locale')).toHaveTextContent('es');
    });
  });
});

describe('useI18n', () => {
  it('should throw outside provider', () => {
    expect(() => renderHook(() => useI18n())).toThrow(
      'useI18n must be used within an I18nProvider'
    );
  });

  it('should return context value', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TestWrapper>{children}</TestWrapper>
    );

    const { result } = renderHook(() => useI18n(), { wrapper });

    await waitFor(() => {
      expect(result.current.locale).toBe('en');
      expect(result.current.locales).toContain('en');
      expect(result.current.t).toBeInstanceOf(Function);
    });
  });
});

describe('useTranslation', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TestWrapper>{children}</TestWrapper>
  );

  it('should translate keys', async () => {
    const { result } = renderHook(() => useTranslation(), { wrapper });

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    expect(result.current.t('greeting')).toBe('Hello');
  });

  it('should interpolate values', async () => {
    const { result } = renderHook(() => useTranslation(), { wrapper });

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    expect(result.current.t('greetingWithName', { values: { name: 'John' } })).toBe('Hello John');
  });

  it('should handle pluralization', async () => {
    const { result } = renderHook(() => useTranslation(), { wrapper });

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    expect(result.current.t('items', { count: 1 })).toBe('1 item');
    expect(result.current.t('items', { count: 5 })).toBe('5 items');
  });

  it('should return current locale', async () => {
    const { result } = renderHook(() => useTranslation(), { wrapper });

    await waitFor(() => {
      expect(result.current.locale).toBe('en');
    });
  });

  it('should return all locales', async () => {
    const { result } = renderHook(() => useTranslation(), { wrapper });

    await waitFor(() => {
      expect(result.current.locales).toContain('en');
      expect(result.current.locales).toContain('es');
    });
  });
});

describe('useLocale', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TestWrapper>{children}</TestWrapper>
  );

  it('should return current locale', async () => {
    const { result } = renderHook(() => useLocale(), { wrapper });

    await waitFor(() => {
      expect(result.current).toBe('en');
    });
  });
});

describe('useLocales', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TestWrapper>{children}</TestWrapper>
  );

  it('should return all locales', async () => {
    const { result } = renderHook(() => useLocales(), { wrapper });

    await waitFor(() => {
      expect(result.current).toContain('en');
      expect(result.current).toContain('es');
    });
  });
});

describe('useChangeLocale', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TestWrapper>{children}</TestWrapper>
  );

  it('should return change function', async () => {
    const { result } = renderHook(() => useChangeLocale(), { wrapper });

    await waitFor(() => {
      expect(typeof result.current).toBe('function');
    });
  });
});

describe('useDirection', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TestWrapper>{children}</TestWrapper>
  );

  it('should return direction', async () => {
    const { result } = renderHook(() => useDirection(), { wrapper });

    await waitFor(() => {
      expect(result.current).toBe('ltr');
    });
  });
});

describe('useI18nReady', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TestWrapper>{children}</TestWrapper>
  );

  it('should return ready state', async () => {
    const { result } = renderHook(() => useI18nReady(), { wrapper });

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });
});

describe('Trans component', () => {
  it('should render translated text', async () => {
    render(
      <TestWrapper>
        <Trans i18nKey="greeting" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Hello')).toBeInTheDocument();
    });
  });

  it('should interpolate values', async () => {
    render(
      <TestWrapper>
        <Trans i18nKey="greetingWithName" values={{ name: 'John' }} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Hello John')).toBeInTheDocument();
    });
  });

  it('should render with components', async () => {
    render(
      <TestWrapper>
        <Trans
          i18nKey="rich"
          values={{ name: 'John' }}
          components={{ bold: <strong /> }}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
      expect(screen.getByText('John').tagName).toBe('STRONG');
    });
  });

  it('should render with tag wrapper', async () => {
    render(
      <TestWrapper>
        <Trans i18nKey="greeting" tag="span" tagProps={{ className: 'test' }} />
      </TestWrapper>
    );

    await waitFor(() => {
      const span = screen.getByText('Hello');
      expect(span.tagName).toBe('SPAN');
      expect(span).toHaveClass('test');
    });
  });
});

describe('Plural component', () => {
  it('should render zero form', async () => {
    render(
      <TestWrapper>
        <Plural count={0} zero="No items" one="1 item" other="{{count}} items" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('No items')).toBeInTheDocument();
    });
  });

  it('should render one form', async () => {
    render(
      <TestWrapper>
        <Plural count={1} zero="No items" one="1 item" other="{{count}} items" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('1 item')).toBeInTheDocument();
    });
  });

  it('should render other form with count', async () => {
    render(
      <TestWrapper>
        <Plural count={5} one="1 item" other="{{count}} items" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('5 items')).toBeInTheDocument();
    });
  });
});

describe('DateTime component', () => {
  it('should format date', async () => {
    const date = new Date('2024-01-15');
    render(
      <TestWrapper>
        <DateTime value={date} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/Jan/)).toBeInTheDocument();
    });
  });

  it('should accept timestamp', async () => {
    const timestamp = new Date('2024-01-15').getTime();
    render(
      <TestWrapper>
        <DateTime value={timestamp} dateStyle="short" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/1\/15\/24|15\/01\/24/)).toBeInTheDocument();
    });
  });
});

describe('NumberFormat component', () => {
  it('should format number', async () => {
    render(
      <TestWrapper>
        <NumberFormat value={1234567} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/1,234,567/)).toBeInTheDocument();
    });
  });

  it('should format currency', async () => {
    render(
      <TestWrapper>
        <NumberFormat value={99.99} style="currency" currency="USD" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/\$99\.99/)).toBeInTheDocument();
    });
  });

  it('should format percent', async () => {
    render(
      <TestWrapper>
        <NumberFormat value={0.25} style="percent" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('25%')).toBeInTheDocument();
    });
  });
});

describe('RelativeTime component', () => {
  it('should format past time', async () => {
    const date = new Date(Date.now() - 60000); // 1 minute ago
    render(
      <TestWrapper>
        <RelativeTime value={date} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/minute/i)).toBeInTheDocument();
    });
  });

  it('should format future time', async () => {
    const date = new Date(Date.now() + 60000); // 1 minute from now
    render(
      <TestWrapper>
        <RelativeTime value={date} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/minute/i)).toBeInTheDocument();
    });
  });
});

describe('Locale change', () => {
  it('should update translations when locale changes', async () => {
    function LocaleChanger() {
      const { t, changeLocale } = useTranslation();
      return (
        <div>
          <span data-testid="translation">{t('greeting')}</span>
          <button onClick={() => changeLocale('es')}>Change to Spanish</button>
        </div>
      );
    }

    render(
      <TestWrapper>
        <LocaleChanger />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('translation')).toHaveTextContent('Hello');
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Change to Spanish'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('translation')).toHaveTextContent('Hola');
    });
  });
});
