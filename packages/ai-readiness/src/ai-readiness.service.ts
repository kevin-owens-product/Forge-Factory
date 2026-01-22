/**
 * @package @forge/ai-readiness
 * @description Main AI-Readiness Assessment Service orchestrator
 */

import type {
  RepositoryAnalysis,
  AntiPattern,
} from '@forge/analysis';

import type {
  AIReadinessAssessment,
  AssessmentConfig,
  AssessmentProgress,
  AssessmentProgressCallback,
  FullScoreBreakdown,
  AssessmentDetails,
  AssessmentFileInfo,
  AssessmentFunctionInfo,
  ToolingConfig,
  GitHubReadinessConfig,
  AssessmentDimension,
  AssessmentReport,
  ExportOptions,
} from './ai-readiness.types.js';

import {
  DEFAULT_ASSESSMENT_THRESHOLDS,
  DEFAULT_DIMENSION_WEIGHTS,
} from './ai-readiness.types.js';

import {
  calculateFullBreakdown,
  calculateOverallScore,
  calculateGradeFromScore,
  type DimensionScoreResult,
} from './scoring.js';

import {
  detectTooling,
  detectGitHubReadiness,
  detectTests,
  createToolingConfig,
  createGitHubReadinessConfig,
  type FileSystem,
  InMemoryFileSystem,
} from './detection.js';

import {
  generateRecommendations,
  calculateEffortEstimate,
} from './recommendations.js';

import {
  generateReport,
  exportReport,
} from './report.js';

/**
 * AI-Readiness Assessment Service
 *
 * Main orchestrator for running AI-readiness assessments on codebases.
 * Integrates with @forge/analysis for code analysis and provides
 * comprehensive scoring, recommendations, and reporting.
 */
export class AIReadinessService {
  private static instance: AIReadinessService | null = null;
  private fileSystem: FileSystem;

  constructor(fileSystem?: FileSystem) {
    this.fileSystem = fileSystem || new InMemoryFileSystem();
  }

  /**
   * Get singleton instance
   */
  static getInstance(fileSystem?: FileSystem): AIReadinessService {
    if (!AIReadinessService.instance) {
      AIReadinessService.instance = new AIReadinessService(fileSystem);
    }
    return AIReadinessService.instance;
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    AIReadinessService.instance = null;
  }

  /**
   * Set file system (for testing)
   */
  setFileSystem(fs: FileSystem): void {
    this.fileSystem = fs;
  }

  /**
   * Run a complete AI-readiness assessment on a repository
   */
  async assessRepository(
    repositoryAnalysis: RepositoryAnalysis,
    config: AssessmentConfig = {},
    onProgress?: AssessmentProgressCallback
  ): Promise<AIReadinessAssessment> {
    const startTime = Date.now();
    const repoPath = repositoryAnalysis.repositoryPath;

    // Report progress
    this.reportProgress(onProgress, {
      phase: 'initializing',
      step: 'Starting assessment',
      percentage: 0,
    });

    // Detect tooling configuration
    this.reportProgress(onProgress, {
      phase: 'analyzing',
      step: 'Detecting tooling configuration',
      percentage: 10,
    });
    const tooling = await detectTooling(repoPath, this.fileSystem);

    // Detect GitHub readiness
    this.reportProgress(onProgress, {
      phase: 'analyzing',
      step: 'Detecting GitHub readiness',
      percentage: 20,
    });
    const githubConfig = await detectGitHubReadiness(repoPath, this.fileSystem);

    // Detect tests
    this.reportProgress(onProgress, {
      phase: 'analyzing',
      step: 'Detecting test presence',
      percentage: 30,
    });
    await detectTests(repoPath, this.fileSystem);

    // Calculate scores for all dimensions
    this.reportProgress(onProgress, {
      phase: 'scoring',
      step: 'Calculating dimension scores',
      percentage: 40,
    });

    const thresholds = config.thresholds || DEFAULT_ASSESSMENT_THRESHOLDS;
    const weights = config.weights
      ? { ...DEFAULT_DIMENSION_WEIGHTS, ...config.weights }
      : DEFAULT_DIMENSION_WEIGHTS;

    const { breakdown, dimensionResults } = calculateFullBreakdown(
      repositoryAnalysis,
      tooling,
      githubConfig,
      thresholds
    );

    // Calculate overall score
    this.reportProgress(onProgress, {
      phase: 'scoring',
      step: 'Calculating overall score',
      percentage: 60,
    });

    const overallScore = calculateOverallScore(breakdown, weights);
    const grade = calculateGradeFromScore(overallScore);

    // Generate recommendations
    this.reportProgress(onProgress, {
      phase: 'generating-recommendations',
      step: 'Generating recommendations',
      percentage: 70,
    });

    const recommendations = generateRecommendations(
      repositoryAnalysis,
      breakdown,
      tooling,
      githubConfig,
      thresholds
    );

    // Calculate effort estimate
    this.reportProgress(onProgress, {
      phase: 'generating-recommendations',
      step: 'Calculating effort estimate',
      percentage: 80,
    });

    const targetScore = config.targetScore || 80;
    const effortEstimate = calculateEffortEstimate(
      overallScore,
      breakdown,
      recommendations,
      targetScore
    );

    // Build assessment details
    this.reportProgress(onProgress, {
      phase: 'generating-report',
      step: 'Building assessment details',
      percentage: 90,
    });

    const details = this.buildAssessmentDetails(repositoryAnalysis, thresholds);

    // Complete
    this.reportProgress(onProgress, {
      phase: 'complete',
      step: 'Assessment complete',
      percentage: 100,
    });

    const assessmentDuration = Date.now() - startTime;

    return {
      overallScore,
      grade,
      breakdown,
      dimensionScores: dimensionResults,
      recommendations,
      effortEstimate,
      trends: config.previousAssessment
        ? this.calculateTrends(
            overallScore,
            grade,
            breakdown,
            config.previousAssessment
          )
        : undefined,
      details,
      tooling,
      githubReadiness: githubConfig,
      sourceAnalysis: repositoryAnalysis,
      assessedAt: new Date(),
      assessmentDuration,
    };
  }

