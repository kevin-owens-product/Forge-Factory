/**
 * @package @forge/ai-readiness
 * @description Scoring algorithms for all 9 AI-readiness dimensions (ADR-039)
 */

import type {
  RepositoryAnalysis,
  StructuralMetrics,
  ComplexityMetrics,
  QualityIndicators,
  AntiPattern,
} from '@forge/analysis';

import type {
  FullScoreBreakdown,
  AssessmentPenalty,
  AssessmentThresholds,
  ToolingConfig,
  GitHubReadinessConfig,
  AssessmentDimension,
} from './ai-readiness.types.js';

import { DEFAULT_ASSESSMENT_THRESHOLDS, DEFAULT_DIMENSION_WEIGHTS } from './ai-readiness.types.js';

/**
 * Result of a dimension score calculation
 */
export interface DimensionScoreResult {
  score: number;
  penalties: AssessmentPenalty[];
  bonuses: { amount: number; reason: string }[];
}

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calculate structural quality score (20% of total)
 * Measures: File sizes, function sizes, modularity
 */
export function calculateStructuralQualityScore(
  metrics: StructuralMetrics,
  thresholds: AssessmentThresholds = DEFAULT_ASSESSMENT_THRESHOLDS
): DimensionScoreResult {
  let score = 100;
  const penalties: AssessmentPenalty[] = [];
  const bonuses: { amount: number; reason: string }[] = [];

  if (metrics.totalFiles === 0) {
    return { score: 50, penalties: [], bonuses: [] };
  }

  // File Size Analysis
  const largeFilesRatio = metrics.filesOver500LOC / metrics.totalFiles;

  if (largeFilesRatio > 0.5) {
    penalties.push({
      amount: 40,
      reason: 'Majority of files exceed AI context limits (>500 LOC)',
    });
    score -= 40;
  } else if (largeFilesRatio > 0.25) {
    penalties.push({
      amount: 25,
      reason: 'Many files exceed optimal size for AI (>500 LOC)',
    });
    score -= 25;
  } else if (largeFilesRatio > 0.10) {
    penalties.push({
      amount: 10,
      reason: 'Some files could be split for better AI comprehension',
    });
    score -= 10;
  }

  // Average File Size
  if (metrics.averageFileSize > 400) {
    const penalty = Math.min(20, (metrics.averageFileSize - 400) / 10);
    penalties.push({
      amount: penalty,
      reason: `Average file size (${Math.round(metrics.averageFileSize)} LOC) is too large`,
    });
    score -= penalty;
  } else if (metrics.averageFileSize > 300) {
    const penalty = Math.min(10, (metrics.averageFileSize - 300) / 10);
    penalties.push({
      amount: penalty,
      reason: `Average file size (${Math.round(metrics.averageFileSize)} LOC) could be smaller`,
    });
    score -= penalty;
  }

  // Large Function Analysis
  const largeFunctionThreshold = thresholds.largeFunction;
  if (metrics.largestFunctionSize > largeFunctionThreshold * 2) {
    const penalty = Math.min(25, (metrics.largestFunctionSize - largeFunctionThreshold * 2) / 5);
    penalties.push({
      amount: penalty,
      reason: `Largest function (${metrics.largestFunctionSize} LOC) is too long for AI to understand`,
    });
    score -= penalty;
  }

  // Average Function Size
  if (metrics.averageFunctionSize > largeFunctionThreshold) {
    const penalty = Math.min(15, (metrics.averageFunctionSize - largeFunctionThreshold) / 5);
    penalties.push({
      amount: penalty,
      reason: `Average function size (${Math.round(metrics.averageFunctionSize)} LOC) should be reduced`,
    });
    score -= penalty;
  }

  // Modularity (Functions per file)
  if (metrics.totalFiles > 0 && metrics.functionCount > 0) {
    const avgFunctionsPerFile = metrics.functionCount / metrics.totalFiles;
    if (avgFunctionsPerFile > 20) {
      penalties.push({
        amount: 15,
        reason: 'Files have too many functions (low cohesion)',
      });
      score -= 15;
    }
  }

  // Bonus for excellent structure
  if (metrics.averageFileSize < 200 && metrics.averageFileSize > 0) {
    bonuses.push({
      amount: 10,
      reason: 'Excellent modularity - small, focused files',
    });
    score += 10;
  }

  return {
    score: clamp(score, 0, 100),
    penalties,
    bonuses,
  };
}

