/**
 * @prompt-id forge-v4.1:feature:portal:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { useMemo, useState, useCallback } from 'react';
import { Card, Button, Input, useTokens } from '@forge/design-system';
import type { PageMeta, User } from '../types';

export const profileMeta: PageMeta = {
  title: 'Profile',
  description: 'View and edit your profile information',
};

const mockUser: User = {
  id: 'user-1',
  email: 'user@example.com',
  name: 'John Doe',
  avatar: undefined,
  role: 'user',
  tenantId: 'tenant-1',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-06-01'),
};

interface ProfileFieldProps {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  editable?: boolean;
  type?: 'text' | 'email';
}

function ProfileField({
  label,
  value,
  onChange,
  editable = true,
  type = 'text',
}: ProfileFieldProps): JSX.Element {
  const tokens = useTokens();

  const containerStyle = useMemo<React.CSSProperties>(
    () => ({
      marginBottom: tokens.spacing[4],
    }),
    [tokens]
  );

  const labelStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'block',
      fontSize: tokens.typography.fontSizes.sm,
      fontWeight: tokens.typography.fontWeights.medium,
      color: tokens.colors.foreground.muted,
      marginBottom: tokens.spacing[2],
    }),
    [tokens]
  );

  const readOnlyStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes.base,
      color: tokens.colors.foreground.primary,
      padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
      backgroundColor: tokens.colors.background.secondary,
      borderRadius: tokens.borderRadii.md,
    }),
    [tokens]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e.target.value);
    },
    [onChange]
  );

  return (
    <div style={containerStyle}>
      <label style={labelStyle}>{label}</label>
      {editable && onChange ? (
        <Input type={type} value={value} onChange={handleChange} aria-label={label} />
      ) : (
        <div style={readOnlyStyle}>{value}</div>
      )}
    </div>
  );
}

interface AvatarProps {
  name: string;
  url?: string;
  size?: number;
}

function Avatar({ name, url, size = 120 }: AvatarProps): JSX.Element {
  const tokens = useTokens();

  const containerStyle = useMemo<React.CSSProperties>(
    () => ({
      width: size,
      height: size,
      borderRadius: '50%',
      backgroundColor: tokens.colors.primary[500],
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    }),
    [size, tokens]
  );

  const imageStyle = useMemo<React.CSSProperties>(
    () => ({
      width: '100%',
      height: '100%',
      objectFit: 'cover' as const,
    }),
    []
  );

  const initialsStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: size / 2.5,
      fontWeight: tokens.typography.fontWeights.bold,
      color: 'white',
      textTransform: 'uppercase' as const,
    }),
    [size, tokens]
  );

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2);

  return (
    <div style={containerStyle} role="img" aria-label={`Avatar for ${name}`}>
      {url ? <img src={url} alt={name} style={imageStyle} /> : <span style={initialsStyle}>{initials}</span>}
    </div>
  );
}

export function Profile(): JSX.Element {
  const tokens = useTokens();
  const [user, setUser] = useState<User>(mockUser);
  const [isEditing, setIsEditing] = useState(false);

  const handleNameChange = useCallback((value: string) => {
    setUser((prev) => ({ ...prev, name: value }));
  }, []);

  const handleEmailChange = useCallback((value: string) => {
    setUser((prev) => ({ ...prev, email: value }));
  }, []);

  const handleEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleCancel = useCallback(() => {
    setUser(mockUser);
    setIsEditing(false);
  }, []);

  const handleSave = useCallback(() => {
    // In a real app, this would save to the backend
    setIsEditing(false);
  }, []);

  const containerStyle = useMemo<React.CSSProperties>(
    () => ({
      padding: tokens.spacing[6],
      maxWidth: '600px',
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

  const profileCardStyle = useMemo<React.CSSProperties>(
    () => ({
      padding: tokens.spacing[6],
    }),
    [tokens]
  );

  const avatarSectionStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      marginBottom: tokens.spacing[6],
      paddingBottom: tokens.spacing[6],
      borderBottom: `1px solid ${tokens.colors.border.muted}`,
    }),
    [tokens]
  );

  const avatarNameStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes.xl,
      fontWeight: tokens.typography.fontWeights.semibold,
      color: tokens.colors.foreground.primary,
      marginTop: tokens.spacing[4],
    }),
    [tokens]
  );

  const avatarRoleStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes.sm,
      color: tokens.colors.foreground.muted,
      marginTop: tokens.spacing[1],
      textTransform: 'capitalize' as const,
    }),
    [tokens]
  );

  const buttonGroupStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      justifyContent: 'flex-end',
      gap: tokens.spacing[3],
      marginTop: tokens.spacing[6],
    }),
    [tokens]
  );

  const infoSectionStyle = useMemo<React.CSSProperties>(
    () => ({
      marginTop: tokens.spacing[6],
      paddingTop: tokens.spacing[6],
      borderTop: `1px solid ${tokens.colors.border.muted}`,
    }),
    [tokens]
  );

  const infoLabelStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes.sm,
      color: tokens.colors.foreground.muted,
      marginBottom: tokens.spacing[1],
    }),
    [tokens]
  );

  const infoValueStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes.sm,
      color: tokens.colors.foreground.primary,
      marginBottom: tokens.spacing[4],
    }),
    [tokens]
  );

  return (
    <div style={containerStyle} data-testid="profile-page">
      <header style={headerStyle}>
        <h1 style={titleStyle}>{profileMeta.title}</h1>
        <p style={subtitleStyle}>{profileMeta.description}</p>
      </header>

      <Card variant="outlined" style={profileCardStyle}>
        <div style={avatarSectionStyle}>
          <Avatar name={user.name} url={user.avatar} />
          <h2 style={avatarNameStyle}>{user.name}</h2>
          <p style={avatarRoleStyle}>{user.role}</p>
        </div>

        <ProfileField label="Full Name" value={user.name} onChange={handleNameChange} editable={isEditing} />

        <ProfileField
          label="Email Address"
          value={user.email}
          onChange={handleEmailChange}
          editable={isEditing}
          type="email"
        />

        <div style={infoSectionStyle}>
          <p style={infoLabelStyle}>Member Since</p>
          <p style={infoValueStyle}>{user.createdAt.toLocaleDateString()}</p>

          <p style={infoLabelStyle}>Last Updated</p>
          <p style={infoValueStyle}>{user.updatedAt.toLocaleDateString()}</p>
        </div>

        <div style={buttonGroupStyle}>
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancel} testId="profile-cancel-button">
                Cancel
              </Button>
              <Button onClick={handleSave} testId="profile-save-button">
                Save Changes
              </Button>
            </>
          ) : (
            <Button onClick={handleEdit} testId="profile-edit-button">
              Edit Profile
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
