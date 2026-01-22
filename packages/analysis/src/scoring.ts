/**
 * @package @forge/analysis
 * @description AI-readiness scoring engine
 */

import {
  StructuralMetrics,
  ComplexityMetrics,
  QualityIndicators,
  AIReadinessScore,
  AIReadinessGrade,
  AIReadinessIndicators,
  AIReadinessScoreBreakdown,
  AIReadinessRecommendation,
  AntiPattern,
  SCORING_WEIGHTS,
  DEFAULT_THRESHOLDS,
  AnalysisThresholds,
} from './analysis.types.js';

/**
 * Calculate AI-readiness score from analysis results
 */
export function calculateAIReadinessScore(
  structural: StructuralMetrics,
  complexity: ComplexityMetrics,
  quality: QualityIndicators,
  antiPatterns: AntiPattern[],
  thresholds: AnalysisThresholds = DEFAULT_THRESHOLDS
): AIReadinessScore {
  // Calculate individual scores
  const structuralScore = calculateStructuralScore(structural, thresholds);
  const complexityScore = calculateComplexityScore(complexity, thresholds);
  const documentationScore = calculateDocumentationScore(quality);
  const testingScore = calculateTestingScore(quality);
  const typeScore = calculateTypeScore(quality);
  const securityScore = calculateSecurityScore(antiPatterns);

  // Calculate weighted overall score
  const overall = Math.round(
    structuralScore * SCORING_WEIGHTS.structuralQuality +
    complexityScore * SCORING_WEIGHTS.complexity +
    documentationScore * SCORING_WEIGHTS.documentation +
    testingScore * SCORING_WEIGHTS.testing +
    typeScore * SCORING_WEIGHTS.typeAnnotations +
    securityScore * SCORING_WEIGHTS.security
  );

  const breakdown: AIReadinessScoreBreakdown = {
    structuralQuality: structuralScore,
    complexity: complexityScore,
    documentation: documentationScore,
    testing: testingScore,
    typeAnnotations: typeScore,
    security: securityScore,
  };

  const indicators = calculateIndicators(structural, complexity, quality);
  const recommendations = generateRecommendations(
    breakdown,
    antiPatterns,
    structural,
    complexity,
    quality,
    thresholds
  );

  return {
    overall,
    grade: calculateGrade(overall),
    breakdown,
    recommendations,
    indicators,
  };
}

/**
 * Calculate structural quality score (0-100)
 */
export function calculateStructuralScore(
  metrics: StructuralMetrics,
  thresholds: AnalysisThresholds = DEFAULT_THRESHOLDS
): number {
  let score = 100;

  // Penalize large files (>500 LOC)
  if (metrics.totalFiles > 0) {
    const largeFilesRatio = metrics.filesOver500LOC / metrics.totalFiles;
    score -= largeFilesRatio * 30; // Up to -30 points
  }

  // Penalize high average file size
  if (metrics.averageFileSize > 300) {
    const penalty = Math.min((metrics.averageFileSize - 300) / 10, 20);
    score -= penalty; // Up to -20 points
  }

  // Penalize very large functions
  if (metrics.largestFunctionSize > thresholds.maxFunctionLOC * 2) {
    const penalty = Math.min((metrics.largestFunctionSize - thresholds.maxFunctionLOC * 2) / 10, 15);
    score -= penalty; // Up to -15 points
  }

  // Reward modular structure (many small files)
  if (metrics.averageFileSize < 200 && metrics.averageFileSize > 0) {
    score += 10;
  }

  // Penalize low comment density
  const totalNonBlank = metrics.codeLines + metrics.commentLines;
  if (totalNonBlank > 0) {
    const commentRatio = metrics.commentLines / totalNonBlank;
    if (commentRatio < 0.1) {
      score -= 10; // Low documentation
    }
  }

  return clamp(score, 0, 100);
}

/**
 * Calculate complexity score (0-100)
 */
export function calculateComplexityScore(
  metrics: ComplexityMetrics,
  _thresholds: AnalysisThresholds = DEFAULT_THRESHOLDS
): number {
  let score = 100;

  // Penalize high average complexity
  if (metrics.averageCyclomaticComplexity > 5) {
    const penalty = (metrics.averageCyclomaticComplexity - 5) * 5;
    score -= Math.min(penalty, 30); // Up to -30 points
  }

  // Penalize functions over complexity threshold
  if (metrics.functions.length > 0) {
    const highComplexityRatio = metrics.functionsOverComplexity10 / metrics.functions.length;
    score -= highComplexityRatio * 25; // Up to -25 points
  }

  // Penalize deep nesting
  if (metrics.functions.length > 0) {
    const deepNestingRatio = metrics.functionsWithDeepNesting / metrics.functions.length;
    score -= deepNestingRatio * 20; // Up to -20 points
  }

  // Penalize long parameter lists
  if (metrics.functions.length > 0) {
    const manyParamsRatio = metrics.functionsWithManyParameters / metrics.functions.length;
    score -= manyParamsRatio * 10; // Up to -10 points
  }

  // Penalize max complexity being very high
  if (metrics.maxCyclomaticComplexity > 20) {
    score -= Math.min((metrics.maxCyclomaticComplexity - 20) * 2, 15);
  }

  return clamp(score, 0, 100);
}