/**
 * Calculate complexity management score (15% of total)
 * Measures: Cyclomatic complexity, cognitive complexity, nesting depth
 */
export function calculateComplexityManagementScore(
  metrics: ComplexityMetrics,
  thresholds: AssessmentThresholds = DEFAULT_ASSESSMENT_THRESHOLDS
): DimensionScoreResult {
  let score = 100;
  const penalties: AssessmentPenalty[] = [];
  const bonuses: { amount: number; reason: string }[] = [];

  if (metrics.functions.length === 0) {
    return { score: 75, penalties: [], bonuses: [] };
  }

  // Average Cyclomatic Complexity
  const avgComplexity = metrics.averageCyclomaticComplexity;
  if (avgComplexity > 10) {
    penalties.push({
      amount: 40,
      reason: `Average complexity (${avgComplexity.toFixed(1)}) is very high`,
    });
    score -= 40;
  } else if (avgComplexity > 7) {
    penalties.push({
      amount: 25,
      reason: `Average complexity (${avgComplexity.toFixed(1)}) is high`,
    });
    score -= 25;
  } else if (avgComplexity > 5) {
    penalties.push({
      amount: 10,
      reason: `Average complexity (${avgComplexity.toFixed(1)}) could be lower`,
    });
    score -= 10;
  }

  // High Complexity Functions (>10)
  const highComplexityRatio = metrics.functionsOverComplexity10 / metrics.functions.length;
  if (highComplexityRatio > 0.20) {
    penalties.push({
      amount: 30,
      reason: `${Math.round(highComplexityRatio * 100)}% of functions have complexity >10`,
    });
    score -= 30;
  } else if (highComplexityRatio > 0.10) {
    penalties.push({
      amount: 15,
      reason: `${Math.round(highComplexityRatio * 100)}% of functions have complexity >10`,
    });
    score -= 15;
  }

  // Deep Nesting
  const deepNestingRatio = metrics.functionsWithDeepNesting / metrics.functions.length;
  if (deepNestingRatio > 0.15) {
    penalties.push({
      amount: 20,
      reason: `Many functions have deep nesting (>${thresholds.deepNesting} levels)`,
    });
    score -= 20;
  } else if (deepNestingRatio > 0.05) {
    penalties.push({
      amount: 10,
      reason: 'Some functions have deep nesting',
    });
    score -= 10;
  }

  // Long Parameter Lists
  const longParamsRatio = metrics.functionsWithManyParameters / metrics.functions.length;
  if (longParamsRatio > 0.10) {
    penalties.push({
      amount: 15,
      reason: `Many functions have too many parameters (>${thresholds.longParameterList})`,
    });
    score -= 15;
  }

  // Bonus for excellent complexity management
  if (avgComplexity < 3 && highComplexityRatio < 0.02) {
    bonuses.push({
      amount: 10,
      reason: 'Excellent complexity management',
    });
    score += 10;
  }

  return {
    score: clamp(score, 0, 100),
    penalties,
    bonuses,
  };
}

/**
 * Calculate documentation coverage score (15% of total)
 * Measures: JSDoc/docstrings, README, inline comments, ADRs
 */
export function calculateDocumentationCoverageScore(
  quality: QualityIndicators,
  hasReadme: boolean = false,
  hasADRs: boolean = false
): DimensionScoreResult {
  let score = 0;
  const penalties: AssessmentPenalty[] = [];
  const bonuses: { amount: number; reason: string }[] = [];

  // Function Documentation (40 points)
  const docCoverage = quality.documentationCoverage;
  const docPoints = docCoverage * 40;
  score += docPoints;

  if (docCoverage < 0.3) {
    penalties.push({
      amount: 20,
      reason: `Documentation coverage is very low (${Math.round(docCoverage * 100)}%)`,
    });
  } else if (docCoverage < 0.5) {
    penalties.push({
      amount: 10,
      reason: `Documentation coverage is below 50%`,
    });
  }

  // Documentation Quality Assessment (30 points)
  // For now, estimate based on coverage ratio
  const qualityScore = docCoverage > 0.7 ? 30 : docCoverage > 0.5 ? 20 : docCoverage > 0.3 ? 10 : 0;
  score += qualityScore;

  // README Presence and Quality (15 points)
  if (hasReadme) {
    score += 15;
    bonuses.push({
      amount: 15,
      reason: 'README.md present',
    });
  } else {
    penalties.push({
      amount: 15,
      reason: 'Missing README.md',
    });
  }

  // Architecture Documentation (10 points)
  if (hasADRs) {
    score += 10;
    bonuses.push({
      amount: 10,
      reason: 'Architecture Decision Records present',
    });
  }

  // Inline Comments (5 points) - estimated from type coverage
  if (quality.typeAnnotationCoverage > 0.8) {
    score += 5;
    bonuses.push({
      amount: 5,
      reason: 'Good inline documentation',
    });
  }

  return {
    score: clamp(score, 0, 100),
    penalties,
    bonuses,
  };
}

