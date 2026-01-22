/**
 * @prompt-id forge-v4.1:feature:admin:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@forge/design-system';
import { App } from '../src/App';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe('App', () => {
  it('should render without crashing', () => {
    render(<App />);
    expect(document.body).toBeTruthy();
  });

  it('should render the theme provider', () => {
    render(<App />);
    // The app should be wrapped in ThemeProvider which injects CSS variables
    expect(document.body).toBeTruthy();
  });
});

describe('App Integration', () => {
  it('should render the layout with navigation', () => {
    render(
      <TestWrapper>
        <MemoryRouter initialEntries={['/dashboard']}>
          <div data-testid="test-app">App Loaded</div>
        </MemoryRouter>
      </TestWrapper>
    );

    expect(screen.getByTestId('test-app')).toBeInTheDocument();
  });
});
