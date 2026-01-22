/**
 * @package @forge/ai-readiness
 * @description Score breakdown component for displaying dimension scores
 */

import React from 'react';
import type { FullScoreBreakdown, AssessmentDimension } from '../ai-readiness.types.js';
import { DIMENSION_INFO } from '../ai-readiness.types.js';

/**
 * Score breakdown props
 */
export interface ScoreBreakdownProps {
  /** Score breakdown by dimension */
  breakdown: FullScoreBreakdown;
  /** Show loading state */
  isLoading?: boolean;
  /** Show weights */
  showWeights?: boolean;
  /** Highlight dimensions below threshold */
  highlightBelowThreshold?: number;
  /** Custom class name */
  className?: string;
  /** Custom styles */
  style?: React.CSSProperties;
  /** On dimension click callback */
  onDimensionClick?: (dimension: AssessmentDimension) => void;
}

/**
 * Get color for score
 */
function getScoreColor(score: number): string {
  if (score >= 90) return '#10b981';
  if (score >= 80) return '#22c55e';
  if (score >= 70) return '#eab308';
  if (score >= 60) return '#f97316';
  return '#ef4444';
}

/**
 * Get background color for score
 */
function getScoreBackgroundColor(score: number): string {
  if (score >= 90) return '#d1fae5';
  if (score >= 80) return '#dcfce7';
  if (score >= 70) return '#fef9c3';
  if (score >= 60) return '#ffedd5';
  return '#fee2e2';
}

/**
 * Dimension row component
 */
function DimensionRow({
  dimension,
  score,
  showWeight,
  highlightBelowThreshold,
  onClick,
}: {
  dimension: AssessmentDimension;
  score: number;
  showWeight: boolean;
  highlightBelowThreshold?: number;
  onClick?: (dimension: AssessmentDimension) => void;
}): React.ReactElement {
  const info = DIMENSION_INFO[dimension];
  const isBelow = highlightBelowThreshold !== undefined && score < highlightBelowThreshold;
  const color = getScoreColor(score);
  const bgColor = getScoreBackgroundColor(score);

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid #f3f4f6',
    cursor: onClick ? 'pointer' : 'default',
    backgroundColor: isBelow ? '#fef2f2' : 'transparent',
    transition: 'background-color 0.2s',
  };

  const labelContainerStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 500,
    color: '#374151',
    marginBottom: '2px',
  };

  const descriptionStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#9ca3af',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const progressContainerStyle: React.CSSProperties = {
    width: '120px',
    marginRight: '16px',
  };

  const progressBarStyle: React.CSSProperties = {
    height: '8px',
    borderRadius: '4px',
    backgroundColor: '#f3f4f6',
    overflow: 'hidden',
  };

  const progressFillStyle: React.CSSProperties = {
    height: '100%',
    width: `${score}%`,
    backgroundColor: color,
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  };

  const scoreStyle: React.CSSProperties = {
    minWidth: '48px',
    textAlign: 'right',
    fontSize: '14px',
    fontWeight: 600,
    color,
    padding: '4px 8px',
    borderRadius: '4px',
    backgroundColor: bgColor,
  };

  const weightStyle: React.CSSProperties = {
    minWidth: '48px',
    textAlign: 'right',
    fontSize: '12px',
    color: '#9ca3af',
    marginLeft: '8px',
  };

  return (
    <div
      style={rowStyle}
      onClick={() => onClick?.(dimension)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick?.(dimension);
        }
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div style={labelContainerStyle}>
        <div style={labelStyle}>{info.name}</div>
        <div style={descriptionStyle}>{info.description}</div>
      </div>
      <div style={progressContainerStyle}>
        <div style={progressBarStyle}>
          <div style={progressFillStyle} />
        </div>
      </div>
      <div style={scoreStyle}>{score}</div>
      {showWeight && <div style={weightStyle}>{Math.round(info.weight * 100)}%</div>}
    </div>
  );
}

/**
 * Score breakdown component
 */
export function ScoreBreakdown({
  breakdown,
  isLoading = false,
  showWeights = true,
  highlightBelowThreshold = 70,
  className = '',
  style,
  onDimensionClick,
}: ScoreBreakdownProps): React.ReactElement {
  const containerStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
    ...style,
  };

  const headerStyle: React.CSSProperties = {
    padding: '16px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: 600,
    color: '#111827',
    marginBottom: '4px',
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#6b7280',
  };

  const dimensions: Array<{ key: AssessmentDimension; score: number }> = [
    { key: 'structuralQuality', score: breakdown.structuralQuality },
    { key: 'complexityManagement', score: breakdown.complexityManagement },
    { key: 'documentationCoverage', score: breakdown.documentationCoverage },
    { key: 'testCoverage', score: breakdown.testCoverage },
    { key: 'typeAnnotations', score: breakdown.typeAnnotations },
    { key: 'namingClarity', score: breakdown.namingClarity },
    { key: 'architecturalClarity', score: breakdown.architecturalClarity },
    { key: 'toolingSupport', score: breakdown.toolingSupport },
    { key: 'githubReadiness', score: breakdown.githubReadiness },
  ];

  if (isLoading) {
    return (
      <div className={className} style={containerStyle}>
        <div style={headerStyle}>
          <div style={titleStyle}>Score Breakdown</div>
          <div style={subtitleStyle}>Loading...</div>
        </div>
        <div style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>
          Loading dimension scores...
        </div>
      </div>
    );
  }

  const belowThresholdCount = dimensions.filter((d) => d.score < highlightBelowThreshold).length;

  return (
    <div className={className} style={containerStyle}>
      <div style={headerStyle}>
        <div style={titleStyle}>Score Breakdown</div>
        <div style={subtitleStyle}>
          {belowThresholdCount > 0
            ? `${belowThresholdCount} dimension${belowThresholdCount > 1 ? 's' : ''} need attention`
            : 'All dimensions in good standing'}
        </div>
      </div>
      <div>
        {dimensions.map(({ key, score }) => (
          <DimensionRow
            key={key}
            dimension={key}
            score={score}
            showWeight={showWeights}
            highlightBelowThreshold={highlightBelowThreshold}
            onClick={onDimensionClick}
          />
        ))}
      </div>
    </div>
  );
}
