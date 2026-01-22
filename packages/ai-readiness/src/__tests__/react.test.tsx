/**
 * @package @forge/ai-readiness
 * @description Tests for React components and hooks
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  AIReadinessProvider,
  useAIReadinessContext,
} from '../react/AIReadinessProvider.js';
import {
  useAssessment,
  useAssessmentScore,
  useRecommendations,
  useDimensionScore,
  useEffortEstimate,
} from '../react/hooks.js';
import { ScoreCard } from '../react/ScoreCard.js';
import { ScoreBreakdown } from '../react/ScoreBreakdown.js';
import { RecommendationList } from '../react/RecommendationList.js';
import { AssessmentDashboard } from '../react/AssessmentDashboard.js';
import type { AIReadinessAssessment, ImprovementRecommendation } from '../ai-readiness.types.js';

// Helper to create mock assessment
function createMockAssessment(): AIReadinessAssessment {
  return {
    overallScore: 75,
    grade: 'C',
    breakdown: {
      structuralQuality: 80,
      complexityManagement: 70,
      documentationCoverage: 65,
      testCoverage: 85,
      typeAnnotations: 75,
      namingClarity: 70,
      architecturalClarity: 75,
      toolingSupport: 90,
      githubReadiness: 70,
    },
    dimensionScores: new Map([
      ['structuralQuality', { score: 80, penalties: [], bonuses: [] }],
      ['complexityManagement', { score: 70, penalties: [{ amount: 10, reason: 'High complexity' }], bonuses: [] }],
    ]),
    recommendations: [
      {
        id: 'rec1',
        priority: 'HIGH',
        impact: 'HIGH',
        effort: 'MEDIUM',
        title: 'Reduce Complexity',
        description: 'Reduce function complexity',
        dimension: 'complexityManagement',
        estimatedImpact: 15,
        estimatedHours: 20,
        automationAvailable: true,
        affectedFiles: ['src/test.ts'],
        actionSteps: ['Step 1', 'Step 2'],
      },
      {
        id: 'rec2',
        priority: 'LOW',
        impact: 'MEDIUM',
        effort: 'LOW',
        title: 'Add Docs',
        description: 'Add documentation',
        dimension: 'documentationCoverage',
        estimatedImpact: 5,
        estimatedHours: 2,
        automationAvailable: false,
        affectedFiles: [],
      },
    ],
    effortEstimate: {
      totalHours: 22,
      byDimension: {
        structuralQuality: 0,
        complexityManagement: 20,
        documentationCoverage: 2,
        testCoverage: 0,
        typeAnnotations: 0,
        namingClarity: 0,
        architecturalClarity: 0,
        toolingSupport: 0,
        githubReadiness: 0,
      },
      targetScore: 85,
      byPriority: { high: 20, medium: 0, low: 2 },
    },
    details: {
      largeFiles: [],
      complexFunctions: [],
      functionsNeedingAttention: [],
      antiPatternsByCategory: {},
      filesMissingDocs: [],
      filesMissingTests: [],
    },
    tooling: {
      hasEslint: true,
      hasPrettier: true,
      hasPylint: false,
      hasBlack: false,
      hasRubocop: false,
      hasGofmt: false,
      hasPackageManager: true,
      packageManager: 'npm',
      hasBuildTool: true,
      buildTool: 'vite',
      hasPreCommitHooks: true,
      hasHusky: true,
    },
    githubReadiness: {
      hasClaudeMd: true,
      hasCursorRules: false,
      hasGitHubActions: true,
      hasCircleCI: false,
      hasJenkins: false,
      hasPrTemplate: true,
      hasIssueTemplates: false,
      hasContributing: false,
      hasBranchProtection: false,
      hasReadme: true,
      hasCodeowners: false,
      hasADRs: false,
    },
    sourceAnalysis: {
      repositoryPath: '/test',
      totalFiles: 50,
      languageBreakdown: [{ language: 'typescript', percentage: 100, fileCount: 50, linesOfCode: 5000 }],
      structural: {
        totalLines: 5000,
        codeLines: 4000,
        commentLines: 500,
        blankLines: 500,
        functionCount: 100,
        classCount: 20,
        interfaceCount: 15,
        importCount: 200,
        exportCount: 100,
        averageFunctionSize: 20,
        largestFunctionSize: 50,
        filesOver500LOC: 0,
        totalFiles: 50,
        averageFileSize: 100,
      },
      complexity: {
        averageCyclomaticComplexity: 5,
        maxCyclomaticComplexity: 12,
        functionsOverComplexity10: 5,
        averageCognitiveComplexity: 8,
        averageNestingDepth: 2,
        maxNestingDepth: 4,
        functionsWithDeepNesting: 3,
        averageParameterCount: 2,
        functionsWithManyParameters: 2,
        functions: [],
      },
      quality: {
        typeAnnotationCoverage: 0.75,
        documentationCoverage: 0.65,
        testCoverage: 85,
        antiPatternCount: 10,
        antiPatternsBySeverity: { low: 5, medium: 4, high: 1, critical: 0 },
        filesMissingDocumentation: 5,
        functionsMissingDocumentation: 15,
      },
      aiReadiness: {} as any,
      antiPatterns: [],
      analyzedAt: new Date(),
      analysisDuration: 1000,
    },
    assessedAt: new Date(),
    assessmentDuration: 1000,
  };
}

// Test component for hooks
function TestHookComponent({ hook }: { hook: () => any }) {
  const result = hook();
  return <div data-testid="result">{JSON.stringify(result)}</div>;
}

describe('AIReadinessProvider', () => {
  it('should provide context to children', () => {
    const TestChild = () => {
      const context = useAIReadinessContext();
      return <div data-testid="has-context">{context ? 'yes' : 'no'}</div>;
    };

    render(
      <AIReadinessProvider>
        <TestChild />
      </AIReadinessProvider>
    );

    expect(screen.getByTestId('has-context').textContent).toBe('yes');
  });

  it('should accept initial assessment', () => {
    const assessment = createMockAssessment();
    const TestChild = () => {
      const { assessment: ctxAssessment } = useAIReadinessContext();
      return <div data-testid="score">{ctxAssessment?.overallScore || 0}</div>;
    };

    render(
      <AIReadinessProvider initialAssessment={assessment}>
        <TestChild />
      </AIReadinessProvider>
    );

    expect(screen.getByTestId('score').textContent).toBe('75');
  });

  it('should throw error when used outside provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestHookComponent hook={useAIReadinessContext} />);
    }).toThrow('useAIReadinessContext must be used within an AIReadinessProvider');

    consoleError.mockRestore();
  });

  it('should allow setting assessment', () => {
    const assessment = createMockAssessment();
    const TestChild = () => {
      const { assessment: ctxAssessment, setAssessment } = useAIReadinessContext();
      return (
        <div>
          <div data-testid="score">{ctxAssessment?.overallScore || 0}</div>
          <button onClick={() => setAssessment(assessment)}>Set</button>
        </div>
      );
    };

    render(
      <AIReadinessProvider>
        <TestChild />
      </AIReadinessProvider>
    );

    expect(screen.getByTestId('score').textContent).toBe('0');
    fireEvent.click(screen.getByText('Set'));
    expect(screen.getByTestId('score').textContent).toBe('75');
  });

  it('should allow clearing assessment', () => {
    const assessment = createMockAssessment();
    const TestChild = () => {
      const { assessment: ctxAssessment, clearAssessment } = useAIReadinessContext();
      return (
        <div>
          <div data-testid="score">{ctxAssessment?.overallScore || 0}</div>
          <button onClick={clearAssessment}>Clear</button>
        </div>
      );
    };

    render(
      <AIReadinessProvider initialAssessment={assessment}>
        <TestChild />
      </AIReadinessProvider>
    );

    expect(screen.getByTestId('score').textContent).toBe('75');
    fireEvent.click(screen.getByText('Clear'));
    expect(screen.getByTestId('score').textContent).toBe('0');
  });

  it('should get dimension score', () => {
    const assessment = createMockAssessment();
    const TestChild = () => {
      const { getDimensionScore } = useAIReadinessContext();
      return <div data-testid="score">{getDimensionScore('structuralQuality')}</div>;
    };

    render(
      <AIReadinessProvider initialAssessment={assessment}>
        <TestChild />
      </AIReadinessProvider>
    );

    expect(screen.getByTestId('score').textContent).toBe('80');
  });

  it('should get recommendations for dimension', () => {
    const assessment = createMockAssessment();
    const TestChild = () => {
      const { getRecommendationsForDimension } = useAIReadinessContext();
      const recs = getRecommendationsForDimension('complexityManagement');
      return <div data-testid="count">{recs.length}</div>;
    };

    render(
      <AIReadinessProvider initialAssessment={assessment}>
        <TestChild />
      </AIReadinessProvider>
    );

    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('should get high priority recommendations', () => {
    const assessment = createMockAssessment();
    const TestChild = () => {
      const { getHighPriorityRecommendations } = useAIReadinessContext();
      const recs = getHighPriorityRecommendations();
      return <div data-testid="count">{recs.length}</div>;
    };

    render(
      <AIReadinessProvider initialAssessment={assessment}>
        <TestChild />
      </AIReadinessProvider>
    );

    expect(screen.getByTestId('count').textContent).toBe('1');
  });
});

describe('useAssessment hook', () => {
  it('should return assessment data', () => {
    const assessment = createMockAssessment();
    const TestChild = () => {
      const { assessment: result, isLoading, error } = useAssessment();
      return (
        <div>
          <div data-testid="score">{result?.overallScore || 0}</div>
          <div data-testid="loading">{isLoading ? 'true' : 'false'}</div>
          <div data-testid="error">{error ? 'yes' : 'no'}</div>
        </div>
      );
    };

    render(
      <AIReadinessProvider initialAssessment={assessment}>
        <TestChild />
      </AIReadinessProvider>
    );

    expect(screen.getByTestId('score').textContent).toBe('75');
    expect(screen.getByTestId('loading').textContent).toBe('false');
    expect(screen.getByTestId('error').textContent).toBe('no');
  });
});

describe('useAssessmentScore hook', () => {
  it('should return score and grade', () => {
    const assessment = createMockAssessment();
    const TestChild = () => {
      const { score, grade, isLoading } = useAssessmentScore();
      return (
        <div>
          <div data-testid="score">{score}</div>
          <div data-testid="grade">{grade}</div>
          <div data-testid="loading">{isLoading ? 'true' : 'false'}</div>
        </div>
      );
    };

    render(
      <AIReadinessProvider initialAssessment={assessment}>
        <TestChild />
      </AIReadinessProvider>
    );

    expect(screen.getByTestId('score').textContent).toBe('75');
    expect(screen.getByTestId('grade').textContent).toBe('C');
  });
});

describe('useRecommendations hook', () => {
  it('should return all recommendations', () => {
    const assessment = createMockAssessment();
    const TestChild = () => {
      const { recommendations, totalCount } = useRecommendations();
      return (
        <div>
          <div data-testid="count">{recommendations.length}</div>
          <div data-testid="total">{totalCount}</div>
        </div>
      );
    };

    render(
      <AIReadinessProvider initialAssessment={assessment}>
        <TestChild />
      </AIReadinessProvider>
    );

    expect(screen.getByTestId('count').textContent).toBe('2');
    expect(screen.getByTestId('total').textContent).toBe('2');
  });

  it('should filter by priority', () => {
    const assessment = createMockAssessment();
    const TestChild = () => {
      const { recommendations } = useRecommendations({ priority: 'HIGH' });
      return <div data-testid="count">{recommendations.length}</div>;
    };

    render(
      <AIReadinessProvider initialAssessment={assessment}>
        <TestChild />
      </AIReadinessProvider>
    );

    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('should filter by dimension', () => {
    const assessment = createMockAssessment();
    const TestChild = () => {
      const { recommendations } = useRecommendations({ dimension: 'complexityManagement' });
      return <div data-testid="count">{recommendations.length}</div>;
    };

    render(
      <AIReadinessProvider initialAssessment={assessment}>
        <TestChild />
      </AIReadinessProvider>
    );

    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('should limit results', () => {
    const assessment = createMockAssessment();
    const TestChild = () => {
      const { recommendations, totalCount } = useRecommendations({ limit: 1 });
      return (
        <div>
          <div data-testid="count">{recommendations.length}</div>
          <div data-testid="total">{totalCount}</div>
        </div>
      );
    };

    render(
      <AIReadinessProvider initialAssessment={assessment}>
        <TestChild />
      </AIReadinessProvider>
    );

    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('total').textContent).toBe('2');
  });
});

describe('useDimensionScore hook', () => {
  it('should return dimension score with details', () => {
    const assessment = createMockAssessment();
    const TestChild = () => {
      const { score, penalties, bonuses } = useDimensionScore('complexityManagement');
      return (
        <div>
          <div data-testid="score">{score}</div>
          <div data-testid="penalties">{penalties.length}</div>
          <div data-testid="bonuses">{bonuses.length}</div>
        </div>
      );
    };

    render(
      <AIReadinessProvider initialAssessment={assessment}>
        <TestChild />
      </AIReadinessProvider>
    );

    expect(screen.getByTestId('score').textContent).toBe('70');
    expect(screen.getByTestId('penalties').textContent).toBe('1');
    expect(screen.getByTestId('bonuses').textContent).toBe('0');
  });
});

describe('useEffortEstimate hook', () => {
  it('should return effort estimate', () => {
    const assessment = createMockAssessment();
    const TestChild = () => {
      const { totalHours, targetScore, estimate } = useEffortEstimate();
      return (
        <div>
          <div data-testid="hours">{totalHours}</div>
          <div data-testid="target">{targetScore}</div>
          <div data-testid="has-estimate">{estimate ? 'yes' : 'no'}</div>
        </div>
      );
    };

    render(
      <AIReadinessProvider initialAssessment={assessment}>
        <TestChild />
      </AIReadinessProvider>
    );

    expect(screen.getByTestId('hours').textContent).toBe('22');
    expect(screen.getByTestId('target').textContent).toBe('85');
    expect(screen.getByTestId('has-estimate').textContent).toBe('yes');
  });
});

describe('ScoreCard', () => {
  it('should render score and grade', () => {
    render(<ScoreCard score={75} grade="C" />);

    expect(screen.getByText('75')).toBeDefined();
    expect(screen.getByText('C')).toBeDefined();
    expect(screen.getByText('/100')).toBeDefined();
  });

  it('should show loading state', () => {
    render(<ScoreCard score={0} grade="F" isLoading={true} />);

    expect(screen.getByText('Loading assessment...')).toBeDefined();
  });

  it('should show custom title', () => {
    render(<ScoreCard score={75} grade="C" title="Custom Title" />);

    expect(screen.getByText('Custom Title')).toBeDefined();
  });

  it('should show change from previous', () => {
    render(<ScoreCard score={75} grade="C" previousScore={65} />);

    expect(screen.getByText(/\+10 points/)).toBeDefined();
  });

  it('should show negative change', () => {
    render(<ScoreCard score={65} grade="D" previousScore={75} />);

    expect(screen.getByText(/-10 points/)).toBeDefined();
  });

  it('should show grade description', () => {
    render(<ScoreCard score={75} grade="C" showDescription={true} />);

    expect(screen.getByText(/Fair AI-readiness/)).toBeDefined();
  });

  it('should hide grade description', () => {
    render(<ScoreCard score={75} grade="C" showDescription={false} />);

    expect(screen.queryByText(/Fair AI-readiness/)).toBeNull();
  });
});

describe('ScoreBreakdown', () => {
  const breakdown = {
    structuralQuality: 80,
    complexityManagement: 70,
    documentationCoverage: 65,
    testCoverage: 85,
    typeAnnotations: 75,
    namingClarity: 70,
    architecturalClarity: 75,
    toolingSupport: 90,
    githubReadiness: 70,
  };

  it('should render all dimensions', () => {
    render(<ScoreBreakdown breakdown={breakdown} />);

    expect(screen.getByText('Structural Quality')).toBeDefined();
    expect(screen.getByText('Complexity Management')).toBeDefined();
    expect(screen.getByText('Documentation Coverage')).toBeDefined();
    expect(screen.getByText('Test Coverage')).toBeDefined();
    expect(screen.getByText('Type Annotations')).toBeDefined();
    expect(screen.getByText('Naming Clarity')).toBeDefined();
    expect(screen.getByText('Architectural Clarity')).toBeDefined();
    expect(screen.getByText('Tooling Support')).toBeDefined();
    expect(screen.getByText('GitHub Readiness')).toBeDefined();
  });

  it('should show loading state', () => {
    render(<ScoreBreakdown breakdown={breakdown} isLoading={true} />);

    expect(screen.getByText('Loading...')).toBeDefined();
  });

  it('should call onDimensionClick', () => {
    const onClick = vi.fn();
    render(<ScoreBreakdown breakdown={breakdown} onDimensionClick={onClick} />);

    const structuralRow = screen.getByText('Structural Quality').closest('div');
    if (structuralRow) {
      fireEvent.click(structuralRow);
      expect(onClick).toHaveBeenCalledWith('structuralQuality');
    }
  });

  it('should highlight dimensions below threshold', () => {
    const { container } = render(<ScoreBreakdown breakdown={breakdown} highlightBelowThreshold={75} />);

    // Documentation (65) and complexity (70) and naming (70) and github (70) should be highlighted
    const rows = container.querySelectorAll('[style*="background"]');
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe('RecommendationList', () => {
  const recommendations: ImprovementRecommendation[] = [
    {
      id: 'rec1',
      priority: 'HIGH',
      impact: 'HIGH',
      effort: 'MEDIUM',
      title: 'Reduce Complexity',
      description: 'Reduce function complexity',
      dimension: 'complexityManagement',
      estimatedImpact: 15,
      estimatedHours: 20,
      automationAvailable: true,
      affectedFiles: ['src/test.ts'],
      actionSteps: ['Step 1', 'Step 2'],
    },
    {
      id: 'rec2',
      priority: 'LOW',
      impact: 'MEDIUM',
      effort: 'LOW',
      title: 'Add Documentation',
      description: 'Add docs',
      dimension: 'documentationCoverage',
      estimatedImpact: 5,
      estimatedHours: 2,
      automationAvailable: false,
      affectedFiles: [],
    },
  ];

  it('should render recommendations', () => {
    render(<RecommendationList recommendations={recommendations} />);

    expect(screen.getByText('Reduce Complexity')).toBeDefined();
    expect(screen.getByText('Add Documentation')).toBeDefined();
  });

  it('should show loading state', () => {
    render(<RecommendationList recommendations={[]} isLoading={true} />);

    expect(screen.getByText('Loading recommendations...')).toBeDefined();
  });

  it('should show empty state', () => {
    render(<RecommendationList recommendations={[]} />);

    expect(screen.getByText(/well-optimized/)).toBeDefined();
  });

  it('should filter by priority', () => {
    render(<RecommendationList recommendations={recommendations} filterPriority="HIGH" />);

    expect(screen.getByText('Reduce Complexity')).toBeDefined();
    expect(screen.queryByText('Add Documentation')).toBeNull();
  });

  it('should expand recommendation on click', () => {
    render(<RecommendationList recommendations={recommendations} />);

    const expandButton = screen.getAllByText(/More/)[0];
    if (expandButton) {
      fireEvent.click(expandButton);
      expect(screen.getByText('Step 1')).toBeDefined();
    }
  });

  it('should show automation badge', () => {
    render(<RecommendationList recommendations={recommendations} expandedByDefault={true} />);

    expect(screen.getByText('Auto')).toBeDefined();
  });
});

describe('AssessmentDashboard', () => {
  it('should render complete dashboard', () => {
    const assessment = createMockAssessment();
    render(<AssessmentDashboard assessment={assessment} />);

    expect(screen.getByText('AI-Readiness Score')).toBeDefined();
    // Use getAllByText since 75 appears multiple times (score and dimension scores)
    expect(screen.getAllByText('75').length).toBeGreaterThan(0);
    expect(screen.getByText('Overview')).toBeDefined();
    expect(screen.getByText('Dimension Scores')).toBeDefined();
    expect(screen.getByText('Recommendations')).toBeDefined();
  });

  it('should show loading state', () => {
    render(<AssessmentDashboard assessment={null} isLoading={true} />);

    expect(screen.getByText('Loading assessment...')).toBeDefined();
  });

  it('should show stats', () => {
    const assessment = createMockAssessment();
    render(<AssessmentDashboard assessment={assessment} />);

    expect(screen.getByText('Total Files')).toBeDefined();
    expect(screen.getByText('Total Lines')).toBeDefined();
    expect(screen.getByText('Issues')).toBeDefined();
    expect(screen.getByText('Quick Wins')).toBeDefined();
  });

  it('should show effort estimate', () => {
    const assessment = createMockAssessment();
    render(<AssessmentDashboard assessment={assessment} />);

    expect(screen.getByText(/Path to Score/)).toBeDefined();
    expect(screen.getByText(/22 hours/)).toBeDefined();
  });

  it('should show tooling badges', () => {
    const assessment = createMockAssessment();
    render(<AssessmentDashboard assessment={assessment} showDetails={true} />);

    expect(screen.getByText('ESLint')).toBeDefined();
    expect(screen.getByText('Prettier')).toBeDefined();
    expect(screen.getByText('CLAUDE.md')).toBeDefined();
  });

  it('should call onDimensionClick', () => {
    const assessment = createMockAssessment();
    const onClick = vi.fn();
    render(<AssessmentDashboard assessment={assessment} onDimensionClick={onClick} />);

    const structural = screen.getByText('Structural Quality').closest('div');
    if (structural) {
      fireEvent.click(structural);
      expect(onClick).toHaveBeenCalled();
    }
  });

  it('should show previous score comparison', () => {
    const assessment = createMockAssessment();
    const previous = { ...createMockAssessment(), overallScore: 65 };
    render(<AssessmentDashboard assessment={assessment} previousAssessment={previous} />);

    expect(screen.getByText(/\+10 points/)).toBeDefined();
  });
});
