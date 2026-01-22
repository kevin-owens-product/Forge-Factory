/**
 * @package @forge/ai-readiness
 * @description TypeScript interfaces for AI-Readiness Assessment
 */

import type {
  AIReadinessGrade,
  RepositoryAnalysis,
  AntiPattern,
  Severity,
} from '@forge/analysis';

/**
 * Priority levels for recommendations
 */
export type Priority = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Effort levels for improvements
 */
export type EffortLevel = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * Assessment dimension types
 */
export type AssessmentDimension =
  | 'structuralQuality'
  | 'complexityManagement'
  | 'documentationCoverage'
  | 'testCoverage'
  | 'typeAnnotations'
  | 'namingClarity'
  | 'architecturalClarity'
  | 'toolingSupport'
  | 'githubReadiness';

/**
 * Dimension category types
 */
export type DimensionCategory = 'quantitative' | 'qualitative' | 'practical';

/**
 * Assessment penalty for scoring
 */
export interface AssessmentPenalty {
  /** Penalty amount (points deducted) */
  amount: number;
  /** Reason for the penalty */
  reason: string;
  /** Affected files or items */
  affectedItems?: string[];
}

/**
 * Dimension metadata
 */
export interface DimensionInfo {
  /** Dimension key */
  key: AssessmentDimension;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Category */
  category: DimensionCategory;
  /** Weight in overall score (0-1) */
  weight: number;
  /** Maximum score */
  maxScore: number;
}

/**
 * Score breakdown by all 9 dimensions (ADR-039)
 */
export interface FullScoreBreakdown {
  /** Structural quality score (20% weight) */
  structuralQuality: number;
  /** Complexity management score (15% weight) */
  complexityManagement: number;
  /** Documentation coverage score (15% weight) */
  documentationCoverage: number;
  /** Test coverage score (10% weight) */
  testCoverage: number;
  /** Type annotations score (10% weight) */
  typeAnnotations: number;
  /** Naming clarity score (10% weight) - qualitative */
  namingClarity: number;
  /** Architectural clarity score (10% weight) - qualitative */
  architecturalClarity: number;
  /** Tooling support score (5% weight) */
  toolingSupport: number;
  /** GitHub readiness score (5% weight) */
  githubReadiness: number;
}

/**
 * Improvement recommendation
 */
export interface ImprovementRecommendation {
  /** Unique identifier */
  id: string;
  /** Priority level */
  priority: Priority;
  /** Impact level */
  impact: Priority;
  /** Effort level */
  effort: EffortLevel;
  /** Short title */
  title: string;
  /** Detailed description */
  description: string;
  /** Related dimension */
  dimension: AssessmentDimension;
  /** Estimated score improvement */
  estimatedImpact: number;
  /** Estimated hours to implement */
  estimatedHours: number;
  /** Whether automation is available */
  automationAvailable: boolean;
  /** Affected files */
  affectedFiles: string[];
  /** Actionable steps */
  actionSteps?: string[];
}

/**
 * Effort estimation
 */
export interface EffortEstimate {
  /** Total estimated hours */
  totalHours: number;
  /** Hours by dimension */
  byDimension: Record<AssessmentDimension, number>;
  /** Expected score after improvements */
  targetScore: number;
  /** Effort breakdown by priority */
  byPriority: {
    high: number;
    medium: number;
    low: number;
  };
}

/**
 * Historical trend data point
 */
export interface TrendDataPoint {
  /** Timestamp */
  timestamp: Date;
  /** Overall score */
  score: number;
  /** Grade */
  grade: AIReadinessGrade;
  /** Breakdown by dimension */
  breakdown: FullScoreBreakdown;
}

/**
 * Score trends over time
 */
export interface ScoreTrends {
  /** Current score */
  current: number;
  /** Previous score (if available) */
  previous?: number;
  /** Change from previous */
  change?: number;
  /** Trend direction */
  direction: 'improving' | 'declining' | 'stable' | 'unknown';
  /** Historical data points */
  history: TrendDataPoint[];
}

/**
 * Tooling configuration detected
 */
export interface ToolingConfig {
  /** Has ESLint config */
  hasEslint: boolean;
  /** Has Prettier config */
  hasPrettier: boolean;
  /** Has Pylint config */
  hasPylint: boolean;
  /** Has Black config */
  hasBlack: boolean;
  /** Has RuboCop config */
  hasRubocop: boolean;
  /** Has GoFmt */
  hasGofmt: boolean;
  /** Has package manager config */
  hasPackageManager: boolean;
  /** Package manager type */
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'pip' | 'poetry' | 'go' | 'maven' | 'gradle';
  /** Has build tool */
  hasBuildTool: boolean;
  /** Build tool type */
  buildTool?: string;
  /** Has pre-commit hooks */
  hasPreCommitHooks: boolean;
  /** Has Husky config */
  hasHusky: boolean;
}

/**
 * GitHub/DevOps readiness configuration
 */
