/**
 * @package @forge/ai-readiness
 * @description Main dashboard component for AI-readiness assessment
 */

import React from 'react';
import type { AIReadinessAssessment, AssessmentDimension } from '../ai-readiness.types.js';
import { ScoreCard } from './ScoreCard.js';
import { ScoreBreakdown } from './ScoreBreakdown.js';
import { RecommendationList } from './RecommendationList.js';

/**
 * Assessment dashboard props
 */
export interface AssessmentDashboardProps {
  /** Assessment data */
  assessment: AIReadinessAssessment | null;
  /** Loading state */
  isLoading?: boolean;
  /** Previous assessment for comparison */
  previousAssessment?: AIReadinessAssessment | null;
  /** Show full details */
  showDetails?: boolean;
  /** Custom class name */
  className?: string;
  /** Custom styles */
  style?: React.CSSProperties;
  /** On dimension click */
  onDimensionClick?: (dimension: AssessmentDimension) => void;
}

/**
 * Stat card component
 */
function StatCard({
  label,
  value,
  subtitle,
  color = '#111827',
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}): React.ReactElement {
  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
      }}
    >
      <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ fontSize: '24px', fontWeight: 700, color, marginTop: '4px' }}>{value}</div>
      {subtitle && <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>{subtitle}</div>}
    </div>
  );
}

/**
 * Assessment dashboard component
 */
export function AssessmentDashboard({
  assessment,
  isLoading = false,
  previousAssessment,
  showDetails = true,
  className = '',
  style,
  onDimensionClick,
}: AssessmentDashboardProps): React.ReactElement {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    ...style,
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '24px',
  };

  const statsGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '16px',
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 600,
    color: '#111827',
    marginBottom: '16px',
  };

  if (isLoading || !assessment) {
    return (
      <div className={className} style={containerStyle}>
        <div style={gridStyle}>
          <ScoreCard
            score={0}
            grade="F"
            isLoading={true}
          />
          <ScoreBreakdown
            breakdown={{
              structuralQuality: 0,
              complexityManagement: 0,
              documentationCoverage: 0,
              testCoverage: 0,
              typeAnnotations: 0,
              namingClarity: 0,
              architecturalClarity: 0,
              toolingSupport: 0,
              githubReadiness: 0,
            }}
            isLoading={true}
          />
        </div>
      </div>
    );
  }

  const highPriorityCount = assessment.recommendations.filter((r) => r.priority === 'HIGH').length;
  const quickWinsCount = assessment.recommendations.filter(
    (r) => r.effort === 'LOW' && (r.impact === 'HIGH' || r.impact === 'MEDIUM')
  ).length;

  return (
    <div className={className} style={containerStyle}>
      {/* Main Score Section */}
      <div style={gridStyle}>
        <ScoreCard
          score={assessment.overallScore}
          grade={assessment.grade}
          previousScore={previousAssessment?.overallScore}
          title="AI-Readiness Score"
        />

        {/* Quick Stats */}
        <div>
          <div style={sectionTitleStyle}>Overview</div>
          <div style={statsGridStyle}>
            <StatCard
              label="Total Files"
              value={assessment.sourceAnalysis.totalFiles}
            />
            <StatCard
              label="Total Lines"
              value={assessment.sourceAnalysis.structural.totalLines.toLocaleString()}
            />
            <StatCard
              label="Issues"
              value={highPriorityCount}
              subtitle="high priority"
              color={highPriorityCount > 0 ? '#ef4444' : '#10b981'}
            />
            <StatCard
              label="Quick Wins"
              value={quickWinsCount}
              subtitle="low effort"
              color="#22c55e"
            />
          </div>
        </div>
      </div>

      {/* Effort Estimate */}
      <div
        style={{
          padding: '20px',
          backgroundColor: '#f0f9ff',
          borderRadius: '12px',
          border: '1px solid #bae6fd',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#0369a1' }}>
              Path to Score {assessment.effortEstimate.targetScore}+
            </div>
            <div style={{ fontSize: '14px', color: '#0284c7', marginTop: '4px' }}>
              Estimated {assessment.effortEstimate.totalHours} hours of work across{' '}
              {assessment.recommendations.length} improvements
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#0369a1' }}>
              {assessment.effortEstimate.targetScore - assessment.overallScore > 0 ? '+' : ''}
              {assessment.effortEstimate.targetScore - assessment.overallScore}
            </div>
            <div style={{ fontSize: '12px', color: '#0284c7' }}>potential points</div>
          </div>
        </div>
      </div>

      {/* Score Breakdown */}
      <div>
        <div style={sectionTitleStyle}>Dimension Scores</div>
        <ScoreBreakdown
          breakdown={assessment.breakdown}
          showWeights={true}
          highlightBelowThreshold={70}
          onDimensionClick={onDimensionClick}
        />
      </div>

      {/* Recommendations */}
      {showDetails && assessment.recommendations.length > 0 && (
        <div>
          <RecommendationList
            recommendations={assessment.recommendations}
            expandedByDefault={false}
          />
        </div>
      )}

      {/* Tooling & GitHub Status */}
      {showDetails && (
        <div style={gridStyle}>
          {/* Tooling Status */}
          <div
            style={{
              padding: '20px',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
            }}
          >
            <div style={sectionTitleStyle}>Development Tools</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <ToolingBadge label="ESLint" active={assessment.tooling.hasEslint} />
              <ToolingBadge label="Prettier" active={assessment.tooling.hasPrettier} />
              <ToolingBadge label="Pylint" active={assessment.tooling.hasPylint} />
              <ToolingBadge label="Black" active={assessment.tooling.hasBlack} />
              <ToolingBadge
                label={assessment.tooling.packageManager || 'Package Manager'}
                active={assessment.tooling.hasPackageManager}
              />
              <ToolingBadge
                label={assessment.tooling.buildTool || 'Build Tool'}
                active={assessment.tooling.hasBuildTool}
              />
              <ToolingBadge label="Pre-commit" active={assessment.tooling.hasPreCommitHooks} />
            </div>
          </div>

          {/* GitHub Status */}
          <div
            style={{
              padding: '20px',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
            }}
          >
            <div style={sectionTitleStyle}>GitHub Readiness</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <ToolingBadge label="CLAUDE.md" active={assessment.githubReadiness.hasClaudeMd} />
              <ToolingBadge label=".cursorrules" active={assessment.githubReadiness.hasCursorRules} />
              <ToolingBadge label="GitHub Actions" active={assessment.githubReadiness.hasGitHubActions} />
              <ToolingBadge label="PR Template" active={assessment.githubReadiness.hasPrTemplate} />
              <ToolingBadge label="README" active={assessment.githubReadiness.hasReadme} />
              <ToolingBadge label="CONTRIBUTING" active={assessment.githubReadiness.hasContributing} />
              <ToolingBadge label="ADRs" active={assessment.githubReadiness.hasADRs} />
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          fontSize: '12px',
          color: '#9ca3af',
          textAlign: 'center',
          padding: '16px',
        }}
      >
        Assessment completed in {assessment.assessmentDuration}ms •{' '}
        {assessment.assessedAt.toLocaleString()}
      </div>
    </div>
  );
}

/**
 * Tooling badge component
 */
function ToolingBadge({ label, active }: { label: string; active: boolean }): React.ReactElement {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 10px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: 500,
        backgroundColor: active ? '#dcfce7' : '#f3f4f6',
        color: active ? '#166534' : '#9ca3af',
        border: `1px solid ${active ? '#bbf7d0' : '#e5e7eb'}`,
      }}
    >
      <span>{active ? '✓' : '✗'}</span>
      {label}
    </span>
  );
}
