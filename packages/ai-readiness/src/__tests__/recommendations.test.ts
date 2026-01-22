/**
 * @package @forge/ai-readiness
 * @description Tests for recommendation engine
 */

import { describe, it, expect } from 'vitest';
import {
  generateRecommendations,
  calculateEffortEstimate,
  getHighPriorityRecommendations,
  getRecommendationsForDimension,
  getQuickWins,
  getTotalEstimatedHours,
  getAutomatableRecommendations,
  calculatePotentialImprovement,
} from '../recommendations.js';
import { createToolingConfig, createGitHubReadinessConfig } from '../detection.js';
import type {
  FullScoreBreakdown,
  ImprovementRecommendation,
} from '../ai-readiness.types.js';
import type { RepositoryAnalysis, StructuralMetrics, ComplexityMetrics, QualityIndicators } from '@forge/analysis';

// Helper to create mock repository analysis
function createMockAnalysis(overrides: Partial<RepositoryAnalysis> = {}): RepositoryAnalysis {
  const structural: StructuralMetrics = {
    totalLines: 1000,
    codeLines: 800,
    commentLines: 100,
    blankLines: 100,
    functionCount: 50,
    classCount: 10,
    interfaceCount: 5,
    importCount: 100,
    exportCount: 50,
    averageFunctionSize: 20,
    largestFunctionSize: 40,
    filesOver500LOC: 0,
    totalFiles: 20,
    averageFileSize: 50,
    ...(overrides.structural || {}),
  };

  const complexity: ComplexityMetrics = {
    averageCyclomaticComplexity: 3,
    maxCyclomaticComplexity: 8,
    functionsOverComplexity10: 0,
    averageCognitiveComplexity: 5,
    averageNestingDepth: 2,
    maxNestingDepth: 3,
    functionsWithDeepNesting: 0,
    averageParameterCount: 2,
    functionsWithManyParameters: 0,
    functions: [
      {
        name: 'testFunction',
        filePath: 'test.ts',
        startLine: 1,
        endLine: 10,
        linesOfCode: 10,
        cyclomaticComplexity: 3,
        cognitiveComplexity: 5,
        nestingDepth: 2,
        parameterCount: 2,
      },
    ],
    ...(overrides.complexity || {}),
  };

  const quality: QualityIndicators = {
    typeAnnotationCoverage: 0.8,
    documentationCoverage: 0.7,
    testCoverage: 80,
    antiPatternCount: 5,
    antiPatternsBySeverity: { low: 3, medium: 2, high: 0, critical: 0 },
    filesMissingDocumentation: 2,
    functionsMissingDocumentation: 5,
    ...(overrides.quality || {}),
  };

  return {
    repositoryPath: '/test',
    totalFiles: 20,
    languageBreakdown: [{ language: 'typescript', percentage: 100, fileCount: 20, linesOfCode: 1000 }],
    structural,
    complexity,
    quality,
    aiReadiness: {} as any,
    antiPatterns: overrides.antiPatterns || [],
    analyzedAt: new Date(),
    analysisDuration: 100,
    ...overrides,
  } as RepositoryAnalysis;
}

// Helper to create mock breakdown
function createMockBreakdown(overrides: Partial<FullScoreBreakdown> = {}): FullScoreBreakdown {
  return {
    structuralQuality: 80,
    complexityManagement: 75,
    documentationCoverage: 70,
    testCoverage: 85,
    typeAnnotations: 80,
    namingClarity: 75,
    architecturalClarity: 75,
    toolingSupport: 90,
    githubReadiness: 80,
    ...overrides,
  };
}