export interface GitHubReadinessConfig {
  /** Has CLAUDE.md file */
  hasClaudeMd: boolean;
  /** Has .cursorrules file */
  hasCursorRules: boolean;
  /** Has GitHub Actions */
  hasGitHubActions: boolean;
  /** Has CircleCI */
  hasCircleCI: boolean;
  /** Has Jenkins config */
  hasJenkins: boolean;
  /** Has PR template */
  hasPrTemplate: boolean;
  /** Has issue templates */
  hasIssueTemplates: boolean;
  /** Has CONTRIBUTING.md */
  hasContributing: boolean;
  /** Has branch protection (detected from config) */
  hasBranchProtection: boolean;
  /** Has README.md */
  hasReadme: boolean;
  /** Has CODEOWNERS */
  hasCodeowners: boolean;
  /** Has ADRs (Architecture Decision Records) */
  hasADRs: boolean;
}

/**
 * Assessment file information
 */
export interface AssessmentFileInfo {
  /** File path */
  path: string;
  /** Lines of code */
  linesOfCode: number;
  /** Language */
  language: string;
  /** Issues count */
  issuesCount: number;
  /** Most severe issue */
  maxSeverity?: Severity;
  /** Assessment notes */
  notes?: string[];
}

/**
 * Function assessment information
 */
export interface AssessmentFunctionInfo {
  /** Function name */
  name: string;
  /** File path */
  filePath: string;
  /** Start line */
  startLine: number;
  /** End line */
  endLine: number;
  /** Lines of code */
  linesOfCode: number;
  /** Cyclomatic complexity */
  cyclomaticComplexity: number;
  /** Cognitive complexity */
  cognitiveComplexity: number;
  /** Nesting depth */
  nestingDepth: number;
  /** Parameter count */
  parameterCount: number;
  /** Has documentation */
  hasDocumentation: boolean;
  /** Has type annotations */
  hasTypeAnnotations: boolean;
  /** Issues found */
  issues: string[];
}

/**
 * Detailed assessment data
 */
export interface AssessmentDetails {
  /** Large files (>500 LOC) */
  largeFiles: AssessmentFileInfo[];
  /** Complex functions */
  complexFunctions: AssessmentFunctionInfo[];
  /** Functions needing attention */
  functionsNeedingAttention: AssessmentFunctionInfo[];
  /** Anti-patterns by category */
  antiPatternsByCategory: Record<string, AntiPattern[]>;
  /** Files missing documentation */
  filesMissingDocs: string[];
  /** Files missing tests */
  filesMissingTests: string[];
}

/**
 * Report section
 */
export interface ReportSection {
  /** Section ID */
  id: string;
  /** Section title */
  title: string;
  /** Section content (markdown) */
  content: string;
  /** Sub-sections */
  subSections?: ReportSection[];
}

/**
 * Assessment report
 */
export interface AssessmentReport {
  /** Report title */
  title: string;
  /** Generation timestamp */
  generatedAt: Date;
  /** Repository path */
  repositoryPath: string;
  /** Executive summary */
  summary: string;
  /** Overall score */
  overallScore: number;
  /** Letter grade */
  grade: AIReadinessGrade;
  /** Score breakdown */
  breakdown: FullScoreBreakdown;
  /** Recommendations */
  recommendations: ImprovementRecommendation[];
  /** Effort estimate to reach target */
  effortEstimate: EffortEstimate;
  /** Trends */
  trends?: ScoreTrends;
  /** Report sections */
  sections: ReportSection[];
  /** Export formats available */
  formats: ('markdown' | 'html' | 'json' | 'pdf')[];
}

/**
 * Full AI-Readiness Assessment result
 */
export interface AIReadinessAssessment {
  /** Overall score (0-100) */
  overallScore: number;
  /** Letter grade */
  grade: AIReadinessGrade;
  /** Score breakdown by dimension */
  breakdown: FullScoreBreakdown;
  /** Dimension scores with metadata */
  dimensionScores: Map<AssessmentDimension, {
    score: number;
    penalties: AssessmentPenalty[];
    bonuses: { amount: number; reason: string }[];
  }>;
  /** Prioritized recommendations */
  recommendations: ImprovementRecommendation[];
  /** Effort estimate to reach 80+ score */
  effortEstimate: EffortEstimate;
  /** Historical trends */
  trends?: ScoreTrends;
  /** Detailed assessment data */
  details: AssessmentDetails;
  /** Tooling configuration */
  tooling: ToolingConfig;
  /** GitHub readiness */
  githubReadiness: GitHubReadinessConfig;
  /** Source repository analysis */
  sourceAnalysis: RepositoryAnalysis;
  /** Assessment timestamp */
  assessedAt: Date;
  /** Assessment duration in milliseconds */
  assessmentDuration: number;
}

/**
 * Assessment configuration
 */
