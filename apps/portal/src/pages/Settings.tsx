/**
 * @prompt-id forge-v4.1:feature:portal:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { useMemo, useState, useCallback } from 'react';
import { Card, Button, Input, Select, useTokens, useTheme } from '@forge/design-system';
import type { PageMeta, ThemePreference } from '../types';

export const settingsMeta: PageMeta = {
  title: 'Settings',
  description: 'Manage your account preferences and settings',
};

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

function SettingsSection({ title, description, children }: SettingsSectionProps): JSX.Element {
  const tokens = useTokens();

  const sectionStyle = useMemo<React.CSSProperties>(
    () => ({
      marginBottom: tokens.spacing[8],
    }),
    [tokens]
  );

  const headerStyle = useMemo<React.CSSProperties>(
    () => ({
      marginBottom: tokens.spacing[4],
    }),
    [tokens]
  );

  const titleStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes.lg,
      fontWeight: tokens.typography.fontWeights.semibold,
      color: tokens.colors.foreground.primary,
      marginBottom: tokens.spacing[1],
    }),
    [tokens]
  );

  const descriptionStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes.sm,
      color: tokens.colors.foreground.muted,
    }),
    [tokens]
  );

  const cardStyle = useMemo<React.CSSProperties>(
    () => ({
      padding: tokens.spacing[6],
    }),
    [tokens]
  );

  return (
    <section style={sectionStyle}>
      <header style={headerStyle}>
        <h2 style={titleStyle}>{title}</h2>
        {description && <p style={descriptionStyle}>{description}</p>}
      </header>
      <Card variant="outlined" style={cardStyle}>
        {children}
      </Card>
    </section>
  );
}

interface SettingsRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

function SettingsRow({ label, description, children }: SettingsRowProps): JSX.Element {
  const tokens = useTokens();

  const rowStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: `${tokens.spacing[4]} 0`,
      borderBottom: `1px solid ${tokens.colors.border.muted}`,
      gap: tokens.spacing[4],
    }),
    [tokens]
  );

  const labelContainerStyle = useMemo<React.CSSProperties>(
    () => ({
      flex: 1,
    }),
    []
  );

  const labelStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes.sm,
      fontWeight: tokens.typography.fontWeights.medium,
      color: tokens.colors.foreground.primary,
      marginBottom: tokens.spacing[1],
    }),
    [tokens]
  );

  const descriptionStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes.xs,
      color: tokens.colors.foreground.muted,
    }),
    [tokens]
  );

  const controlStyle = useMemo<React.CSSProperties>(
    () => ({
      minWidth: '200px',
    }),
    []
  );

  return (
    <div style={rowStyle}>
      <div style={labelContainerStyle}>
        <div style={labelStyle}>{label}</div>
        {description && <div style={descriptionStyle}>{description}</div>}
      </div>
      <div style={controlStyle}>{children}</div>
    </div>
  );
}

export function Settings(): JSX.Element {
  const tokens = useTokens();
  const { mode, setMode } = useTheme();
  const [email, setEmail] = useState('user@example.com');
  const [language, setLanguage] = useState('en');
  const [notifications, setNotifications] = useState('all');

  const handleThemeChange = useCallback(
    (value: string) => {
      setMode(value as ThemePreference);
    },
    [setMode]
  );

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  }, []);

  const handleLanguageChange = useCallback((value: string) => {
    setLanguage(value);
  }, []);

  const handleNotificationsChange = useCallback((value: string) => {
    setNotifications(value);
  }, []);

  const handleSave = useCallback(() => {
    // In a real app, this would save settings to the backend
  }, []);

  const containerStyle = useMemo<React.CSSProperties>(
    () => ({
      padding: tokens.spacing[6],
      maxWidth: '800px',
    }),
    [tokens]
  );

  const headerStyle = useMemo<React.CSSProperties>(
    () => ({
      marginBottom: tokens.spacing[8],
    }),
    [tokens]
  );

  const titleStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes['2xl'],
      fontWeight: tokens.typography.fontWeights.bold,
      color: tokens.colors.foreground.primary,
      marginBottom: tokens.spacing[2],
    }),
    [tokens]
  );

  const subtitleStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes.base,
      color: tokens.colors.foreground.muted,
    }),
    [tokens]
  );

  const footerStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      justifyContent: 'flex-end',
      marginTop: tokens.spacing[6],
    }),
    [tokens]
  );

  const themeOptions = useMemo(
    () => [
      { value: 'light', label: 'Light' },
      { value: 'dark', label: 'Dark' },
      { value: 'system', label: 'System' },
    ],
    []
  );

  const languageOptions = useMemo(
    () => [
      { value: 'en', label: 'English' },
      { value: 'es', label: 'Spanish' },
      { value: 'fr', label: 'French' },
      { value: 'de', label: 'German' },
      { value: 'ja', label: 'Japanese' },
    ],
    []
  );

  const notificationOptions = useMemo(
    () => [
      { value: 'all', label: 'All notifications' },
      { value: 'important', label: 'Important only' },
      { value: 'none', label: 'None' },
    ],
    []
  );

  return (
    <div style={containerStyle} data-testid="settings-page">
      <header style={headerStyle}>
        <h1 style={titleStyle}>{settingsMeta.title}</h1>
        <p style={subtitleStyle}>{settingsMeta.description}</p>
      </header>

      <SettingsSection title="Account" description="Manage your account information">
        <SettingsRow label="Email Address" description="Your primary email for notifications">
          <Input
            type="email"
            value={email}
            onChange={handleEmailChange}
            aria-label="Email address"
            testId="settings-email-input"
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Appearance" description="Customize how the portal looks">
        <SettingsRow label="Theme" description="Choose your preferred color scheme">
          <Select
            options={themeOptions}
            value={mode}
            onChange={handleThemeChange}
            aria-label="Theme preference"
            testId="settings-theme-select"
          />
        </SettingsRow>
        <SettingsRow label="Language" description="Select your preferred language">
          <Select
            options={languageOptions}
            value={language}
            onChange={handleLanguageChange}
            aria-label="Language preference"
            testId="settings-language-select"
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Notifications" description="Control how you receive notifications">
        <SettingsRow label="Email Notifications" description="When to receive email notifications">
          <Select
            options={notificationOptions}
            value={notifications}
            onChange={handleNotificationsChange}
            aria-label="Notification preference"
            testId="settings-notifications-select"
          />
        </SettingsRow>
      </SettingsSection>

      <footer style={footerStyle}>
        <Button onClick={handleSave} testId="settings-save-button">
          Save Changes
        </Button>
      </footer>
    </div>
  );
}