describe('generateRecommendations', () => {
  it('should generate recommendations for low structural quality', () => {
    const analysis = createMockAnalysis({
      structural: {
        totalLines: 10000,
        codeLines: 8000,
        commentLines: 1000,
        blankLines: 1000,
        functionCount: 100,
        classCount: 20,
        interfaceCount: 10,
        importCount: 200,
        exportCount: 100,
        averageFunctionSize: 30,
        largestFunctionSize: 150,
        filesOver500LOC: 10,
        totalFiles: 20,
        averageFileSize: 500,
      },
    });
    const breakdown = createMockBreakdown({ structuralQuality: 50 });
    const tooling = createToolingConfig();
    const github = createGitHubReadinessConfig();

    const recommendations = generateRecommendations(analysis, breakdown, tooling, github);

    expect(recommendations.some((r) => r.dimension === 'structuralQuality')).toBe(true);
    expect(recommendations.some((r) => r.title.includes('Split'))).toBe(true);
  });

  it('should generate recommendations for high complexity', () => {
    const analysis = createMockAnalysis({
      complexity: {
        averageCyclomaticComplexity: 12,
        maxCyclomaticComplexity: 25,
        functionsOverComplexity10: 20,
        averageCognitiveComplexity: 15,
        averageNestingDepth: 5,
        maxNestingDepth: 7,
        functionsWithDeepNesting: 15,
        averageParameterCount: 6,
        functionsWithManyParameters: 10,
        functions: Array(50).fill({
          name: 'complex',
          filePath: 'test.ts',
          startLine: 1,
          endLine: 100,
          linesOfCode: 100,
          cyclomaticComplexity: 15,
          cognitiveComplexity: 20,
          nestingDepth: 5,
          parameterCount: 6,
        }),
      },
    });
    const breakdown = createMockBreakdown({ complexityManagement: 40 });
    const tooling = createToolingConfig();
    const github = createGitHubReadinessConfig();

    const recommendations = generateRecommendations(analysis, breakdown, tooling, github);

    expect(recommendations.some((r) => r.dimension === 'complexityManagement')).toBe(true);
    expect(recommendations.some((r) => r.title.includes('Complexity'))).toBe(true);
  });

  it('should generate recommendations for low documentation', () => {
    const analysis = createMockAnalysis({
      quality: {
        typeAnnotationCoverage: 0.8,
        documentationCoverage: 0.2,
        testCoverage: 80,
        antiPatternCount: 5,
        antiPatternsBySeverity: { low: 3, medium: 2, high: 0, critical: 0 },
        filesMissingDocumentation: 15,
        functionsMissingDocumentation: 40,
      },
    });
    const breakdown = createMockBreakdown({ documentationCoverage: 30 });
    const tooling = createToolingConfig();
    const github = createGitHubReadinessConfig();

    const recommendations = generateRecommendations(analysis, breakdown, tooling, github);

    expect(recommendations.some((r) => r.dimension === 'documentationCoverage')).toBe(true);
    expect(recommendations.some((r) => r.title.includes('Documentation'))).toBe(true);
  });

  it('should generate recommendations for low test coverage', () => {
    const analysis = createMockAnalysis({
      quality: {
        typeAnnotationCoverage: 0.8,
        documentationCoverage: 0.7,
        testCoverage: 30,
        antiPatternCount: 5,
        antiPatternsBySeverity: { low: 3, medium: 2, high: 0, critical: 0 },
        filesMissingDocumentation: 2,
        functionsMissingDocumentation: 5,
      },
    });
    const breakdown = createMockBreakdown({ testCoverage: 30 });
    const tooling = createToolingConfig();
    const github = createGitHubReadinessConfig();

    const recommendations = generateRecommendations(analysis, breakdown, tooling, github);

    expect(recommendations.some((r) => r.dimension === 'testCoverage')).toBe(true);
    expect(recommendations.some((r) => r.title.includes('Test'))).toBe(true);
  });

  it('should generate recommendations for low type coverage', () => {
    const analysis = createMockAnalysis();
    const breakdown = createMockBreakdown({ typeAnnotations: 40 });
    const tooling = createToolingConfig();
    const github = createGitHubReadinessConfig();

    const recommendations = generateRecommendations(analysis, breakdown, tooling, github);

    expect(recommendations.some((r) => r.dimension === 'typeAnnotations')).toBe(true);
    expect(recommendations.some((r) => r.title.includes('Type'))).toBe(true);
  });

  it('should generate recommendations for missing tooling', () => {
    const analysis = createMockAnalysis();
    const breakdown = createMockBreakdown({ toolingSupport: 30 });
    const tooling = createToolingConfig({
      hasEslint: false,
      hasPrettier: false,
      hasPreCommitHooks: false,
    });
    const github = createGitHubReadinessConfig();

    const recommendations = generateRecommendations(analysis, breakdown, tooling, github);

    expect(recommendations.some((r) => r.dimension === 'toolingSupport')).toBe(true);
    expect(recommendations.some((r) => r.title.includes('Linter'))).toBe(true);
    expect(recommendations.some((r) => r.title.includes('Formatter'))).toBe(true);
  });

  it('should generate recommendations for missing GitHub readiness', () => {
    const analysis = createMockAnalysis();
    const breakdown = createMockBreakdown({ githubReadiness: 20 });
    const tooling = createToolingConfig();
    const github = createGitHubReadinessConfig({
      hasClaudeMd: false,
      hasCursorRules: false,
      hasGitHubActions: false,
    });

    const recommendations = generateRecommendations(analysis, breakdown, tooling, github);

    expect(recommendations.some((r) => r.dimension === 'githubReadiness')).toBe(true);
    expect(recommendations.some((r) => r.title.includes('CLAUDE'))).toBe(true);
    expect(recommendations.some((r) => r.title.includes('CI/CD'))).toBe(true);
  });

  it('should generate recommendations for TODO comments', () => {
    const analysis = createMockAnalysis({
      antiPatterns: Array(15).fill({
        id: 'todo-comment',
        name: 'TODO Comment',
        description: 'TODO found',
        category: 'documentation',
        severity: 'low',
        filePath: 'test.ts',
        line: 1,
      }),
    });
    const breakdown = createMockBreakdown();
    const tooling = createToolingConfig();
    const github = createGitHubReadinessConfig();

    const recommendations = generateRecommendations(analysis, breakdown, tooling, github);

    expect(recommendations.some((r) => r.title.includes('TODO'))).toBe(true);
  });

  it('should generate recommendations for console.log statements', () => {
    const analysis = createMockAnalysis({
      antiPatterns: Array(10).fill({
        id: 'console-log',
        name: 'Console Log',
        description: 'console.log found',
        category: 'maintainability',
        severity: 'low',
        filePath: 'test.ts',
        line: 1,
      }),
    });
    const breakdown = createMockBreakdown();
    const tooling = createToolingConfig();
    const github = createGitHubReadinessConfig();

    const recommendations = generateRecommendations(analysis, breakdown, tooling, github);

    expect(recommendations.some((r) => r.title.includes('Debug'))).toBe(true);
  });

  it('should return empty array for excellent codebase', () => {
    const analysis = createMockAnalysis();
    const breakdown = createMockBreakdown({
      structuralQuality: 95,
      complexityManagement: 95,
      documentationCoverage: 95,
      testCoverage: 95,
      typeAnnotations: 95,
      namingClarity: 95,
      architecturalClarity: 95,
      toolingSupport: 100,
      githubReadiness: 95,
    });
    const tooling = createToolingConfig({
      hasEslint: true,
      hasPrettier: true,
      hasPreCommitHooks: true,
    });
    const github = createGitHubReadinessConfig({
      hasClaudeMd: true,
      hasGitHubActions: true,
      hasReadme: true,
      hasContributing: true,
      hasPrTemplate: true,
    });

    const recommendations = generateRecommendations(analysis, breakdown, tooling, github);

    expect(recommendations.length).toBe(0);
  });

  it('should sort recommendations by priority', () => {
    const analysis = createMockAnalysis({
      structural: {
        totalLines: 10000,
        codeLines: 8000,
        commentLines: 1000,
        blankLines: 1000,
        functionCount: 100,
        classCount: 20,
        interfaceCount: 10,
        importCount: 200,
        exportCount: 100,
        averageFunctionSize: 30,
        largestFunctionSize: 150,
        filesOver500LOC: 10,
        totalFiles: 20,
        averageFileSize: 500,
      },
      complexity: {
        averageCyclomaticComplexity: 12,
        maxCyclomaticComplexity: 25,
        functionsOverComplexity10: 20,
        averageCognitiveComplexity: 15,
        averageNestingDepth: 5,
        maxNestingDepth: 7,
        functionsWithDeepNesting: 15,
        averageParameterCount: 6,
        functionsWithManyParameters: 10,
        functions: [],
      },
    });
    const breakdown = createMockBreakdown({
      structuralQuality: 40,
      complexityManagement: 30,
      toolingSupport: 20,
    });
    const tooling = createToolingConfig({ hasEslint: false, hasPrettier: false });
    const github = createGitHubReadinessConfig();

    const recommendations = generateRecommendations(analysis, breakdown, tooling, github);

    // High priority should come first
    const firstHighIndex = recommendations.findIndex((r) => r.priority === 'HIGH');
    const lastLowIndex = recommendations.map((r, i) => ({ r, i })).filter(({ r }) => r.priority === 'LOW').pop()?.i ?? -1;

    if (firstHighIndex >= 0 && lastLowIndex >= 0) {
      expect(firstHighIndex).toBeLessThan(lastLowIndex);
    }
  });
});

