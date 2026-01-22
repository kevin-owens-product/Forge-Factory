/**
 * @prompt-id forge-v4.1:feature:admin:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@forge/design-system';
import { Settings, settingsMeta } from '../Settings';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <MemoryRouter>{children}</MemoryRouter>
    </ThemeProvider>
  );
}

describe('Settings', () => {
  it('should render settings page', () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    expect(screen.getByTestId('settings-page')).toBeInTheDocument();
  });

  it('should render page title and description', () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    expect(screen.getByText(settingsMeta.title)).toBeInTheDocument();
    expect(screen.getByText(settingsMeta.description!)).toBeInTheDocument();
  });

  it('should render category selector', () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    expect(screen.getByTestId('category-select')).toBeInTheDocument();
  });

  it('should render settings list', () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    expect(screen.getByText('app.name')).toBeInTheDocument();
    expect(screen.getByText('app.maintenance_mode')).toBeInTheDocument();
    expect(screen.getByText('security.session_timeout')).toBeInTheDocument();
  });

  it('should render setting descriptions', () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    expect(screen.getByText('The name of the application')).toBeInTheDocument();
    expect(screen.getByText('Enable maintenance mode')).toBeInTheDocument();
  });

  it('should render setting values', () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    expect(screen.getByText('Forge Factory')).toBeInTheDocument();
    expect(screen.getByText('false')).toBeInTheDocument();
    expect(screen.getByText('3600')).toBeInTheDocument();
  });

  it('should render Edit buttons for non-secret settings', () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    expect(editButtons.length).toBeGreaterThan(0);
  });

  it('should render Export Settings button', () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    expect(screen.getByRole('button', { name: 'Export Settings' })).toBeInTheDocument();
  });

  it('should filter settings by category', async () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    const categorySelect = screen.getByTestId('category-select');
    fireEvent.change(categorySelect, { target: { value: 'security' } });

    await waitFor(() => {
      expect(screen.getByText('security.session_timeout')).toBeInTheDocument();
      expect(screen.queryByText('app.name')).not.toBeInTheDocument();
    });
  });

  it('should enter edit mode when clicking Edit', async () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });

  it('should cancel edit mode', async () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    fireEvent.click(editButtons[0]);

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
  });

  it('should save edited value', async () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    fireEvent.click(editButtons[0]);

    const input = screen.getByDisplayValue('Forge Factory');
    fireEvent.change(input, { target: { value: 'New Name' } });

    const saveButton = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('New Name')).toBeInTheDocument();
    });
  });

  it('should render secret values as masked', () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    expect(screen.getByText('********')).toBeInTheDocument();
  });

  it('should disable Edit button for secret settings', () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    // Secret settings should have disabled Edit button
    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    const disabledButtons = editButtons.filter((btn) => btn.hasAttribute('disabled'));
    expect(disabledButtons.length).toBeGreaterThan(0);
  });
});
