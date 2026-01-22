/**
 * @prompt-id forge-v4.1:feature:portal:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { useMemo } from 'react';
import { Card, useTokens } from '@forge/design-system';
import type { PageMeta } from '../types';

export const dashboardMeta: PageMeta = {
  title: 'Dashboard',
  description: 'Overview of your account and recent activity',
};

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
}

function StatCard({ title, value, change, changeType = 'neutral' }: StatCardProps): JSX.Element {
  const tokens = useTokens();

  const changeColor = useMemo(() => {
    switch (changeType) {
      case 'positive':
        return tokens.colors.success[500];
      case 'negative':
        return tokens.colors.error[500];
      default:
        return tokens.colors.gray[500];
    }
  }, [changeType, tokens]);

  const cardStyle = useMemo<React.CSSProperties>(
    () => ({
      padding: tokens.spacing[6],
      minWidth: '200px',
    }),
    [tokens]
  );

  const titleStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes.sm,
      color: tokens.colors.foreground.muted,
      marginBottom: tokens.spacing[2],
      fontWeight: tokens.typography.fontWeights.medium,
    }),
    [tokens]
  );

  const valueStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes['3xl'],
      fontWeight: tokens.typography.fontWeights.bold,
      color: tokens.colors.foreground.primary,
      marginBottom: tokens.spacing[1],
    }),
    [tokens]
  );

  const changeStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes.sm,
      color: changeColor,
    }),
    [tokens, changeColor]
  );

  return (
    <Card variant="outlined" style={cardStyle}>
      <div style={titleStyle}>{title}</div>
      <div style={valueStyle}>{value}</div>
      {change && <div style={changeStyle}>{change}</div>}
    </Card>
  );
}

interface ActivityItemProps {
  title: string;
  description: string;
  time: string;
}

function ActivityItem({ title, description, time }: ActivityItemProps): JSX.Element {
  const tokens = useTokens();

  const containerStyle = useMemo<React.CSSProperties>(
    () => ({
      padding: `${tokens.spacing[4]} 0`,
      borderBottom: `1px solid ${tokens.colors.border.muted}`,
    }),
    [tokens]
  );

  const titleStyle = useMemo<React.CSSProperties>(
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
      fontSize: tokens.typography.fontSizes.sm,
      color: tokens.colors.foreground.muted,
      marginBottom: tokens.spacing[1],
    }),
    [tokens]
  );

  const timeStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes.xs,
      color: tokens.colors.gray[400],
    }),
    [tokens]
  );

  return (
    <div style={containerStyle}>
      <div style={titleStyle}>{title}</div>
      <div style={descriptionStyle}>{description}</div>
      <div style={timeStyle}>{time}</div>
    </div>
  );
}

export function Dashboard(): JSX.Element {
  const tokens = useTokens();

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

  const statsGridStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: tokens.spacing[4],
      marginBottom: tokens.spacing[8],
    }),
    [tokens]
  );

  const sectionTitleStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes.lg,
      fontWeight: tokens.typography.fontWeights.semibold,
      color: tokens.colors.foreground.primary,
      marginBottom: tokens.spacing[4],
    }),
    [tokens]
  );

  const activityCardStyle = useMemo<React.CSSProperties>(
    () => ({
      padding: tokens.spacing[6],
    }),
    [tokens]
  );

  return (
    <div style={containerStyle} data-testid="dashboard-page">
      <header style={headerStyle}>
        <h1 style={titleStyle}>{dashboardMeta.title}</h1>
        <p style={subtitleStyle}>{dashboardMeta.description}</p>
      </header>

      <section aria-label="Statistics">
        <div style={statsGridStyle}>
          <StatCard title="Total Projects" value={12} change="+2 this month" changeType="positive" />
          <StatCard title="Active Tasks" value={28} change="-3 from last week" changeType="negative" />
          <StatCard title="Team Members" value={8} />
          <StatCard title="Storage Used" value="2.4 GB" change="45% of quota" changeType="neutral" />
        </div>
      </section>

      <section aria-label="Recent Activity">
        <h2 style={sectionTitleStyle}>Recent Activity</h2>
        <Card variant="outlined" style={activityCardStyle}>
          <ActivityItem
            title="Project Updated"
            description="Marketing Campaign project was updated"
            time="2 hours ago"
          />
          <ActivityItem title="New Team Member" description="Sarah joined the team" time="5 hours ago" />
          <ActivityItem title="Task Completed" description="Website redesign milestone achieved" time="1 day ago" />
          <ActivityItem
            title="File Uploaded"
            description="Q4 Report.pdf was uploaded to Documents"
            time="2 days ago"
          />
        </Card>
      </section>
    </div>
  );
}