describe('calculateEffortEstimate', () => {
  it('should calculate total hours', () => {
    const recommendations: ImprovementRecommendation[] = [
      {
        id: 'rec1',
        priority: 'HIGH',
        impact: 'HIGH',
        effort: 'HIGH',
        title: 'Test',
        description: 'Test',
        dimension: 'structuralQuality',
        estimatedImpact: 10,
        estimatedHours: 20,
        automationAvailable: false,
        affectedFiles: [],
      },
      {
        id: 'rec2',
        priority: 'MEDIUM',
        impact: 'MEDIUM',
        effort: 'MEDIUM',
        title: 'Test 2',
        description: 'Test 2',
        dimension: 'complexityManagement',
        estimatedImpact: 5,
        estimatedHours: 10,
        automationAvailable: true,
        affectedFiles: [],
      },
    ];
    const breakdown = createMockBreakdown();

    const estimate = calculateEffortEstimate(70, breakdown, recommendations, 80);

    expect(estimate.totalHours).toBe(30);
    expect(estimate.byPriority.high).toBe(20);
    expect(estimate.byPriority.medium).toBe(10);
  });

  it('should calculate hours by dimension', () => {
    const recommendations: ImprovementRecommendation[] = [
      {
        id: 'rec1',
        priority: 'HIGH',
        impact: 'HIGH',
        effort: 'HIGH',
        title: 'Test',
        description: 'Test',
        dimension: 'structuralQuality',
        estimatedImpact: 10,
        estimatedHours: 20,
        automationAvailable: false,
        affectedFiles: [],
      },
      {
        id: 'rec2',
        priority: 'HIGH',
        impact: 'HIGH',
        effort: 'HIGH',
        title: 'Test 2',
        description: 'Test 2',
        dimension: 'structuralQuality',
        estimatedImpact: 5,
        estimatedHours: 10,
        automationAvailable: false,
        affectedFiles: [],
      },
    ];
    const breakdown = createMockBreakdown();

    const estimate = calculateEffortEstimate(70, breakdown, recommendations, 80);

    expect(estimate.byDimension.structuralQuality).toBe(30);
    expect(estimate.byDimension.complexityManagement).toBe(0);
  });

  it('should calculate target score', () => {
    const recommendations: ImprovementRecommendation[] = [
      {
        id: 'rec1',
        priority: 'HIGH',
        impact: 'HIGH',
        effort: 'HIGH',
        title: 'Test',
        description: 'Test',
        dimension: 'structuralQuality',
        estimatedImpact: 20,
        estimatedHours: 20,
        automationAvailable: false,
        affectedFiles: [],
      },
    ];
    const breakdown = createMockBreakdown();

    const estimate = calculateEffortEstimate(70, breakdown, recommendations, 80);

    expect(estimate.targetScore).toBeGreaterThan(70);
    expect(estimate.targetScore).toBeLessThanOrEqual(100);
  });

  it('should handle empty recommendations', () => {
    const breakdown = createMockBreakdown();
    const estimate = calculateEffortEstimate(70, breakdown, [], 80);

    expect(estimate.totalHours).toBe(0);
    expect(estimate.targetScore).toBe(70);
  });
});