/**
 * Calculate test coverage score (10% of total)
 * Measures: Line coverage, branch coverage, test types
 */
export function calculateTestCoverageScore(
  quality: QualityIndicators,
  hasUnitTests: boolean = false,
  hasIntegrationTests: boolean = false,
  hasE2ETests: boolean = false
): DimensionScoreResult {
  let score = 0;
  const penalties: AssessmentPenalty[] = [];
  const bonuses: { amount: number; reason: string }[] = [];

  const testCoverage = quality.testCoverage;

  if (testCoverage === undefined) {
    // No test coverage data available
    if (hasUnitTests) {
      score = 40;
      bonuses.push({ amount: 40, reason: 'Unit tests detected' });
    } else {
      score = 20;
      penalties.push({ amount: 60, reason: 'No test coverage data available' });
    }
  } else {
    // Line Coverage (60 points)
    if (testCoverage >= 80) {
      score += 60;
      bonuses.push({ amount: 60, reason: `Excellent line coverage (${testCoverage}%)` });
    } else if (testCoverage >= 60) {
      score += 45;
    } else if (testCoverage >= 40) {
      score += 30;
      penalties.push({ amount: 15, reason: `Test coverage below 60% (${testCoverage}%)` });
    } else if (testCoverage >= 20) {
      score += 15;
      penalties.push({ amount: 30, reason: `Test coverage is low (${testCoverage}%)` });
    } else {
      penalties.push({ amount: 45, reason: `Test coverage is very low (${testCoverage}%)` });
    }
  }

  // Test Types Present (20 points)
  if (hasUnitTests) {
    score += 10;
    bonuses.push({ amount: 10, reason: 'Unit tests present' });
  }
  if (hasIntegrationTests) {
    score += 5;
    bonuses.push({ amount: 5, reason: 'Integration tests present' });
  }
  if (hasE2ETests) {
    score += 5;
    bonuses.push({ amount: 5, reason: 'E2E tests present' });
  }

  // Branch Coverage bonus (20 points) - estimated
  if (testCoverage !== undefined && testCoverage >= 70) {
    score += 20;
    bonuses.push({ amount: 20, reason: 'Good branch coverage estimated' });
  }

  return {
    score: clamp(score, 0, 100),
    penalties,
    bonuses,
  };
}

/**
 * Calculate type annotations score (10% of total)
 * Measures: TypeScript coverage, Python type hints, explicit types
 */
export function calculateTypeAnnotationsScore(
  quality: QualityIndicators,
  supportsTypes: boolean = true,
  hasStrictConfig: boolean = false
): DimensionScoreResult {
  let score = 0;
  const penalties: AssessmentPenalty[] = [];
  const bonuses: { amount: number; reason: string }[] = [];

  if (!supportsTypes) {
    // Languages without type systems get neutral score
    return {
      score: 75,
      penalties: [],
      bonuses: [{ amount: 75, reason: 'Language does not require type annotations' }],
    };
  }

  const typeCoverage = quality.typeAnnotationCoverage;

  // Function Return Types and Parameter Types (70 points)
  const typePoints = typeCoverage * 70;
  score += typePoints;

  if (typeCoverage < 0.3) {
    penalties.push({
      amount: 30,
      reason: `Type annotation coverage is very low (${Math.round(typeCoverage * 100)}%)`,
    });
  } else if (typeCoverage < 0.5) {
    penalties.push({
      amount: 15,
      reason: `Type annotation coverage is below 50%`,
    });
  } else if (typeCoverage >= 0.9) {
    bonuses.push({
      amount: 10,
      reason: 'Excellent type coverage (>90%)',
    });
  }

  // Variable Types (20 points) - estimated from overall coverage
  score += typeCoverage * 20;

  // Type Strictness (10 points)
  if (hasStrictConfig) {
    score += 10;
    bonuses.push({
      amount: 10,
      reason: 'Strict type checking enabled',
    });
  }

  return {
    score: clamp(score, 0, 100),
    penalties,
    bonuses,
  };
}

