/**
 * @prompt-id forge-v4.1:feature:portal:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@forge/design-system';
import { Settings, settingsMeta } from '../Settings';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe('Settings', () => {
  it('should render the settings page', () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    expect(screen.getByTestId('settings-page')).toBeInTheDocument();
  });

  it('should display the page title', () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(settingsMeta.title);
  });

  it('should display the page description', () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    expect(screen.getByText(settingsMeta.description!)).toBeInTheDocument();
  });

  it('should display Account section', () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    expect(screen.getByRole('heading', { name: 'Account' })).toBeInTheDocument();
  });

  it('should display Appearance section', () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    expect(screen.getByRole('heading', { name: 'Appearance' })).toBeInTheDocument();
  });

  it('should display Notifications section', () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('should display email input with default value', () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    const emailInput = screen.getByTestId('settings-email-input');
    expect(emailInput).toHaveValue('user@example.com');
  });

  it('should allow changing email', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    const emailInput = screen.getByTestId('settings-email-input');
    await user.clear(emailInput);
    await user.type(emailInput, 'new@example.com');

    expect(emailInput).toHaveValue('new@example.com');
  });

  it('should display theme select', () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    expect(screen.getByTestId('settings-theme-select')).toBeInTheDocument();
  });

  it('should display language select', () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    expect(screen.getByTestId('settings-language-select')).toBeInTheDocument();
  });

  it('should display notifications select', () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    expect(screen.getByTestId('settings-notifications-select')).toBeInTheDocument();
  });

  it('should display save button', () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    expect(screen.getByTestId('settings-save-button')).toBeInTheDocument();
    expect(screen.getByTestId('settings-save-button')).toHaveTextContent('Save Changes');
  });

  it('should handle save button click', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    const saveButton = screen.getByTestId('settings-save-button');
    await user.click(saveButton);

    // Button should still be present after click
    expect(saveButton).toBeInTheDocument();
  });

  it('should display setting descriptions', () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    expect(screen.getByText('Your primary email for notifications')).toBeInTheDocument();
    expect(screen.getByText('Choose your preferred color scheme')).toBeInTheDocument();
    expect(screen.getByText('Select your preferred language')).toBeInTheDocument();
    expect(screen.getByText('When to receive email notifications')).toBeInTheDocument();
  });
});

describe('settingsMeta', () => {
  it('should have correct title', () => {
    expect(settingsMeta.title).toBe('Settings');
  });

  it('should have correct description', () => {
    expect(settingsMeta.description).toBe('Manage your account preferences and settings');
  });
});