/**
 * Calculate documentation score (0-100)
 */
export function calculateDocumentationScore(quality: QualityIndicators): number {
  // Base score from documentation coverage
  const baseScore = quality.documentationCoverage * 100;

  let score = baseScore;

  // Penalize missing documentation on many functions
  if (quality.functionsMissingDocumentation > 20) {
    score -= Math.min((quality.functionsMissingDocumentation - 20) / 2, 20);
  }

  return clamp(score, 0, 100);
}

/**
 * Calculate testing score (0-100)
 */
export function calculateTestingScore(quality: QualityIndicators): number {
  // If test coverage is available, use it directly
  if (quality.testCoverage !== undefined) {
    return clamp(quality.testCoverage, 0, 100);
  }

  // Otherwise, estimate based on anti-patterns related to testing
  // Default to 50 (unknown)
  return 50;
}

/**
 * Calculate type annotation score (0-100)
 */
export function calculateTypeScore(quality: QualityIndicators): number {
  return Math.round(quality.typeAnnotationCoverage * 100);
}

/**
 * Calculate security score (0-100)
 */
export function calculateSecurityScore(antiPatterns: AntiPattern[]): number {
  let score = 100;

  // Count security-related issues
  const securityPatterns = antiPatterns.filter(
    (p) => p.category === 'security'
  );

  // Heavy penalty for critical security issues
  const criticalCount = securityPatterns.filter((p) => p.severity === 'critical').length;
  score -= criticalCount * 20;

  // Medium penalty for high severity
  const highCount = securityPatterns.filter((p) => p.severity === 'high').length;
  score -= highCount * 10;

  // Small penalty for other security issues
  const otherCount = securityPatterns.length - criticalCount - highCount;
  score -= otherCount * 2;

  // Also penalize hardcoded values which could be secrets
  const hardcodedCount = antiPatterns.filter((p) => p.id === 'hardcoded-value').length;
  score -= Math.min(hardcodedCount, 10);

  return clamp(score, 0, 100);
}

/**
 * Calculate AI-readiness indicators
 */
export function calculateIndicators(
  structural: StructuralMetrics,
  complexity: ComplexityMetrics,
  quality: QualityIndicators
): AIReadinessIndicators {
  const largeFilesCount = structural.filesOver500LOC;

  const largeFunctionsCount = complexity.functions.filter(
    (f) => f.linesOfCode > 50
  ).length;

  const missingTypesCount = Math.round(
    complexity.functions.length * (1 - quality.typeAnnotationCoverage)
  );

  const missingDocumentationCount = quality.functionsMissingDocumentation;

  const missingTestsCount = quality.testCoverage !== undefined
    ? Math.round(structural.functionCount * (1 - quality.testCoverage / 100))
    : structural.functionCount; // Assume all if unknown

  const deepNestingCount = complexity.functionsWithDeepNesting;

  const longParameterListCount = complexity.functionsWithManyParameters;

  // Calculate AI-friendly ratio
  const totalIssues =
    largeFilesCount +
    largeFunctionsCount +
    deepNestingCount +
    longParameterListCount;

  const totalItems = structural.totalFiles + complexity.functions.length;
  const aiFriendlyRatio = totalItems > 0
    ? Math.max(0, 1 - totalIssues / totalItems)
    : 1;

  return {
    largeFilesCount,
    largeFunctionsCount,
    missingTypesCount,
    missingDocumentationCount,
    missingTestsCount,
    deepNestingCount,
    longParameterListCount,
    aiFriendlyRatio: Math.round(aiFriendlyRatio * 100) / 100,
  };
}

/**
 * Generate prioritized recommendations
 */
