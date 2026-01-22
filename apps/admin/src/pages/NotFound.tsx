/**
 * @prompt-id forge-v4.1:feature:admin:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Button, useTokens } from '@forge/design-system';
import type { PageMeta } from '../types';
import { ROUTES } from '../constants';

export const notFoundMeta: PageMeta = {
  title: '404 - Page Not Found',
  description: 'The requested page could not be found',
};

export function NotFound(): JSX.Element {
  const tokens = useTokens();

  const containerStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 'calc(100vh - 64px)',
      padding: tokens.spacing[6],
      textAlign: 'center' as const,
    }),
    [tokens]
  );

  const codeStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: '120px',
      fontWeight: tokens.typography.fontWeights.bold,
      color: tokens.colors.gray[200],
      lineHeight: 1,
      marginBottom: tokens.spacing[4],
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

  const descriptionStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes.base,
      color: tokens.colors.foreground.muted,
      marginBottom: tokens.spacing[6],
      maxWidth: '400px',
    }),
    [tokens]
  );

  return (
    <div style={containerStyle} data-testid="not-found-page">
      <div style={codeStyle}>404</div>
      <h1 style={titleStyle}>Page Not Found</h1>
      <p style={descriptionStyle}>
        Sorry, we couldn't find the page you're looking for. It might have been moved, deleted, or
        never existed.
      </p>
      <Link to={ROUTES.DASHBOARD} style={{ textDecoration: 'none' }}>
        <Button variant="solid" colorScheme="primary">
          Back to Dashboard
        </Button>
      </Link>
    </div>
  );
}
