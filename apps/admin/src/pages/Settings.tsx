/**
 * @prompt-id forge-v4.1:feature:admin:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { useMemo, useState } from 'react';
import { Button, Card, Input, Select, useTokens } from '@forge/design-system';
import type { PageMeta, SystemSetting } from '../types';
import { formatDateTime } from '../utils';

export const settingsMeta: PageMeta = {
  title: 'Settings',
  description: 'System configuration and settings',
};

// Mock settings for demonstration
const mockSettings: SystemSetting[] = [
  {
    id: 'setting-1',
    key: 'app.name',
    value: 'Forge Factory',
    type: 'string',
    category: 'general',
    description: 'The name of the application',
    isSecret: false,
    updatedAt: new Date('2024-01-15'),
    updatedBy: 'admin@example.com',
  },
  {
    id: 'setting-2',
    key: 'app.maintenance_mode',
    value: false,
    type: 'boolean',
    category: 'general',
    description: 'Enable maintenance mode',
    isSecret: false,
    updatedAt: new Date('2024-06-20'),
    updatedBy: 'admin@example.com',
  },
  {
    id: 'setting-3',
    key: 'security.session_timeout',
    value: 3600,
    type: 'number',
    category: 'security',
    description: 'Session timeout in seconds',
    isSecret: false,
    updatedAt: new Date('2024-05-10'),
    updatedBy: 'admin@example.com',
  },
  {
    id: 'setting-4',
    key: 'security.max_login_attempts',
    value: 5,
    type: 'number',
    category: 'security',
    description: 'Maximum login attempts before lockout',
    isSecret: false,
    updatedAt: new Date('2024-05-10'),
    updatedBy: 'admin@example.com',
  },
  {
    id: 'setting-5',
    key: 'email.smtp_host',
    value: 'smtp.example.com',
    type: 'string',
    category: 'email',
    description: 'SMTP server hostname',
    isSecret: false,
    updatedAt: new Date('2024-03-01'),
    updatedBy: 'admin@example.com',
  },
  {
    id: 'setting-6',
    key: 'email.smtp_password',
    value: '********',
    type: 'string',
    category: 'email',
    description: 'SMTP server password',
    isSecret: true,
    updatedAt: new Date('2024-03-01'),
    updatedBy: 'admin@example.com',
  },
];

const categories = [
  { value: 'all', label: 'All Categories' },
  { value: 'general', label: 'General' },
  { value: 'security', label: 'Security' },
  { value: 'email', label: 'Email' },
];

interface SettingRowProps {
  setting: SystemSetting;
  onUpdate: (id: string, value: string | number | boolean) => void;
}

function SettingRow({ setting, onUpdate }: SettingRowProps): JSX.Element {
  const tokens = useTokens();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(setting.value));

  const rowStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
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
      minWidth: '200px',
    }),
    []
  );

  const keyStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes.sm,
      fontWeight: tokens.typography.fontWeights.medium,
      color: tokens.colors.foreground.primary,
      fontFamily: 'monospace',
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

  const valueContainerStyle = useMemo<React.CSSProperties>(
    () => ({
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      gap: tokens.spacing[2],
    }),
    [tokens]
  );

  const metaStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes.xs,
      color: tokens.colors.gray[400],
      whiteSpace: 'nowrap' as const,
    }),
    [tokens]
  );

  const handleSave = () => {
    let parsedValue: string | number | boolean = editValue;
    if (setting.type === 'number') {
      parsedValue = Number(editValue);
    } else if (setting.type === 'boolean') {
      parsedValue = editValue === 'true';
    }
    onUpdate(setting.id, parsedValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(String(setting.value));
    setIsEditing(false);
  };

  const renderValueEditor = () => {
    if (!isEditing) {
      return (
        <span
          style={{
            fontSize: tokens.typography.fontSizes.sm,
            color: setting.isSecret ? tokens.colors.gray[400] : tokens.colors.foreground.primary,
            fontStyle: setting.isSecret ? 'italic' : 'normal',
          }}
        >
          {String(setting.value)}
        </span>
      );
    }

    if (setting.type === 'boolean') {
      return (
        <Select
          value={editValue}
          onChange={(value) => setEditValue(value)}
          options={[
            { value: 'true', label: 'True' },
            { value: 'false', label: 'False' },
          ]}
          style={{ width: '150px' }}
        />
      );
    }

    return (
      <Input
        type={setting.type === 'number' ? 'number' : 'text'}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        style={{ width: '250px' }}
      />
    );
  };

  return (
    <div style={rowStyle}>
      <div style={labelContainerStyle}>
        <div style={keyStyle}>{setting.key}</div>
        <div style={descriptionStyle}>{setting.description}</div>
      </div>
      <div style={valueContainerStyle}>
        {renderValueEditor()}
        {isEditing ? (
          <>
            <Button variant="solid" size="sm" onClick={handleSave}>
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} disabled={setting.isSecret}>
            Edit
          </Button>
        )}
      </div>
      <div style={metaStyle}>
        {formatDateTime(setting.updatedAt)}
        <br />
        by {setting.updatedBy}
      </div>
    </div>
  );
}

export function Settings(): JSX.Element {
  const tokens = useTokens();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [settings, setSettings] = useState(mockSettings);

  const containerStyle = useMemo<React.CSSProperties>(
    () => ({
      padding: tokens.spacing[6],
    }),
    [tokens]
  );

  const headerStyle = useMemo<React.CSSProperties>(
    () => ({
      marginBottom: tokens.spacing[6],
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

  const toolbarStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: tokens.spacing[4],
    }),
    [tokens]
  );

  const cardStyle = useMemo<React.CSSProperties>(
    () => ({
      padding: tokens.spacing[6],
    }),
    [tokens]
  );

  const filteredSettings = useMemo(
    () =>
      selectedCategory === 'all' ? settings : settings.filter((s) => s.category === selectedCategory),
    [settings, selectedCategory]
  );

  const handleUpdate = (id: string, value: string | number | boolean) => {
    setSettings((prev) =>
      prev.map((s) => (s.id === id ? { ...s, value, updatedAt: new Date() } : s))
    );
  };

  return (
    <div style={containerStyle} data-testid="settings-page">
      <header style={headerStyle}>
        <h1 style={titleStyle}>{settingsMeta.title}</h1>
        <p style={subtitleStyle}>{settingsMeta.description}</p>
      </header>

      <div style={toolbarStyle}>
        <Select
          value={selectedCategory}
          onChange={(value) => setSelectedCategory(value)}
          options={categories}
          style={{ width: '200px' }}
          data-testid="category-select"
        />
        <Button variant="outline" size="sm">
          Export Settings
        </Button>
      </div>

      <Card variant="outlined" style={cardStyle}>
        {filteredSettings.length === 0 ? (
          <p style={{ textAlign: 'center', color: tokens.colors.foreground.muted }}>
            No settings found in this category
          </p>
        ) : (
          filteredSettings.map((setting) => (
            <SettingRow key={setting.id} setting={setting} onUpdate={handleUpdate} />
          ))
        )}
      </Card>
    </div>
  );
}
