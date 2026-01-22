/**
 * @package @forge/ai-readiness
 * @description Recommendation list component for displaying improvement suggestions
 */

import React, { useState } from 'react';
import type {
  ImprovementRecommendation,
  Priority,
  EffortLevel,
  AssessmentDimension,
} from '../ai-readiness.types.js';
import { DIMENSION_INFO } from '../ai-readiness.types.js';

/**
 * Recommendation list props
 */
export interface RecommendationListProps {
  /** List of recommendations */
  recommendations: ImprovementRecommendation[];
  /** Show loading state */
  isLoading?: boolean;
  /** Show expanded details by default */
  expandedByDefault?: boolean;
  /** Filter by priority */
  filterPriority?: Priority;
  /** Filter by dimension */
  filterDimension?: AssessmentDimension;
  /** Maximum items to show */
  maxItems?: number;
  /** Custom class name */
  className?: string;
  /** Custom styles */
  style?: React.CSSProperties;
  /** On recommendation click */
  onRecommendationClick?: (recommendation: ImprovementRecommendation) => void;
}

/**
 * Get color for priority
 */
function getPriorityColor(priority: Priority): string {
  switch (priority) {
    case 'HIGH':
      return '#ef4444';
    case 'MEDIUM':
      return '#f97316';
    case 'LOW':
      return '#22c55e';
  }
}

/**
 * Get background color for priority
 */
function getPriorityBgColor(priority: Priority): string {
  switch (priority) {
    case 'HIGH':
      return '#fee2e2';
    case 'MEDIUM':
      return '#ffedd5';
    case 'LOW':
      return '#dcfce7';
  }
}

/**
 * Get effort badge color
 */
function getEffortColor(effort: EffortLevel): string {
  switch (effort) {
    case 'LOW':
      return '#10b981';
    case 'MEDIUM':
      return '#eab308';
    case 'HIGH':
      return '#ef4444';
  }
}

/**
 * Recommendation card component
 */