  /**
   * Assess from pre-analyzed data (for testing or when analysis is done separately)
   */
  async assessFromAnalysis(
    analysis: RepositoryAnalysis,
    tooling: ToolingConfig,
    githubConfig: GitHubReadinessConfig,
    config: AssessmentConfig = {}
  ): Promise<AIReadinessAssessment> {
    const startTime = Date.now();

    const thresholds = config.thresholds || DEFAULT_ASSESSMENT_THRESHOLDS;
    const weights = config.weights
      ? { ...DEFAULT_DIMENSION_WEIGHTS, ...config.weights }
      : DEFAULT_DIMENSION_WEIGHTS;

    const { breakdown, dimensionResults } = calculateFullBreakdown(
      analysis,
      tooling,
      githubConfig,
      thresholds
    );

    const overallScore = calculateOverallScore(breakdown, weights);
    const grade = calculateGradeFromScore(overallScore);

    const recommendations = generateRecommendations(
      analysis,
      breakdown,
      tooling,
      githubConfig,
      thresholds
    );

    const targetScore = config.targetScore || 80;
    const effortEstimate = calculateEffortEstimate(
      overallScore,
      breakdown,
      recommendations,
      targetScore
    );

    const details = this.buildAssessmentDetails(analysis, thresholds);

    return {
      overallScore,
      grade,
      breakdown,
      dimensionScores: dimensionResults,
      recommendations,
      effortEstimate,
      details,
      tooling,
      githubReadiness: githubConfig,
      sourceAnalysis: analysis,
      assessedAt: new Date(),
      assessmentDuration: Date.now() - startTime,
    };
  }

  /**
   * Generate assessment report
   */
  generateReport(assessment: AIReadinessAssessment): AssessmentReport {
    return generateReport(assessment);
  }

  /**
   * Export assessment to various formats
   */
  exportAssessment(assessment: AIReadinessAssessment, options: ExportOptions): string {
    return exportReport(assessment, options);
  }

  /**
   * Get dimension score details
   */
  getDimensionScore(
    assessment: AIReadinessAssessment,
    dimension: AssessmentDimension
  ): DimensionScoreResult | undefined {
    return assessment.dimensionScores.get(dimension);
  }