/**
 * Calculate naming clarity score (10% of total) - Qualitative
 * Measures: Descriptive names, consistent conventions, intent clarity
 */
export function calculateNamingClarityScore(
  analysis: RepositoryAnalysis,
  antiPatterns: AntiPattern[]
): DimensionScoreResult {
  let score = 70; // Default baseline
  const penalties: AssessmentPenalty[] = [];
  const bonuses: { amount: number; reason: string }[] = [];

  // Check for naming-related anti-patterns
  const namingPatterns = antiPatterns.filter(p => p.category === 'naming');
  const namingIssues = namingPatterns.length;

  if (namingIssues > 20) {
    penalties.push({
      amount: 30,
      reason: `Many naming issues detected (${namingIssues})`,
    });
    score -= 30;
  } else if (namingIssues > 10) {
    penalties.push({
      amount: 15,
      reason: `Some naming issues detected (${namingIssues})`,
    });
    score -= 15;
  } else if (namingIssues === 0) {
    bonuses.push({
      amount: 15,
      reason: 'No naming issues detected',
    });
    score += 15;
  }

  // Check for single-letter variable names (heuristic)
  const singleLetterPatterns = antiPatterns.filter(
    p => p.id === 'single-letter-name' || p.description?.includes('single letter')
  );
  if (singleLetterPatterns.length > 5) {
    penalties.push({
      amount: 10,
      reason: 'Multiple single-letter variable names',
    });
    score -= 10;
  }

  // Bonus for good documentation (implies good naming)
  if (analysis.quality.documentationCoverage > 0.7) {
    bonuses.push({
      amount: 10,
      reason: 'High documentation suggests clear naming',
    });
    score += 10;
  }

  // Bonus for consistent structure
  if (analysis.structural.averageFileSize < 300) {
    bonuses.push({
      amount: 5,
      reason: 'Consistent file organization suggests good naming',
    });
    score += 5;
  }

  return {
    score: clamp(score, 0, 100),
    penalties,
    bonuses,
  };
}

/**
 * Calculate architectural clarity score (10% of total) - Qualitative
 * Measures: Directory structure, dependency graph, separation of concerns
 */
export function calculateArchitecturalClarityScore(
  analysis: RepositoryAnalysis,
  antiPatterns: AntiPattern[]
): DimensionScoreResult {
  let score = 70; // Default baseline
  const penalties: AssessmentPenalty[] = [];
  const bonuses: { amount: number; reason: string }[] = [];

  // Check for structural anti-patterns
  const structuralPatterns = antiPatterns.filter(p => p.category === 'structure');
  const structuralIssues = structuralPatterns.length;

  if (structuralIssues > 20) {
    penalties.push({
      amount: 25,
      reason: `Many structural issues detected (${structuralIssues})`,
    });
    score -= 25;
  } else if (structuralIssues > 10) {
    penalties.push({
      amount: 15,
      reason: `Some structural issues detected (${structuralIssues})`,
    });
    score -= 15;
  } else if (structuralIssues === 0) {
    bonuses.push({
      amount: 15,
      reason: 'No structural issues detected',
    });
    score += 15;
  }

  // Check for circular dependencies or complex import patterns
  const importCount = analysis.structural.importCount;
  const fileCount = analysis.structural.totalFiles;
  if (fileCount > 0) {
    const avgImportsPerFile = importCount / fileCount;
    if (avgImportsPerFile > 15) {
      penalties.push({
        amount: 15,
        reason: 'High average imports per file suggests complex dependencies',
      });
      score -= 15;
    } else if (avgImportsPerFile < 5) {
      bonuses.push({
        amount: 10,
        reason: 'Low import count suggests clean dependency structure',
      });
      score += 10;
    }
  }

  // Check modularity based on language breakdown
  if (analysis.languageBreakdown.length > 0) {
    const primaryLanguage = analysis.languageBreakdown[0];
    if (primaryLanguage && primaryLanguage.percentage > 80) {
      bonuses.push({
        amount: 5,
        reason: 'Consistent technology stack',
      });
      score += 5;
    }
  }

  // Bonus for many small files (good separation)
  if (analysis.structural.totalFiles > 10 && analysis.structural.averageFileSize < 200) {
    bonuses.push({
      amount: 10,
      reason: 'Good separation of concerns with small, focused files',
    });
    score += 10;
  }

  return {
    score: clamp(score, 0, 100),
    penalties,
    bonuses,
  };
}