describe('getHighPriorityRecommendations', () => {
  it('should filter high priority recommendations', () => {
    const recommendations: ImprovementRecommendation[] = [
      { id: '1', priority: 'HIGH', impact: 'HIGH', effort: 'HIGH', title: 'High', description: '', dimension: 'structuralQuality', estimatedImpact: 10, estimatedHours: 10, automationAvailable: false, affectedFiles: [] },
      { id: '2', priority: 'MEDIUM', impact: 'MEDIUM', effort: 'MEDIUM', title: 'Medium', description: '', dimension: 'structuralQuality', estimatedImpact: 5, estimatedHours: 5, automationAvailable: false, affectedFiles: [] },
      { id: '3', priority: 'LOW', impact: 'LOW', effort: 'LOW', title: 'Low', description: '', dimension: 'structuralQuality', estimatedImpact: 2, estimatedHours: 2, automationAvailable: false, affectedFiles: [] },
    ];

    const highPriority = getHighPriorityRecommendations(recommendations);

    expect(highPriority.length).toBe(1);
    expect(highPriority[0]?.priority).toBe('HIGH');
  });

  it('should return empty array if no high priority', () => {
    const recommendations: ImprovementRecommendation[] = [
      { id: '1', priority: 'MEDIUM', impact: 'MEDIUM', effort: 'MEDIUM', title: 'Medium', description: '', dimension: 'structuralQuality', estimatedImpact: 5, estimatedHours: 5, automationAvailable: false, affectedFiles: [] },
    ];

    const highPriority = getHighPriorityRecommendations(recommendations);

    expect(highPriority.length).toBe(0);
  });
});