function RecommendationCard({
  recommendation,
  expanded,
  onToggle,
  onClick,
}: {
  recommendation: ImprovementRecommendation;
  expanded: boolean;
  onToggle: () => void;
  onClick?: (rec: ImprovementRecommendation) => void;
}): React.ReactElement {
  const dimensionInfo = DIMENSION_INFO[recommendation.dimension];
  const priorityColor = getPriorityColor(recommendation.priority);
  const priorityBgColor = getPriorityBgColor(recommendation.priority);
  const effortColor = getEffortColor(recommendation.effort);

  const cardStyle: React.CSSProperties = {
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    marginBottom: '12px',
    backgroundColor: '#ffffff',
    transition: 'box-shadow 0.2s',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: expanded ? '12px' : '0',
  };

  const titleContainerStyle: React.CSSProperties = {
    flex: 1,
    cursor: onClick ? 'pointer' : 'default',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '15px',
    fontWeight: 600,
    color: '#111827',
    marginBottom: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: '9999px',
    fontSize: '11px',
    fontWeight: 500,
  };

  const priorityBadgeStyle: React.CSSProperties = {
    ...badgeStyle,
    color: priorityColor,
    backgroundColor: priorityBgColor,
  };

  const effortBadgeStyle: React.CSSProperties = {
    ...badgeStyle,
    color: effortColor,
    backgroundColor: `${effortColor}20`,
  };

  const automationBadgeStyle: React.CSSProperties = {
    ...badgeStyle,
    color: '#6366f1',
    backgroundColor: '#eef2ff',
  };

  const descriptionStyle: React.CSSProperties = {
    fontSize: '13px',
    color: '#6b7280',
    marginTop: '4px',
  };

  const metaStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    marginTop: '8px',
  };

  const statsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '16px',
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #f3f4f6',
    fontSize: '13px',
  };

  const statStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
  };

  const statLabelStyle: React.CSSProperties = {
    color: '#9ca3af',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  const statValueStyle: React.CSSProperties = {
    color: '#374151',
    fontWeight: 500,
    marginTop: '2px',
  };

  const expandButtonStyle: React.CSSProperties = {
    padding: '4px 8px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: '#6b7280',
    fontSize: '12px',
    marginLeft: '8px',
  };

  const actionStepsStyle: React.CSSProperties = {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #f3f4f6',
  };

  const stepStyle: React.CSSProperties = {
    fontSize: '13px',
    color: '#374151',
    padding: '4px 0',
    paddingLeft: '20px',
    position: 'relative',
  };

  const stepNumberStyle: React.CSSProperties = {
    position: 'absolute',
    left: '0',
    color: '#9ca3af',
    fontWeight: 500,
  };

  const filesStyle: React.CSSProperties = {
    marginTop: '12px',
    padding: '8px 12px',
    backgroundColor: '#f9fafb',
    borderRadius: '6px',
    fontSize: '12px',
    fontFamily: 'monospace',
    color: '#6b7280',
    maxHeight: '120px',
    overflow: 'auto',
  };

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div style={titleContainerStyle} onClick={() => onClick?.(recommendation)}>
          <div style={titleStyle}>
            {recommendation.title}
            {recommendation.automationAvailable && (
              <span style={automationBadgeStyle}>Auto</span>
            )}
          </div>
          <div style={descriptionStyle}>{recommendation.description}</div>
          <div style={metaStyle}>
            <span style={priorityBadgeStyle}>{recommendation.priority} Priority</span>
            <span style={effortBadgeStyle}>{recommendation.effort} Effort</span>
            <span style={{ ...badgeStyle, color: '#6b7280', backgroundColor: '#f3f4f6' }}>
              {dimensionInfo.name}
            </span>
          </div>
        </div>
        <button style={expandButtonStyle} onClick={onToggle}>
          {expanded ? '▲ Less' : '▼ More'}
        </button>
      </div>

      {expanded && (
        <>
          <div style={statsStyle}>
            <div style={statStyle}>
              <span style={statLabelStyle}>Impact</span>
              <span style={statValueStyle}>+{recommendation.estimatedImpact} points</span>
            </div>
            <div style={statStyle}>
              <span style={statLabelStyle}>Effort</span>
              <span style={statValueStyle}>{recommendation.estimatedHours}h</span>
            </div>
            <div style={statStyle}>
              <span style={statLabelStyle}>Files</span>
              <span style={statValueStyle}>{recommendation.affectedFiles.length}</span>
            </div>
          </div>

          {recommendation.actionSteps && recommendation.actionSteps.length > 0 && (
            <div style={actionStepsStyle}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                Action Steps
              </div>
              {recommendation.actionSteps.map((step, index) => (
                <div key={index} style={stepStyle}>
                  <span style={stepNumberStyle}>{index + 1}.</span>
                  {step}
                </div>
              ))}
            </div>
          )}

          {recommendation.affectedFiles.length > 0 && (
            <div style={filesStyle}>
              {recommendation.affectedFiles.slice(0, 10).map((file, index) => (
                <div key={index}>{file}</div>
              ))}
              {recommendation.affectedFiles.length > 10 && (
                <div style={{ marginTop: '4px', fontStyle: 'italic' }}>
                  ...and {recommendation.affectedFiles.length - 10} more files
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Recommendation list component
 */
export function RecommendationList({
  recommendations,
  isLoading = false,
  expandedByDefault = false,
  filterPriority,
  filterDimension,
  maxItems,
  className = '',
  style,
  onRecommendationClick,
}: RecommendationListProps): React.ReactElement {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    expandedByDefault ? new Set(recommendations.map((r) => r.id)) : new Set()
  );

  const containerStyle: React.CSSProperties = {
    ...style,
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 600,
    color: '#111827',
  };

  const countStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#6b7280',
  };

  // Filter recommendations
  let filtered = recommendations;
  if (filterPriority) {
    filtered = filtered.filter((r) => r.priority === filterPriority);
  }
  if (filterDimension) {
    filtered = filtered.filter((r) => r.dimension === filterDimension);
  }
  if (maxItems) {
    filtered = filtered.slice(0, maxItems);
  }

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className={className} style={containerStyle}>
        <div style={headerStyle}>
          <div style={titleStyle}>Recommendations</div>
        </div>
        <div style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>
          Loading recommendations...
        </div>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className={className} style={containerStyle}>
        <div style={headerStyle}>
          <div style={titleStyle}>Recommendations</div>
        </div>
        <div
          style={{
            padding: '32px',
            textAlign: 'center',
            color: '#6b7280',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
          }}
        >
          No recommendations - your codebase is already well-optimized!
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={containerStyle}>
      <div style={headerStyle}>
        <div style={titleStyle}>Recommendations</div>
        <div style={countStyle}>
          {filtered.length} item{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>
      {filtered.map((rec) => (
        <RecommendationCard
          key={rec.id}
          recommendation={rec}
          expanded={expandedIds.has(rec.id)}
          onToggle={() => toggleExpanded(rec.id)}
          onClick={onRecommendationClick}
        />
      ))}
    </div>
  );
}
