/**
 * @prompt-id forge-v4.1:feature:portal:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Button, useTokens } from '@forge/design-system';
import { ROUTES } from '../constants';
import type { PageMeta } from '../types';

export const notFoundMeta: PageMeta = {
  title: 'Page Not Found',
  description: 'The page you are looking for does not exist',
};

export function NotFound(): JSX.Element {
  const tokens = useTokens();

  const containerStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      padding: tokens.spacing[6],
      textAlign: 'center' as const,
    }),
    [tokens]
  );

  const errorCodeStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: '8rem',
      fontWeight: tokens.typography.fontWeights.bold,
      color: tokens.colors.primary[500],
      lineHeight: 1,
      marginBottom: tokens.spacing[4],
    }),
    [tokens]
  );

  const titleStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes['2xl'],
      fontWeight: tokens.typography.fontWeights.semibold,
      color: tokens.colors.foreground.primary,
      marginBottom: tokens.spacing[2],
    }),
    [tokens]
  );

  const descriptionStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes.base,
      color: tokens.colors.foreground.muted,
      marginBottom: tokens.spacing[8],
      maxWidth: '400px',
    }),
    [tokens]
  );

  const linkStyle = useMemo<React.CSSProperties>(
    () => ({
      textDecoration: 'none',
    }),
    []
  );

  return (
    <div style={containerStyle} data-testid="not-found-page" role="main" aria-labelledby="not-found-title">
      <div style={errorCodeStyle} aria-hidden="true">
        404
      </div>
      <h1 id="not-found-title" style={titleStyle}>
        {notFoundMeta.title}
      </h1>
      <p style={descriptionStyle}>{notFoundMeta.description}</p>
      <Link to={ROUTES.DASHBOARD} style={linkStyle}>
        <Button testId="not-found-home-button">Go to Dashboard</Button>
      </Link>
    </div>
  );
}