/**
 * Calculate tooling support score (5% of total)
 * Measures: Linters, formatters, package managers, build tools
 */
export function calculateToolingSupportScore(tooling: ToolingConfig): DimensionScoreResult {
  let score = 0;
  const penalties: AssessmentPenalty[] = [];
  const bonuses: { amount: number; reason: string }[] = [];

  // Linter Configuration (30 points)
  if (tooling.hasEslint || tooling.hasPylint || tooling.hasRubocop) {
    score += 30;
    bonuses.push({ amount: 30, reason: 'Linter configured' });
  } else {
    penalties.push({ amount: 30, reason: 'No linter configured' });
  }

  // Formatter Configuration (20 points)
  if (tooling.hasPrettier || tooling.hasBlack || tooling.hasGofmt) {
    score += 20;
    bonuses.push({ amount: 20, reason: 'Formatter configured' });
  } else {
    penalties.push({ amount: 20, reason: 'No formatter configured' });
  }

  // Package Manager (20 points)
  if (tooling.hasPackageManager) {
    score += 20;
    bonuses.push({ amount: 20, reason: `Package manager configured (${tooling.packageManager || 'detected'})` });
  } else {
    penalties.push({ amount: 20, reason: 'No package manager detected' });
  }

  // Build Tool (15 points)
  if (tooling.hasBuildTool) {
    score += 15;
    bonuses.push({ amount: 15, reason: `Build tool configured (${tooling.buildTool || 'detected'})` });
  } else {
    penalties.push({ amount: 15, reason: 'No build tool configured' });
  }

  // Pre-commit Hooks (15 points)
  if (tooling.hasPreCommitHooks || tooling.hasHusky) {
    score += 15;
    bonuses.push({ amount: 15, reason: 'Pre-commit hooks configured' });
  } else {
    penalties.push({ amount: 15, reason: 'No pre-commit hooks configured' });
  }

  return {
    score: clamp(score, 0, 100),
    penalties,
    bonuses,
  };
}

/**
 * Calculate GitHub readiness score (5% of total)
 * Measures: CI/CD, PR templates, CLAUDE.md, contributing guides
 */
export function calculateGitHubReadinessScore(
  githubConfig: GitHubReadinessConfig
): DimensionScoreResult {
  let score = 0;
  const penalties: AssessmentPenalty[] = [];
  const bonuses: { amount: number; reason: string }[] = [];

  // CLAUDE.md or .cursorrules (30 points)
  if (githubConfig.hasClaudeMd || githubConfig.hasCursorRules) {
    score += 30;
    bonuses.push({ amount: 30, reason: 'AI assistant configuration present (CLAUDE.md or .cursorrules)' });
  } else {
    penalties.push({ amount: 30, reason: 'No AI assistant configuration (CLAUDE.md or .cursorrules)' });
  }

  // CI/CD Configuration (25 points)
  if (githubConfig.hasGitHubActions || githubConfig.hasCircleCI || githubConfig.hasJenkins) {
    score += 25;
    bonuses.push({ amount: 25, reason: 'CI/CD configured' });
  } else {
    penalties.push({ amount: 25, reason: 'No CI/CD configuration detected' });
  }

  // PR Template (15 points)
  if (githubConfig.hasPrTemplate) {
    score += 15;
    bonuses.push({ amount: 15, reason: 'PR template present' });
  } else {
    penalties.push({ amount: 15, reason: 'No PR template' });
  }

  // Issue Templates (10 points)
  if (githubConfig.hasIssueTemplates) {
    score += 10;
    bonuses.push({ amount: 10, reason: 'Issue templates present' });
  }

  // Contributing Guide (10 points)
  if (githubConfig.hasContributing) {
    score += 10;
    bonuses.push({ amount: 10, reason: 'CONTRIBUTING.md present' });
  }

  // Branch Protection (10 points)
  if (githubConfig.hasBranchProtection) {
    score += 10;
    bonuses.push({ amount: 10, reason: 'Branch protection detected' });
  }

  return {
    score: clamp(score, 0, 100),
    penalties,
    bonuses,
  };
}