  /**
   * Compare two assessments
   */
  compareAssessments(
    current: AIReadinessAssessment,
    previous: AIReadinessAssessment
  ): {
    scoreChange: number;
    gradeChange: string;
    dimensionChanges: Record<AssessmentDimension, number>;
    improvements: string[];
    regressions: string[];
  } {
    const scoreChange = current.overallScore - previous.overallScore;
    const gradeChange = `${previous.grade} → ${current.grade}`;

    const dimensionChanges: Record<AssessmentDimension, number> = {
      structuralQuality:
        current.breakdown.structuralQuality - previous.breakdown.structuralQuality,
      complexityManagement:
        current.breakdown.complexityManagement - previous.breakdown.complexityManagement,
      documentationCoverage:
        current.breakdown.documentationCoverage - previous.breakdown.documentationCoverage,
      testCoverage: current.breakdown.testCoverage - previous.breakdown.testCoverage,
      typeAnnotations:
        current.breakdown.typeAnnotations - previous.breakdown.typeAnnotations,
      namingClarity: current.breakdown.namingClarity - previous.breakdown.namingClarity,
      architecturalClarity:
        current.breakdown.architecturalClarity - previous.breakdown.architecturalClarity,
      toolingSupport:
        current.breakdown.toolingSupport - previous.breakdown.toolingSupport,
      githubReadiness:
        current.breakdown.githubReadiness - previous.breakdown.githubReadiness,
    };

    const improvements: string[] = [];
    const regressions: string[] = [];

    for (const [dimension, change] of Object.entries(dimensionChanges)) {
      if (change > 5) {
        improvements.push(`${dimension}: +${change} points`);
      } else if (change < -5) {
        regressions.push(`${dimension}: ${change} points`);
      }
    }

    return {
      scoreChange,
      gradeChange,
      dimensionChanges,
      improvements,
      regressions,
    };
  }

  /**
   * Build assessment details from analysis
   */
  private buildAssessmentDetails(
    analysis: RepositoryAnalysis,
    thresholds: typeof DEFAULT_ASSESSMENT_THRESHOLDS
  ): AssessmentDetails {
    // Large files
    const largeFiles: AssessmentFileInfo[] = [];
    const fileIssueCount = new Map<string, number>();

    for (const pattern of analysis.antiPatterns) {
      const count = fileIssueCount.get(pattern.filePath) || 0;
      fileIssueCount.set(pattern.filePath, count + 1);
    }

    // Get unique files with issues
    const filesWithIssues = new Set<string>();
    for (const fn of analysis.complexity.functions) {
      if (fn.linesOfCode > thresholds.largeFile) {
        filesWithIssues.add(fn.filePath);
      }
    }

    for (const filePath of filesWithIssues) {
      const functions = analysis.complexity.functions.filter(
        (f) => f.filePath === filePath
      );
      const totalLines = functions.reduce((sum, f) => sum + f.linesOfCode, 0);

      largeFiles.push({
        path: filePath,
        linesOfCode: totalLines,
        language: 'unknown', // Would need file info
        issuesCount: fileIssueCount.get(filePath) || 0,
      });
    }

    // Complex functions
    const complexFunctions: AssessmentFunctionInfo[] = analysis.complexity.functions
      .filter((f) => f.cyclomaticComplexity > thresholds.highComplexity)
      .sort((a, b) => b.cyclomaticComplexity - a.cyclomaticComplexity)
      .slice(0, 20)
      .map((f) => ({
        name: f.name,
        filePath: f.filePath,
        startLine: f.startLine,
        endLine: f.endLine,
        linesOfCode: f.linesOfCode,
        cyclomaticComplexity: f.cyclomaticComplexity,
        cognitiveComplexity: f.cognitiveComplexity,
        nestingDepth: f.nestingDepth,
        parameterCount: f.parameterCount,
        hasDocumentation: false, // Would need more info
        hasTypeAnnotations: false, // Would need more info
        issues: [],
      }));

    // Functions needing attention (multiple issues)
    const functionsNeedingAttention: AssessmentFunctionInfo[] = analysis.complexity.functions
      .filter(
        (f) =>
          f.cyclomaticComplexity > thresholds.highComplexity ||
          f.nestingDepth > thresholds.deepNesting ||
          f.parameterCount > thresholds.longParameterList ||
          f.linesOfCode > thresholds.largeFunction
      )
      .sort((a, b) => {
        // Sort by number of issues
        const issuesA =
          (a.cyclomaticComplexity > thresholds.highComplexity ? 1 : 0) +
          (a.nestingDepth > thresholds.deepNesting ? 1 : 0) +
          (a.parameterCount > thresholds.longParameterList ? 1 : 0) +
          (a.linesOfCode > thresholds.largeFunction ? 1 : 0);
        const issuesB =
          (b.cyclomaticComplexity > thresholds.highComplexity ? 1 : 0) +
          (b.nestingDepth > thresholds.deepNesting ? 1 : 0) +
          (b.parameterCount > thresholds.longParameterList ? 1 : 0) +
          (b.linesOfCode > thresholds.largeFunction ? 1 : 0);
        return issuesB - issuesA;
      })
      .slice(0, 15)
      .map((f) => {
        const issues: string[] = [];
        if (f.cyclomaticComplexity > thresholds.highComplexity) {
          issues.push(`High complexity (${f.cyclomaticComplexity})`);
        }
        if (f.nestingDepth > thresholds.deepNesting) {
          issues.push(`Deep nesting (${f.nestingDepth} levels)`);
        }
        if (f.parameterCount > thresholds.longParameterList) {
          issues.push(`Many parameters (${f.parameterCount})`);
        }
        if (f.linesOfCode > thresholds.largeFunction) {
          issues.push(`Large function (${f.linesOfCode} LOC)`);
        }

        return {
          name: f.name,
          filePath: f.filePath,
          startLine: f.startLine,
          endLine: f.endLine,
          linesOfCode: f.linesOfCode,
          cyclomaticComplexity: f.cyclomaticComplexity,
          cognitiveComplexity: f.cognitiveComplexity,
          nestingDepth: f.nestingDepth,
          parameterCount: f.parameterCount,
          hasDocumentation: false,
          hasTypeAnnotations: false,
          issues,
        };
      });

    // Anti-patterns by category
    const antiPatternsByCategory: Record<string, AntiPattern[]> = {};
    for (const pattern of analysis.antiPatterns) {
      const category = pattern.category;
      if (!antiPatternsByCategory[category]) {
        antiPatternsByCategory[category] = [];
      }
      antiPatternsByCategory[category].push(pattern);
    }

    return {
      largeFiles,
      complexFunctions,
      functionsNeedingAttention,
      antiPatternsByCategory,
      filesMissingDocs: [],
      filesMissingTests: [],
    };
  }

