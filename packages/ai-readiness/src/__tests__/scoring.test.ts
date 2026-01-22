/**
 * @package @forge/ai-readiness
 * @description Tests for scoring algorithms
 */

import { describe, it, expect } from 'vitest';
import {
  calculateStructuralQualityScore,
  calculateComplexityManagementScore,
  calculateDocumentationCoverageScore,
  calculateTestCoverageScore,
  calculateTypeAnnotationsScore,
  calculateNamingClarityScore,
  calculateArchitecturalClarityScore,
  calculateToolingSupportScore,
  calculateGitHubReadinessScore,
  calculateOverallScore,
  calculateGradeFromScore,
  getGradeDescription,
  getScoreLabel,
  calculateFullBreakdown,
} from '../scoring.js';
import { DEFAULT_ASSESSMENT_THRESHOLDS } from '../ai-readiness.types.js';
import type {
  ToolingConfig,
  GitHubReadinessConfig,
} from '../ai-readiness.types.js';
import type {
  StructuralMetrics,
  ComplexityMetrics,
  QualityIndicators,
  RepositoryAnalysis,
  AntiPattern,
} from '@forge/analysis';

// Helper to create mock structural metrics
function createStructuralMetrics(overrides: Partial<StructuralMetrics> = {}): StructuralMetrics {
  return {
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
    ...overrides,
  };
}

// Helper to create mock complexity metrics
function createComplexityMetrics(overrides: Partial<ComplexityMetrics> = {}): ComplexityMetrics {
  return {
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
    ...overrides,
  };
}

// Helper to create mock quality indicators
function createQualityIndicators(overrides: Partial<QualityIndicators> = {}): QualityIndicators {
  return {
    typeAnnotationCoverage: 0.8,
    documentationCoverage: 0.7,
    testCoverage: 80,
    antiPatternCount: 5,
    antiPatternsBySeverity: {
      low: 3,
      medium: 2,
      high: 0,
      critical: 0,
    },
    filesMissingDocumentation: 2,
    functionsMissingDocumentation: 5,
    ...overrides,
  };
}

// Helper to create mock tooling config
function createToolingConfig(overrides: Partial<ToolingConfig> = {}): ToolingConfig {
  return {
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
    ...overrides,
  };
}

// Helper to create mock GitHub config
function createGitHubConfig(overrides: Partial<GitHubReadinessConfig> = {}): GitHubReadinessConfig {
  return {
    hasClaudeMd: true,
    hasCursorRules: false,
    hasGitHubActions: true,
    hasCircleCI: false,
    hasJenkins: false,
    hasPrTemplate: true,
    hasIssueTemplates: true,
    hasContributing: true,
    hasBranchProtection: false,
    hasReadme: true,
    hasCodeowners: false,
    hasADRs: true,
    ...overrides,
  };
}

