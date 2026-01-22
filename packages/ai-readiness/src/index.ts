/**
 * @package @forge/ai-readiness
 * @description AI-Readiness Assessment feature for evaluating codebase compatibility with AI coding agents
 */

// Main service
export {
  AIReadinessService,
  getAIReadinessService,
  resetAIReadinessService,
  assessRepository,
  quickAssess,
  generateAssessmentReport,
  exportAssessment,
} from './ai-readiness.service.js';

// Scoring
export {
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
  calculateFullBreakdown,
  calculateGradeFromScore,
  getGradeDescription,
  getScoreLabel,
} from './scoring.js';

export type { DimensionScoreResult } from './scoring.js';

// Detection
export {
  detectTooling,
  detectGitHubReadiness,
  detectTests,
  supportsTypeAnnotations,
  hasStrictTypeConfig,
  createToolingConfig,
  createGitHubReadinessConfig,
  InMemoryFileSystem,
} from './detection.js';

export type { FileSystem } from './detection.js';

// Recommendations
export {
  generateRecommendations,
  calculateEffortEstimate,
  getHighPriorityRecommendations,
  getRecommendationsForDimension,
  getQuickWins,
  getTotalEstimatedHours,
  getAutomatableRecommendations,
  calculatePotentialImprovement,
} from './recommendations.js';

// Report generation
export {
  generateReport,
  exportToMarkdown,
  exportToJson,
  exportToHtml,
  exportToCsv,
  exportReport,
} from './report.js';

// React components
export {
  AIReadinessProvider,
  useAIReadinessContext,
  useAssessment,
  useAssessmentScore,
  useRecommendations,
  useDimensionScore,
  useEffortEstimate,
  ScoreCard,
  ScoreBreakdown,
  RecommendationList,
  AssessmentDashboard,
} from './react/index.js';

// Types
export type {
  Priority,
  EffortLevel,
  AssessmentDimension,
  DimensionCategory,
  AssessmentPenalty,
  DimensionInfo,
  FullScoreBreakdown,
  ImprovementRecommendation,
  EffortEstimate,
  TrendDataPoint,
  ScoreTrends,
  ToolingConfig,
  GitHubReadinessConfig,
  AssessmentFileInfo,
  AssessmentFunctionInfo,
  AssessmentDetails,
  ReportSection,
  AssessmentReport,
  AIReadinessAssessment,
  AssessmentConfig,
  AssessmentThresholds,
  AssessmentProgress,
  AssessmentProgressCallback,
  ExportOptions,
} from './ai-readiness.types.js';

// Constants
export {
  DEFAULT_ASSESSMENT_THRESHOLDS,
  DEFAULT_DIMENSION_WEIGHTS,
  DIMENSION_INFO,
} from './ai-readiness.types.js';