export function generateRecommendations(
  breakdown: AIReadinessScoreBreakdown,
  antiPatterns: AntiPattern[],
  structural: StructuralMetrics,
  complexity: ComplexityMetrics,
  quality: QualityIndicators,
  thresholds: AnalysisThresholds = DEFAULT_THRESHOLDS
): AIReadinessRecommendation[] {
  const recommendations: AIReadinessRecommendation[] = [];

  // Structural recommendations
  if (breakdown.structuralQuality < 70) {
    if (structural.filesOver500LOC > 0) {
      const affectedFiles = complexity.functions
        .filter((f) => f.linesOfCode > 500)
        .map((f) => f.filePath)
        .filter((v, i, a) => a.indexOf(v) === i);

      recommendations.push({
        priority: 1,
        category: 'structure',
        title: 'Split Large Files',
        description: `${structural.filesOver500LOC} files exceed 500 lines. Large files are harder for AI to process within context limits.`,
        impact: 15,
        affectedFiles,
        effort: 'high',
      });
    }

    if (structural.averageFileSize > 300) {
      recommendations.push({
        priority: 2,
        category: 'structure',
        title: 'Reduce Average File Size',
        description: `Average file size is ${structural.averageFileSize} lines. Aim for under 300 lines for better AI comprehension.`,
        impact: 10,
        affectedFiles: [],
        effort: 'medium',
      });
    }
  }

  // Complexity recommendations
  if (breakdown.complexity < 70) {
    const complexFunctions = complexity.functions
      .filter((f) => f.cyclomaticComplexity > thresholds.maxCyclomaticComplexity)
      .sort((a, b) => b.cyclomaticComplexity - a.cyclomaticComplexity)
      .slice(0, 10);

    if (complexFunctions.length > 0) {
      recommendations.push({
        priority: 1,
        category: 'complexity',
        title: 'Reduce Function Complexity',
        description: `${complexity.functionsOverComplexity10} functions have high cyclomatic complexity. Simplify branching and conditions.`,
        impact: 20,
        affectedFiles: complexFunctions.map((f) => `${f.filePath}:${f.startLine}`),
        effort: 'medium',
      });
    }

    if (complexity.functionsWithDeepNesting > 0) {
      const deeplyNested = complexity.functions
        .filter((f) => f.nestingDepth > thresholds.maxNestingDepth)
        .slice(0, 10);

      recommendations.push({
        priority: 2,
        category: 'complexity',
        title: 'Reduce Nesting Depth',
        description: `${complexity.functionsWithDeepNesting} functions have deep nesting (>3 levels). Use early returns and extract helpers.`,
        impact: 15,
        affectedFiles: deeplyNested.map((f) => `${f.filePath}:${f.startLine}`),
        effort: 'low',
      });
    }
  }

  // Documentation recommendations
  if (breakdown.documentation < 70) {
    recommendations.push({
      priority: 2,
      category: 'documentation',
      title: 'Add Documentation',
      description: `${quality.functionsMissingDocumentation} functions lack documentation. Document public APIs for AI understanding.`,
      impact: 15,
      affectedFiles: [],
      effort: 'medium',
    });
  }

  // Type annotation recommendations
  if (breakdown.typeAnnotations < 70) {
    recommendations.push({
      priority: 3,
      category: 'maintainability',
      title: 'Add Type Annotations',
      description: `Type coverage is ${breakdown.typeAnnotations}%. Add explicit types to help AI understand data flow.`,
      impact: 10,
      affectedFiles: [],
      effort: 'medium',
    });
  }

  // Testing recommendations
  if (breakdown.testing < 70) {
    recommendations.push({
      priority: 3,
      category: 'testing',
      title: 'Improve Test Coverage',
      description: `Test coverage is ${breakdown.testing}%. More tests help AI verify transformations.`,
      impact: 10,
      affectedFiles: [],
      effort: 'high',
    });
  }

  // Anti-pattern specific recommendations
  const todoCount = antiPatterns.filter((p) => p.id === 'todo-comment').length;
  if (todoCount > 10) {
    recommendations.push({
      priority: 4,
      category: 'maintainability',
      title: 'Address TODO Comments',
      description: `${todoCount} TODO/FIXME comments indicate unfinished work. Address before AI transformation.`,
      impact: 5,
      affectedFiles: antiPatterns
        .filter((p) => p.id === 'todo-comment')
        .slice(0, 10)
        .map((p) => `${p.filePath}:${p.line}`),
      effort: 'low',
    });
  }

  const consoleCount = antiPatterns.filter((p) => p.id === 'console-log').length;
  if (consoleCount > 5) {
    recommendations.push({
      priority: 4,
      category: 'maintainability',
      title: 'Remove Debug Statements',
      description: `${consoleCount} console statements found. Replace with proper logging.`,
      impact: 3,
      affectedFiles: antiPatterns
        .filter((p) => p.id === 'console-log')
        .slice(0, 10)
        .map((p) => `${p.filePath}:${p.line}`),
      effort: 'low',
    });
  }

  // Sort by priority
  return recommendations.sort((a, b) => a.priority - b.priority);
}

/**
 * Calculate letter grade from overall score
 */
export function calculateGrade(score: number): AIReadinessGrade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Get grade description
 */
export function getGradeDescription(grade: AIReadinessGrade): string {
  switch (grade) {
    case 'A':
      return 'Excellent AI-readiness. Code is well-structured and documented.';
    case 'B':
      return 'Good AI-readiness. Minor improvements recommended.';
    case 'C':
      return 'Fair AI-readiness. Several areas need attention before AI transformation.';
    case 'D':
      return 'Poor AI-readiness. Significant refactoring recommended first.';
    case 'F':
      return 'Not AI-ready. Major structural and quality issues must be addressed.';
  }
}

/**
 * Calculate potential score improvement
 */
export function calculatePotentialImprovement(
  recommendations: AIReadinessRecommendation[]
): number {
  return Math.min(
    recommendations.reduce((sum, r) => sum + r.impact, 0),
    40 // Cap at 40 points improvement
  );
}

/**
 * Get score category label
 */
export function getScoreCategory(
  category: keyof AIReadinessScoreBreakdown
): string {
  const labels: Record<keyof AIReadinessScoreBreakdown, string> = {
    structuralQuality: 'Structure',
    complexity: 'Complexity',
    documentation: 'Documentation',
    testing: 'Testing',
    typeAnnotations: 'Types',
    security: 'Security',
  };
  return labels[category];
}

/**
 * Clamp value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