export interface AssessmentConfig {
  /** Include qualitative (LLM-based) analysis */
  includeQualitative?: boolean;
  /** Target score for effort estimation */
  targetScore?: number;
  /** Custom dimension weights */
  weights?: Partial<Record<AssessmentDimension, number>>;
  /** Enable trend tracking */
  trackTrends?: boolean;
  /** Previous assessment for comparison */
  previousAssessment?: AIReadinessAssessment;
  /** Generate detailed report */
  generateReport?: boolean;
  /** Report format */
  reportFormat?: 'markdown' | 'html' | 'json';
  /** Custom thresholds */
  thresholds?: AssessmentThresholds;
}

/**
 * Assessment thresholds
 */
export interface AssessmentThresholds {
  /** Large file threshold (LOC) */
  largeFile: number;
  /** Large function threshold (LOC) */
  largeFunction: number;
  /** High complexity threshold */
  highComplexity: number;
  /** Deep nesting threshold */
  deepNesting: number;
  /** Long parameter list threshold */
  longParameterList: number;
  /** Low documentation threshold (ratio) */
  lowDocumentation: number;
  /** Low test coverage threshold (percentage) */
  lowTestCoverage: number;
}

/**
 * Default assessment thresholds
 */
export const DEFAULT_ASSESSMENT_THRESHOLDS: AssessmentThresholds = {
  largeFile: 500,
  largeFunction: 50,
  highComplexity: 10,
  deepNesting: 4,
  longParameterList: 5,
  lowDocumentation: 0.3,
  lowTestCoverage: 40,
};

/**
 * Default dimension weights (from ADR-039)
 */
export const DEFAULT_DIMENSION_WEIGHTS: Record<AssessmentDimension, number> = {
  structuralQuality: 0.20,
  complexityManagement: 0.15,
  documentationCoverage: 0.15,
  testCoverage: 0.10,
  typeAnnotations: 0.10,
  namingClarity: 0.10,
  architecturalClarity: 0.10,
  toolingSupport: 0.05,
  githubReadiness: 0.05,
};

/**
 * Dimension metadata definitions
 */
export const DIMENSION_INFO: Record<AssessmentDimension, DimensionInfo> = {
  structuralQuality: {
    key: 'structuralQuality',
    name: 'Structural Quality',
    description: 'File sizes, function sizes, and modularity',
    category: 'quantitative',
    weight: 0.20,
    maxScore: 100,
  },
  complexityManagement: {
    key: 'complexityManagement',
    name: 'Complexity Management',
    description: 'Cyclomatic complexity, cognitive complexity, nesting depth',
    category: 'quantitative',
    weight: 0.15,
    maxScore: 100,
  },
  documentationCoverage: {
    key: 'documentationCoverage',
    name: 'Documentation Coverage',
    description: 'JSDoc/docstrings, README quality, inline comments',
    category: 'quantitative',
    weight: 0.15,
    maxScore: 100,
  },
  testCoverage: {
    key: 'testCoverage',
    name: 'Test Coverage',
    description: 'Line coverage, branch coverage, test types',
    category: 'quantitative',
    weight: 0.10,
    maxScore: 100,
  },
  typeAnnotations: {
    key: 'typeAnnotations',
    name: 'Type Annotations',
    description: 'TypeScript coverage, Python type hints, explicit types',
    category: 'quantitative',
    weight: 0.10,
    maxScore: 100,
  },
  namingClarity: {
    key: 'namingClarity',
    name: 'Naming Clarity',
    description: 'Descriptive names, consistent conventions, intent clarity',
    category: 'qualitative',
    weight: 0.10,
    maxScore: 100,
  },
  architecturalClarity: {
    key: 'architecturalClarity',
    name: 'Architectural Clarity',
    description: 'Directory structure, dependency graph, separation of concerns',
    category: 'qualitative',
    weight: 0.10,
    maxScore: 100,
  },
  toolingSupport: {
    key: 'toolingSupport',
    name: 'Tooling Support',
    description: 'Linters, formatters, package managers, build tools',
    category: 'practical',
    weight: 0.05,
    maxScore: 100,
  },
  githubReadiness: {
    key: 'githubReadiness',
    name: 'GitHub Readiness',
    description: 'CI/CD, PR templates, CLAUDE.md, contributing guides',
    category: 'practical',
    weight: 0.05,
    maxScore: 100,
  },
};

/**
 * Assessment progress callback
 */
export type AssessmentProgressCallback = (progress: AssessmentProgress) => void;

/**
 * Assessment progress information
 */
export interface AssessmentProgress {
  /** Current phase */
  phase: 'initializing' | 'analyzing' | 'scoring' | 'generating-recommendations' | 'generating-report' | 'complete';
  /** Current step description */
  step: string;
  /** Percentage complete (0-100) */
  percentage: number;
  /** Current dimension being scored */
  currentDimension?: AssessmentDimension;
}

/**
 * Export format options
 */
export interface ExportOptions {
  /** Output format */
  format: 'markdown' | 'html' | 'json' | 'csv';
  /** Include detailed findings */
  includeDetails?: boolean;
  /** Include recommendations */
  includeRecommendations?: boolean;
  /** Include file-level breakdown */
  includeFileBreakdown?: boolean;
  /** Include trends */
  includeTrends?: boolean;
}