describe('calculateStructuralQualityScore', () => {
  it('should return 100 for perfect structure', () => {
    const metrics = createStructuralMetrics({
      filesOver500LOC: 0,
      averageFileSize: 150,
      largestFunctionSize: 30,
      averageFunctionSize: 15,
    });
    const result = calculateStructuralQualityScore(metrics);
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  it('should penalize large files', () => {
    const metrics = createStructuralMetrics({
      filesOver500LOC: 15,
      totalFiles: 20,
    });
    const result = calculateStructuralQualityScore(metrics);
    expect(result.score).toBeLessThan(80);
    expect(result.penalties.length).toBeGreaterThan(0);
  });

  it('should penalize high average file size', () => {
    const metrics = createStructuralMetrics({
      averageFileSize: 450,
    });
    const result = calculateStructuralQualityScore(metrics);
    expect(result.score).toBeLessThan(100);
    expect(result.penalties.some((p) => p.reason.includes('file size'))).toBe(true);
  });

  it('should penalize very large functions', () => {
    const metrics = createStructuralMetrics({
      largestFunctionSize: 150,
      averageFileSize: 300, // Avoid modularity bonus
    });
    const result = calculateStructuralQualityScore(metrics);
    // Threshold is 50*2=100, so 150 should trigger penalty of (150-100)/5 = 10
    expect(result.score).toBeLessThanOrEqual(90);
    expect(result.penalties.some((p) => p.reason.includes('function'))).toBe(true);
  });

  it('should give bonus for excellent modularity', () => {
    const metrics = createStructuralMetrics({
      averageFileSize: 100,
      filesOver500LOC: 0,
    });
    const result = calculateStructuralQualityScore(metrics);
    expect(result.bonuses.length).toBeGreaterThan(0);
  });

  it('should handle empty repository', () => {
    const metrics = createStructuralMetrics({
      totalFiles: 0,
    });
    const result = calculateStructuralQualityScore(metrics);
    expect(result.score).toBe(50);
  });
});

describe('calculateComplexityManagementScore', () => {
  it('should return high score for low complexity', () => {
    const metrics = createComplexityMetrics({
      averageCyclomaticComplexity: 2,
      functionsOverComplexity10: 0,
      functionsWithDeepNesting: 0,
      functionsWithManyParameters: 0,
    });
    const result = calculateComplexityManagementScore(metrics);
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  it('should penalize high average complexity', () => {
    const metrics = createComplexityMetrics({
      averageCyclomaticComplexity: 12,
    });
    const result = calculateComplexityManagementScore(metrics);
    expect(result.score).toBeLessThan(70);
    expect(result.penalties.some((p) => p.reason.includes('complexity'))).toBe(true);
  });

  it('should penalize high complexity functions', () => {
    const metrics = createComplexityMetrics({
      functionsOverComplexity10: 5,
      functions: Array(20).fill({
        name: 'test',
        filePath: 'test.ts',
        startLine: 1,
        endLine: 10,
        linesOfCode: 10,
        cyclomaticComplexity: 5,
        cognitiveComplexity: 5,
        nestingDepth: 2,
        parameterCount: 2,
      }),
    });
    const result = calculateComplexityManagementScore(metrics);
    expect(result.score).toBeLessThan(90);
  });

  it('should penalize deep nesting', () => {
    const metrics = createComplexityMetrics({
      functionsWithDeepNesting: 10,
      functions: Array(20).fill({
        name: 'test',
        filePath: 'test.ts',
        startLine: 1,
        endLine: 10,
        linesOfCode: 10,
        cyclomaticComplexity: 5,
        cognitiveComplexity: 5,
        nestingDepth: 2,
        parameterCount: 2,
      }),
    });
    const result = calculateComplexityManagementScore(metrics);
    expect(result.penalties.some((p) => p.reason.includes('nesting'))).toBe(true);
  });

  it('should handle empty functions array', () => {
    const metrics = createComplexityMetrics({
      functions: [],
    });
    const result = calculateComplexityManagementScore(metrics);
    expect(result.score).toBe(75);
  });
});

describe('calculateDocumentationCoverageScore', () => {
  it('should return high score for good documentation', () => {
    const quality = createQualityIndicators({
      documentationCoverage: 0.9,
    });
    const result = calculateDocumentationCoverageScore(quality, true, true);
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it('should penalize low documentation coverage', () => {
    const quality = createQualityIndicators({
      documentationCoverage: 0.2,
    });
    const result = calculateDocumentationCoverageScore(quality);
    expect(result.score).toBeLessThan(50);
    expect(result.penalties.length).toBeGreaterThan(0);
  });

  it('should give bonus for README', () => {
    const quality = createQualityIndicators();
    const result = calculateDocumentationCoverageScore(quality, true);
    expect(result.bonuses.some((b) => b.reason.includes('README'))).toBe(true);
  });

  it('should give bonus for ADRs', () => {
    const quality = createQualityIndicators();
    const result = calculateDocumentationCoverageScore(quality, false, true);
    expect(result.bonuses.some((b) => b.reason.includes('Architecture Decision Records'))).toBe(true);
  });

  it('should penalize missing README', () => {
    const quality = createQualityIndicators();
    const result = calculateDocumentationCoverageScore(quality, false);
    expect(result.penalties.some((p) => p.reason.includes('README'))).toBe(true);
  });
});

describe('calculateTestCoverageScore', () => {
  it('should return high score for good test coverage', () => {
    const quality = createQualityIndicators({
      testCoverage: 85,
    });
    const result = calculateTestCoverageScore(quality, true, true, true);
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it('should penalize low test coverage', () => {
    const quality = createQualityIndicators({
      testCoverage: 30,
    });
    const result = calculateTestCoverageScore(quality);
    expect(result.score).toBeLessThan(50);
    expect(result.penalties.some((p) => p.reason.includes('coverage'))).toBe(true);
  });

  it('should give bonus for unit tests', () => {
    const quality = createQualityIndicators();
    const result = calculateTestCoverageScore(quality, true);
    expect(result.bonuses.some((b) => b.reason.includes('Unit'))).toBe(true);
  });

  it('should give bonus for integration tests', () => {
    const quality = createQualityIndicators();
    const result = calculateTestCoverageScore(quality, false, true);
    expect(result.bonuses.some((b) => b.reason.includes('Integration'))).toBe(true);
  });

  it('should handle undefined test coverage', () => {
    const quality = createQualityIndicators({
      testCoverage: undefined,
    });
    const result = calculateTestCoverageScore(quality);
    expect(result.score).toBeLessThan(50);
  });
});

describe('calculateTypeAnnotationsScore', () => {
  it('should return high score for good type coverage', () => {
    const quality = createQualityIndicators({
      typeAnnotationCoverage: 0.95,
    });
    const result = calculateTypeAnnotationsScore(quality, true, true);
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  it('should penalize low type coverage', () => {
    const quality = createQualityIndicators({
      typeAnnotationCoverage: 0.2,
    });
    const result = calculateTypeAnnotationsScore(quality);
    expect(result.score).toBeLessThan(50);
    expect(result.penalties.length).toBeGreaterThan(0);
  });

  it('should give neutral score for languages without types', () => {
    const quality = createQualityIndicators();
    const result = calculateTypeAnnotationsScore(quality, false);
    expect(result.score).toBe(75);
  });

  it('should give bonus for strict type config', () => {
    const quality = createQualityIndicators();
    const result = calculateTypeAnnotationsScore(quality, true, true);
    expect(result.bonuses.some((b) => b.reason.includes('Strict'))).toBe(true);
  });
});

describe('calculateNamingClarityScore', () => {
  it('should return baseline score with no issues', () => {
    const analysis = {
      quality: createQualityIndicators({ documentationCoverage: 0.8 }),
      structural: createStructuralMetrics({ averageFileSize: 200 }),
      antiPatterns: [],
    } as unknown as RepositoryAnalysis;
    const result = calculateNamingClarityScore(analysis, []);
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it('should penalize naming anti-patterns', () => {
    const analysis = {
      quality: createQualityIndicators(),
      structural: createStructuralMetrics(),
      antiPatterns: [],
    } as unknown as RepositoryAnalysis;
    const namingPatterns: AntiPattern[] = Array(25).fill({
      id: 'poor-name',
      name: 'Poor Name',
      description: 'Poor naming',
      category: 'naming',
      severity: 'low',
      filePath: 'test.ts',
      line: 1,
    });
    const result = calculateNamingClarityScore(analysis, namingPatterns);
    expect(result.score).toBeLessThan(70);
  });

  it('should give bonus for high documentation', () => {
    const analysis = {
      quality: createQualityIndicators({ documentationCoverage: 0.8 }),
      structural: createStructuralMetrics(),
      antiPatterns: [],
    } as unknown as RepositoryAnalysis;
    const result = calculateNamingClarityScore(analysis, []);
    expect(result.bonuses.some((b) => b.reason.includes('documentation'))).toBe(true);
  });
});

describe('calculateArchitecturalClarityScore', () => {
  it('should return baseline score with no issues', () => {
    const analysis = {
      structural: createStructuralMetrics(),
      languageBreakdown: [{ language: 'typescript', percentage: 90, fileCount: 18, linesOfCode: 900 }],
      antiPatterns: [],
    } as unknown as RepositoryAnalysis;
    const result = calculateArchitecturalClarityScore(analysis, []);
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it('should penalize structural anti-patterns', () => {
    const analysis = {
      structural: createStructuralMetrics(),
      languageBreakdown: [],
      antiPatterns: [],
    } as unknown as RepositoryAnalysis;
    const structuralPatterns: AntiPattern[] = Array(25).fill({
      id: 'circular-dep',
      name: 'Circular Dependency',
      description: 'Circular dependency',
      category: 'structure',
      severity: 'high',
      filePath: 'test.ts',
      line: 1,
    });
    const result = calculateArchitecturalClarityScore(analysis, structuralPatterns);
    expect(result.score).toBeLessThan(70);
  });

  it('should give bonus for consistent technology stack', () => {
    const analysis = {
      structural: createStructuralMetrics(),
      languageBreakdown: [{ language: 'typescript', percentage: 95, fileCount: 19, linesOfCode: 950 }],
      antiPatterns: [],
    } as unknown as RepositoryAnalysis;
    const result = calculateArchitecturalClarityScore(analysis, []);
    expect(result.bonuses.some((b) => b.reason.includes('stack'))).toBe(true);
  });
});

describe('calculateToolingSupportScore', () => {
  it('should return 100 for full tooling', () => {
    const tooling = createToolingConfig();
    const result = calculateToolingSupportScore(tooling);
    expect(result.score).toBe(100);
  });

  it('should penalize missing linter', () => {
    const tooling = createToolingConfig({
      hasEslint: false,
      hasPylint: false,
      hasRubocop: false,
    });
    const result = calculateToolingSupportScore(tooling);
    expect(result.penalties.some((p) => p.reason.includes('linter'))).toBe(true);
  });

  it('should penalize missing formatter', () => {
    const tooling = createToolingConfig({
      hasPrettier: false,
      hasBlack: false,
      hasGofmt: false,
    });
    const result = calculateToolingSupportScore(tooling);
    expect(result.penalties.some((p) => p.reason.includes('formatter'))).toBe(true);
  });

  it('should return 0 for no tooling', () => {
    const tooling: ToolingConfig = {
      hasEslint: false,
      hasPrettier: false,
      hasPylint: false,
      hasBlack: false,
      hasRubocop: false,
      hasGofmt: false,
      hasPackageManager: false,
      hasBuildTool: false,
      hasPreCommitHooks: false,
      hasHusky: false,
    };
    const result = calculateToolingSupportScore(tooling);
    expect(result.score).toBe(0);
  });
});

describe('calculateGitHubReadinessScore', () => {
  it('should return high score for full GitHub readiness', () => {
    const github = createGitHubConfig();
    const result = calculateGitHubReadinessScore(github);
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it('should penalize missing CLAUDE.md', () => {
    const github = createGitHubConfig({
      hasClaudeMd: false,
      hasCursorRules: false,
    });
    const result = calculateGitHubReadinessScore(github);
    expect(result.penalties.some((p) => p.reason.includes('AI assistant'))).toBe(true);
  });

  it('should penalize missing CI/CD', () => {
    const github = createGitHubConfig({
      hasGitHubActions: false,
      hasCircleCI: false,
      hasJenkins: false,
    });
    const result = calculateGitHubReadinessScore(github);
    expect(result.penalties.some((p) => p.reason.includes('CI/CD'))).toBe(true);
  });

  it('should give bonus for PR template', () => {
    const github = createGitHubConfig();
    const result = calculateGitHubReadinessScore(github);
    expect(result.bonuses.some((b) => b.reason.includes('PR template'))).toBe(true);
  });
});

describe('calculateOverallScore', () => {
  it('should calculate weighted average', () => {
    const breakdown = {
      structuralQuality: 80,
      complexityManagement: 70,
      documentationCoverage: 60,
      testCoverage: 90,
      typeAnnotations: 85,
      namingClarity: 75,
      architecturalClarity: 70,
      toolingSupport: 100,
      githubReadiness: 80,
    };
    const score = calculateOverallScore(breakdown);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should return 0 for all zeros', () => {
    const breakdown = {
      structuralQuality: 0,
      complexityManagement: 0,
      documentationCoverage: 0,
      testCoverage: 0,
      typeAnnotations: 0,
      namingClarity: 0,
      architecturalClarity: 0,
      toolingSupport: 0,
      githubReadiness: 0,
    };
    const score = calculateOverallScore(breakdown);
    expect(score).toBe(0);
  });

  it('should return 100 for all hundreds', () => {
    const breakdown = {
      structuralQuality: 100,
      complexityManagement: 100,
      documentationCoverage: 100,
      testCoverage: 100,
      typeAnnotations: 100,
      namingClarity: 100,
      architecturalClarity: 100,
      toolingSupport: 100,
      githubReadiness: 100,
    };
    const score = calculateOverallScore(breakdown);
    expect(score).toBe(100);
  });
});

describe('calculateGradeFromScore', () => {
  it('should return A for 90+', () => {
    expect(calculateGradeFromScore(90)).toBe('A');
    expect(calculateGradeFromScore(100)).toBe('A');
  });

  it('should return B for 80-89', () => {
    expect(calculateGradeFromScore(80)).toBe('B');
    expect(calculateGradeFromScore(89)).toBe('B');
  });

  it('should return C for 70-79', () => {
    expect(calculateGradeFromScore(70)).toBe('C');
    expect(calculateGradeFromScore(79)).toBe('C');
  });

  it('should return D for 60-69', () => {
    expect(calculateGradeFromScore(60)).toBe('D');
    expect(calculateGradeFromScore(69)).toBe('D');
  });

  it('should return F for below 60', () => {
    expect(calculateGradeFromScore(59)).toBe('F');
    expect(calculateGradeFromScore(0)).toBe('F');
  });
});

describe('getGradeDescription', () => {
  it('should return descriptions for all grades', () => {
    expect(getGradeDescription('A')).toContain('Excellent');
    expect(getGradeDescription('B')).toContain('Good');
    expect(getGradeDescription('C')).toContain('Fair');
    expect(getGradeDescription('D')).toContain('Poor');
    expect(getGradeDescription('F')).toContain('Not AI-ready');
  });
});

describe('getScoreLabel', () => {
  it('should return labels for score ranges', () => {
    expect(getScoreLabel(95)).toBe('Excellent');
    expect(getScoreLabel(85)).toBe('Good');
    expect(getScoreLabel(75)).toBe('Fair');
    expect(getScoreLabel(65)).toBe('Poor');
    expect(getScoreLabel(50)).toBe('Critical');
  });
});

describe('calculateFullBreakdown', () => {
  it('should calculate all dimension scores', () => {
    const analysis = {
      repositoryPath: '/test',
      totalFiles: 20,
      languageBreakdown: [{ language: 'typescript', percentage: 100, fileCount: 20, linesOfCode: 1000 }],
      structural: createStructuralMetrics(),
      complexity: createComplexityMetrics(),
      quality: createQualityIndicators(),
      aiReadiness: {} as any,
      antiPatterns: [],
      analyzedAt: new Date(),
      analysisDuration: 100,
    } as RepositoryAnalysis;

    const tooling = createToolingConfig();
    const github = createGitHubConfig();

    const { breakdown, dimensionResults } = calculateFullBreakdown(analysis, tooling, github);

    expect(breakdown.structuralQuality).toBeDefined();
    expect(breakdown.complexityManagement).toBeDefined();
    expect(breakdown.documentationCoverage).toBeDefined();
    expect(breakdown.testCoverage).toBeDefined();
    expect(breakdown.typeAnnotations).toBeDefined();
    expect(breakdown.namingClarity).toBeDefined();
    expect(breakdown.architecturalClarity).toBeDefined();
    expect(breakdown.toolingSupport).toBeDefined();
    expect(breakdown.githubReadiness).toBeDefined();

    expect(dimensionResults.size).toBe(9);
  });
});