  /**
   * Calculate trends from previous assessment
   */
  private calculateTrends(
    currentScore: number,
    currentGrade: string,
    currentBreakdown: FullScoreBreakdown,
    previousAssessment: AIReadinessAssessment
  ): {
    current: number;
    previous: number;
    change: number;
    direction: 'improving' | 'declining' | 'stable' | 'unknown';
    history: Array<{
      timestamp: Date;
      score: number;
      grade: 'A' | 'B' | 'C' | 'D' | 'F';
      breakdown: FullScoreBreakdown;
    }>;
  } {
    const change = currentScore - previousAssessment.overallScore;
    let direction: 'improving' | 'declining' | 'stable' | 'unknown' = 'stable';

    if (change > 5) {
      direction = 'improving';
    } else if (change < -5) {
      direction = 'declining';
    }

    return {
      current: currentScore,
      previous: previousAssessment.overallScore,
      change,
      direction,
      history: [
        {
          timestamp: previousAssessment.assessedAt,
          score: previousAssessment.overallScore,
          grade: previousAssessment.grade,
          breakdown: previousAssessment.breakdown,
        },
        {
          timestamp: new Date(),
          score: currentScore,
          grade: currentGrade as 'A' | 'B' | 'C' | 'D' | 'F',
          breakdown: currentBreakdown,
        },
      ],
    };
  }

  /**
   * Report progress to callback
   */
  private reportProgress(
    callback: AssessmentProgressCallback | undefined,
    progress: AssessmentProgress
  ): void {
    if (callback) {
      callback(progress);
    }
  }
}

/**
 * Get singleton instance
 */
export function getAIReadinessService(fileSystem?: FileSystem): AIReadinessService {
  return AIReadinessService.getInstance(fileSystem);
}

/**
 * Reset singleton instance
 */
export function resetAIReadinessService(): void {
  AIReadinessService.resetInstance();
}

/**
 * Run assessment on repository analysis
 */
export async function assessRepository(
  repositoryAnalysis: RepositoryAnalysis,
  config?: AssessmentConfig,
  onProgress?: AssessmentProgressCallback
): Promise<AIReadinessAssessment> {
  return getAIReadinessService().assessRepository(repositoryAnalysis, config, onProgress);
}

/**
 * Quick assessment from analysis data
 */
export async function quickAssess(
  analysis: RepositoryAnalysis,
  tooling?: Partial<ToolingConfig>,
  githubConfig?: Partial<GitHubReadinessConfig>
): Promise<AIReadinessAssessment> {
  return getAIReadinessService().assessFromAnalysis(
    analysis,
    createToolingConfig(tooling),
    createGitHubReadinessConfig(githubConfig)
  );
}

/**
 * Generate report from assessment
 */
export function generateAssessmentReport(assessment: AIReadinessAssessment): AssessmentReport {
  return getAIReadinessService().generateReport(assessment);
}

/**
 * Export assessment to format
 */
export function exportAssessment(
  assessment: AIReadinessAssessment,
  format: 'markdown' | 'html' | 'json' | 'csv' = 'markdown'
): string {
  return getAIReadinessService().exportAssessment(assessment, { format });
}
