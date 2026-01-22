/**
 * @prompt-id forge-v4.1:feature:admin:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@forge/design-system';
import { Users, usersMeta } from '../Users';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <MemoryRouter>{children}</MemoryRouter>
    </ThemeProvider>
  );
}

describe('Users', () => {
  it('should render users page', () => {
    render(
      <TestWrapper>
        <Users />
      </TestWrapper>
    );

    expect(screen.getByTestId('users-page')).toBeInTheDocument();
  });

  it('should render page title and description', () => {
    render(
      <TestWrapper>
        <Users />
      </TestWrapper>
    );

    expect(screen.getByText(usersMeta.title)).toBeInTheDocument();
    expect(screen.getByText(usersMeta.description!)).toBeInTheDocument();
  });

  it('should render data table', () => {
    render(
      <TestWrapper>
        <Users />
      </TestWrapper>
    );

    expect(screen.getByTestId('data-table')).toBeInTheDocument();
  });

  it('should render column headers', () => {
    render(
      <TestWrapper>
        <Users />
      </TestWrapper>
    );

    expect(screen.getByTestId('column-name')).toBeInTheDocument();
    expect(screen.getByTestId('column-email')).toBeInTheDocument();
    expect(screen.getByTestId('column-role')).toBeInTheDocument();
    expect(screen.getByTestId('column-status')).toBeInTheDocument();
  });

  it('should render user data', () => {
    render(
      <TestWrapper>
        <Users />
      </TestWrapper>
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
  });

  it('should render status badges', () => {
    render(
      <TestWrapper>
        <Users />
      </TestWrapper>
    );

    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getByText('Suspended')).toBeInTheDocument();
  });

  it('should render Add User button', () => {
    render(
      <TestWrapper>
        <Users />
      </TestWrapper>
    );

    expect(screen.getByRole('button', { name: 'Add User' })).toBeInTheDocument();
  });

  it('should render action buttons for each row', () => {
    render(
      <TestWrapper>
        <Users />
      </TestWrapper>
    );

    expect(screen.getAllByRole('button', { name: 'Edit' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Delete' }).length).toBeGreaterThan(0);
  });

  it('should render search input', () => {
    render(
      <TestWrapper>
        <Users />
      </TestWrapper>
    );

    expect(screen.getByTestId('table-search')).toBeInTheDocument();
  });

  it('should filter users on search', async () => {
    render(
      <TestWrapper>
        <Users />
      </TestWrapper>
    );

    const searchInput = screen.getByTestId('table-search');
    fireEvent.change(searchInput, { target: { value: 'Jane' } });

    // Wait for debounce (300ms) + React state updates
    await waitFor(() => {
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('should render pagination controls', () => {
    render(
      <TestWrapper>
        <Users />
      </TestWrapper>
    );

    expect(screen.getByTestId('prev-page')).toBeInTheDocument();
    expect(screen.getByTestId('next-page')).toBeInTheDocument();
  });

  it('should sort by column on header click', async () => {
    render(
      <TestWrapper>
        <Users />
      </TestWrapper>
    );

    const nameHeader = screen.getByTestId('column-name');
    fireEvent.click(nameHeader);

    // Check sort indicator appears
    await waitFor(() => {
      expect(nameHeader.textContent).toContain('^');
    });
  });
});