/**
 * Calculate overall score from dimension scores
 */
export function calculateOverallScore(
  breakdown: FullScoreBreakdown,
  weights: Record<AssessmentDimension, number> = DEFAULT_DIMENSION_WEIGHTS
): number {
  const overall =
    breakdown.structuralQuality * weights.structuralQuality +
    breakdown.complexityManagement * weights.complexityManagement +
    breakdown.documentationCoverage * weights.documentationCoverage +
    breakdown.testCoverage * weights.testCoverage +
    breakdown.typeAnnotations * weights.typeAnnotations +
    breakdown.namingClarity * weights.namingClarity +
    breakdown.architecturalClarity * weights.architecturalClarity +
    breakdown.toolingSupport * weights.toolingSupport +
    breakdown.githubReadiness * weights.githubReadiness;

  return Math.round(overall);
}

/**
 * Calculate grade from overall score
 */
export function calculateGradeFromScore(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Get grade description
 */
export function getGradeDescription(grade: 'A' | 'B' | 'C' | 'D' | 'F'): string {
  switch (grade) {
    case 'A':
      return 'Excellent AI-readiness. Code is highly optimized for AI coding agents.';
    case 'B':
      return 'Good AI-readiness. Minor improvements recommended for optimal AI agent performance.';
    case 'C':
      return 'Fair AI-readiness. Several areas need attention before AI transformation.';
    case 'D':
      return 'Poor AI-readiness. Significant refactoring recommended to improve AI agent compatibility.';
    case 'F':
      return 'Not AI-ready. Major structural and quality issues must be addressed before AI agents can work effectively.';
  }
}

/**
 * Get score category label
 */
export function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 70) return 'Fair';
  if (score >= 60) return 'Poor';
  return 'Critical';
}

/**
 * Calculate full score breakdown from repository analysis
 */
export function calculateFullBreakdown(
  analysis: RepositoryAnalysis,
  tooling: ToolingConfig,
  githubConfig: GitHubReadinessConfig,
  thresholds: AssessmentThresholds = DEFAULT_ASSESSMENT_THRESHOLDS
): {
  breakdown: FullScoreBreakdown;
  dimensionResults: Map<AssessmentDimension, DimensionScoreResult>;
} {
  const dimensionResults = new Map<AssessmentDimension, DimensionScoreResult>();

  // Calculate each dimension
  const structuralResult = calculateStructuralQualityScore(analysis.structural, thresholds);
  dimensionResults.set('structuralQuality', structuralResult);

  const complexityResult = calculateComplexityManagementScore(analysis.complexity, thresholds);
  dimensionResults.set('complexityManagement', complexityResult);

  const documentationResult = calculateDocumentationCoverageScore(
    analysis.quality,
    githubConfig.hasReadme,
    githubConfig.hasADRs
  );
  dimensionResults.set('documentationCoverage', documentationResult);

  const testResult = calculateTestCoverageScore(analysis.quality);
  dimensionResults.set('testCoverage', testResult);

  const typeResult = calculateTypeAnnotationsScore(analysis.quality, true, false);
  dimensionResults.set('typeAnnotations', typeResult);

  const namingResult = calculateNamingClarityScore(analysis, analysis.antiPatterns);
  dimensionResults.set('namingClarity', namingResult);

  const architectureResult = calculateArchitecturalClarityScore(analysis, analysis.antiPatterns);
  dimensionResults.set('architecturalClarity', architectureResult);

  const toolingResult = calculateToolingSupportScore(tooling);
  dimensionResults.set('toolingSupport', toolingResult);

  const githubResult = calculateGitHubReadinessScore(githubConfig);
  dimensionResults.set('githubReadiness', githubResult);

  const breakdown: FullScoreBreakdown = {
    structuralQuality: structuralResult.score,
    complexityManagement: complexityResult.score,
    documentationCoverage: documentationResult.score,
    testCoverage: testResult.score,
    typeAnnotations: typeResult.score,
    namingClarity: namingResult.score,
    architecturalClarity: architectureResult.score,
    toolingSupport: toolingResult.score,
    githubReadiness: githubResult.score,
  };

  return { breakdown, dimensionResults };
}