describe('getRecommendationsForDimension', () => {
  it('should filter by dimension', () => {
    const recommendations: ImprovementRecommendation[] = [
      { id: '1', priority: 'HIGH', impact: 'HIGH', effort: 'HIGH', title: 'Structural', description: '', dimension: 'structuralQuality', estimatedImpact: 10, estimatedHours: 10, automationAvailable: false, affectedFiles: [] },
      { id: '2', priority: 'HIGH', impact: 'HIGH', effort: 'HIGH', title: 'Complexity', description: '', dimension: 'complexityManagement', estimatedImpact: 5, estimatedHours: 5, automationAvailable: false, affectedFiles: [] },
    ];

    const structural = getRecommendationsForDimension(recommendations, 'structuralQuality');

    expect(structural.length).toBe(1);
    expect(structural[0]?.dimension).toBe('structuralQuality');
  });
});

describe('getQuickWins', () => {
  it('should return low effort, high/medium impact recommendations', () => {
    const recommendations: ImprovementRecommendation[] = [
      { id: '1', priority: 'HIGH', impact: 'HIGH', effort: 'LOW', title: 'Quick Win', description: '', dimension: 'structuralQuality', estimatedImpact: 10, estimatedHours: 2, automationAvailable: false, affectedFiles: [] },
      { id: '2', priority: 'HIGH', impact: 'HIGH', effort: 'HIGH', title: 'Hard', description: '', dimension: 'structuralQuality', estimatedImpact: 20, estimatedHours: 40, automationAvailable: false, affectedFiles: [] },
      { id: '3', priority: 'LOW', impact: 'MEDIUM', effort: 'LOW', title: 'Easy Medium', description: '', dimension: 'structuralQuality', estimatedImpact: 5, estimatedHours: 1, automationAvailable: false, affectedFiles: [] },
    ];

    const quickWins = getQuickWins(recommendations);

    expect(quickWins.length).toBe(2);
    expect(quickWins.every((r) => r.effort === 'LOW')).toBe(true);
  });
});

