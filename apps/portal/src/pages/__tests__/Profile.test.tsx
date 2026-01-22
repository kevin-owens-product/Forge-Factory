/**
 * @prompt-id forge-v4.1:feature:portal:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@forge/design-system';
import { Profile, profileMeta } from '../Profile';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe('Profile', () => {
  it('should render the profile page', () => {
    render(
      <TestWrapper>
        <Profile />
      </TestWrapper>
    );

    expect(screen.getByTestId('profile-page')).toBeInTheDocument();
  });

  it('should display the page title', () => {
    render(
      <TestWrapper>
        <Profile />
      </TestWrapper>
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(profileMeta.title);
  });

  it('should display the page description', () => {
    render(
      <TestWrapper>
        <Profile />
      </TestWrapper>
    );

    expect(screen.getByText(profileMeta.description!)).toBeInTheDocument();
  });

  it('should display user avatar with initials', () => {
    render(
      <TestWrapper>
        <Profile />
      </TestWrapper>
    );

    expect(screen.getByRole('img', { name: /avatar for john doe/i })).toBeInTheDocument();
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('should display user name', () => {
    render(
      <TestWrapper>
        <Profile />
      </TestWrapper>
    );

    expect(screen.getByRole('heading', { name: 'John Doe' })).toBeInTheDocument();
  });

  it('should display user role', () => {
    render(
      <TestWrapper>
        <Profile />
      </TestWrapper>
    );

    expect(screen.getByText('user')).toBeInTheDocument();
  });

  it('should display user email', () => {
    render(
      <TestWrapper>
        <Profile />
      </TestWrapper>
    );

    expect(screen.getByText('user@example.com')).toBeInTheDocument();
  });

  it('should display member since date', () => {
    render(
      <TestWrapper>
        <Profile />
      </TestWrapper>
    );

    expect(screen.getByText('Member Since')).toBeInTheDocument();
  });

  it('should display last updated date', () => {
    render(
      <TestWrapper>
        <Profile />
      </TestWrapper>
    );

    expect(screen.getByText('Last Updated')).toBeInTheDocument();
  });

  it('should display edit button when not editing', () => {
    render(
      <TestWrapper>
        <Profile />
      </TestWrapper>
    );

    expect(screen.getByTestId('profile-edit-button')).toBeInTheDocument();
    expect(screen.getByTestId('profile-edit-button')).toHaveTextContent('Edit Profile');
  });

  it('should show save and cancel buttons when editing', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <Profile />
      </TestWrapper>
    );

    const editButton = screen.getByTestId('profile-edit-button');
    await user.click(editButton);

    expect(screen.getByTestId('profile-save-button')).toBeInTheDocument();
    expect(screen.getByTestId('profile-cancel-button')).toBeInTheDocument();
  });

  it('should enable input fields when editing', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <Profile />
      </TestWrapper>
    );

    const editButton = screen.getByTestId('profile-edit-button');
    await user.click(editButton);

    const nameInputs = screen.getAllByRole('textbox');
    expect(nameInputs.length).toBeGreaterThan(0);
  });

  it('should cancel editing and revert changes', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <Profile />
      </TestWrapper>
    );

    const editButton = screen.getByTestId('profile-edit-button');
    await user.click(editButton);

    const cancelButton = screen.getByTestId('profile-cancel-button');
    await user.click(cancelButton);

    expect(screen.getByTestId('profile-edit-button')).toBeInTheDocument();
    expect(screen.queryByTestId('profile-cancel-button')).not.toBeInTheDocument();
  });

  it('should save changes and exit edit mode', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <Profile />
      </TestWrapper>
    );

    const editButton = screen.getByTestId('profile-edit-button');
    await user.click(editButton);

    const saveButton = screen.getByTestId('profile-save-button');
    await user.click(saveButton);

    expect(screen.getByTestId('profile-edit-button')).toBeInTheDocument();
    expect(screen.queryByTestId('profile-save-button')).not.toBeInTheDocument();
  });

  it('should display field labels', () => {
    render(
      <TestWrapper>
        <Profile />
      </TestWrapper>
    );

    expect(screen.getByText('Full Name')).toBeInTheDocument();
    expect(screen.getByText('Email Address')).toBeInTheDocument();
  });
});

describe('profileMeta', () => {
  it('should have correct title', () => {
    expect(profileMeta.title).toBe('Profile');
  });

  it('should have correct description', () => {
    expect(profileMeta.description).toBe('View and edit your profile information');
  });
});
