/**
 * @package @forge/ai-readiness
 * @description Score card component for displaying overall AI-readiness score
 */

import React from 'react';
import type { AIReadinessGrade } from '@forge/analysis';

/**
 * Score card props
 */
export interface ScoreCardProps {
  /** Overall score (0-100) */
  score: number;
  /** Letter grade */
  grade: AIReadinessGrade;
  /** Previous score for comparison */
  previousScore?: number;
  /** Show loading state */
  isLoading?: boolean;
  /** Card title */
  title?: string;
  /** Show grade description */
  showDescription?: boolean;
  /** Custom class name */
  className?: string;
  /** Custom styles */
  style?: React.CSSProperties;
}

/**
 * Get color for score
 */
function getScoreColor(score: number): string {
  if (score >= 90) return '#10b981'; // Green
  if (score >= 80) return '#22c55e'; // Light green
  if (score >= 70) return '#eab308'; // Yellow
  if (score >= 60) return '#f97316'; // Orange
  return '#ef4444'; // Red
}

/**
 * Get grade description
 */
function getGradeDescription(grade: AIReadinessGrade): string {
  switch (grade) {
    case 'A':
      return 'Excellent AI-readiness';
    case 'B':
      return 'Good AI-readiness';
    case 'C':
      return 'Fair AI-readiness';
    case 'D':
      return 'Poor AI-readiness';
    case 'F':
      return 'Not AI-ready';
  }
}

/**
 * Score card component
 */
export function ScoreCard({
  score,
  grade,
  previousScore,
  isLoading = false,
  title = 'AI-Readiness Score',
  showDescription = true,
  className = '',
  style,
}: ScoreCardProps): React.ReactElement {
  const scoreColor = getScoreColor(score);
  const change = previousScore !== undefined ? score - previousScore : undefined;

  const containerStyle: React.CSSProperties = {
    padding: '24px',
    borderRadius: '12px',
    backgroundColor: '#ffffff',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e5e7eb',
    ...style,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 500,
    color: '#6b7280',
    marginBottom: '16px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  const scoreContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
    marginBottom: '8px',
  };

  const scoreStyle: React.CSSProperties = {
    fontSize: '48px',
    fontWeight: 700,
    color: scoreColor,
    lineHeight: 1,
  };

  const maxScoreStyle: React.CSSProperties = {
    fontSize: '20px',
    color: '#9ca3af',
    fontWeight: 500,
  };

  const gradeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    backgroundColor: scoreColor,
    color: '#ffffff',
    fontSize: '20px',
    fontWeight: 700,
    marginLeft: '16px',
  };

  const changeStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 500,
    marginTop: '8px',
    color: change && change > 0 ? '#10b981' : change && change < 0 ? '#ef4444' : '#6b7280',
  };

  const descriptionStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#6b7280',
    marginTop: '12px',
  };

  if (isLoading) {
    return (
      <div className={className} style={containerStyle}>
        <div style={titleStyle}>{title}</div>
        <div style={{ ...scoreContainerStyle, opacity: 0.5 }}>
          <span style={scoreStyle}>--</span>
          <span style={maxScoreStyle}>/100</span>
          <span style={{ ...gradeStyle, backgroundColor: '#9ca3af' }}>-</span>
        </div>
        <div style={{ color: '#9ca3af', fontSize: '14px' }}>Loading assessment...</div>
      </div>
    );
  }

  return (
    <div className={className} style={containerStyle}>
      <div style={titleStyle}>{title}</div>
      <div style={scoreContainerStyle}>
        <span style={scoreStyle}>{score}</span>
        <span style={maxScoreStyle}>/100</span>
        <span style={gradeStyle}>{grade}</span>
      </div>
      {change !== undefined && (
        <div style={changeStyle}>
          {change > 0 ? '+' : ''}
          {change} points from previous assessment
        </div>
      )}
      {showDescription && <div style={descriptionStyle}>{getGradeDescription(grade)}</div>}
    </div>
  );
}