describe('getTotalEstimatedHours', () => {
  it('should sum estimated hours', () => {
    const recommendations: ImprovementRecommendation[] = [
      { id: '1', priority: 'HIGH', impact: 'HIGH', effort: 'HIGH', title: 'Test', description: '', dimension: 'structuralQuality', estimatedImpact: 10, estimatedHours: 10, automationAvailable: false, affectedFiles: [] },
      { id: '2', priority: 'HIGH', impact: 'HIGH', effort: 'HIGH', title: 'Test', description: '', dimension: 'structuralQuality', estimatedImpact: 10, estimatedHours: 20, automationAvailable: false, affectedFiles: [] },
      { id: '3', priority: 'HIGH', impact: 'HIGH', effort: 'HIGH', title: 'Test', description: '', dimension: 'structuralQuality', estimatedImpact: 10, estimatedHours: 5, automationAvailable: false, affectedFiles: [] },
    ];

    expect(getTotalEstimatedHours(recommendations)).toBe(35);
  });

  it('should return 0 for empty array', () => {
    expect(getTotalEstimatedHours([])).toBe(0);
  });
});

describe('getAutomatableRecommendations', () => {
  it('should filter automatable recommendations', () => {
    const recommendations: ImprovementRecommendation[] = [
      { id: '1', priority: 'HIGH', impact: 'HIGH', effort: 'HIGH', title: 'Auto', description: '', dimension: 'structuralQuality', estimatedImpact: 10, estimatedHours: 10, automationAvailable: true, affectedFiles: [] },
      { id: '2', priority: 'HIGH', impact: 'HIGH', effort: 'HIGH', title: 'Manual', description: '', dimension: 'structuralQuality', estimatedImpact: 10, estimatedHours: 10, automationAvailable: false, affectedFiles: [] },
    ];

    const automatable = getAutomatableRecommendations(recommendations);

    expect(automatable.length).toBe(1);
    expect(automatable[0]?.automationAvailable).toBe(true);
  });
});

describe('calculatePotentialImprovement', () => {
  it('should calculate weighted improvement', () => {
    const recommendations: ImprovementRecommendation[] = [
      { id: '1', priority: 'HIGH', impact: 'HIGH', effort: 'HIGH', title: 'Test', description: '', dimension: 'structuralQuality', estimatedImpact: 20, estimatedHours: 10, automationAvailable: false, affectedFiles: [] },
    ];

    const improvement = calculatePotentialImprovement(recommendations);

    expect(improvement).toBeGreaterThan(0);
    expect(improvement).toBeLessThanOrEqual(40);
  });

  it('should cap at 40 points', () => {
    const recommendations: ImprovementRecommendation[] = Array(10).fill({
      id: '1',
      priority: 'HIGH',
      impact: 'HIGH',
      effort: 'HIGH',
      title: 'Test',
      description: '',
      dimension: 'structuralQuality',
      estimatedImpact: 30,
      estimatedHours: 10,
      automationAvailable: false,
      affectedFiles: [],
    });

    const improvement = calculatePotentialImprovement(recommendations);

    expect(improvement).toBe(40);
  });
});
