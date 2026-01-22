/**
 * @package @forge/analysis
 * @description Multi-language code analysis with AST parsing, metrics extraction, and AI-readiness scoring
 */

// Main service
export {
  AnalysisService,
  getAnalysisService,
  resetAnalysisService,
  analyzeFile,
  analyzeFiles,
  analyzeRepository,
} from './analysis.service.js';

// Language utilities
export {
  detectLanguage,
  getFileExtension,
  getLanguageTier,
  isLanguageSupported,
  getSupportedExtensions,
  getExtensionsForLanguage,
  createSourceFile,
  groupFilesByLanguage,
  filterByLanguageTier,
  shouldIncludeFile,
  matchPattern,
  getLanguageStatistics,
  detectPrimaryLanguage,
  isTestFile,
  isConfigFile,
  isGeneratedFile,
} from './language.js';

// Parser utilities
export {
  parseSourceCode,
  calculateFunctionComplexity,
} from './parser.js';

export type {
  ParsedFunction,
  ParsedClass,
  ParsedImport,
  ParsedExport,
  ParseResult,
} from './parser.js';

// Metrics utilities
export {
  extractStructuralMetrics,
  aggregateStructuralMetrics,
  calculateComplexityMetrics,
  aggregateComplexityMetrics,
  mergeComplexityMetrics,
  calculateQualityIndicators,
  calculateCommentDensity,
  getComplexityGrade,
  findMostComplexFunctions,
  findFunctionsNeedingAttention,
} from './metrics.js';

// Anti-pattern detection
export {
  detectAntiPatterns,
  detectComplexityAntiPatterns,
  getAvailableDetectors,
  getDetectorInfo,
  countBySeverity,
  countByCategory,
} from './antipatterns.js';

// Scoring utilities
export {
  calculateAIReadinessScore,
  calculateStructuralScore,
  calculateComplexityScore,
  calculateDocumentationScore,
  calculateTestingScore,
  calculateTypeScore,
  calculateSecurityScore,
  calculateIndicators,
  generateRecommendations,
  calculateGrade,
  getGradeDescription,
  calculatePotentialImprovement,
  getScoreCategory,
} from './scoring.js';

// Types
export type {
  SupportedLanguage,
  LanguageTier,
  Severity,
  AIReadinessGrade,
  AntiPatternCategory,
  SourceFile,
  StructuralMetrics,
  FunctionComplexity,
  ComplexityMetrics,
  AntiPattern,
  QualityIndicators,
  AIReadinessIndicators,
  AIReadinessScoreBreakdown,
  AIReadinessRecommendation,
  AIReadinessScore,
  FileAnalysisResult,
  LanguageBreakdown,
  RepositoryAnalysis,
  AnalysisConfig,
  AnalysisThresholds,
  AnalysisProgress,
  AnalysisProgressCallback,
  AnalyzerCapabilities,
  LanguageAnalyzer,
} from './analysis.types.js';

// Constants
export {
  LANGUAGE_EXTENSIONS,
  LANGUAGE_TIERS,
  DEFAULT_THRESHOLDS,
  DEFAULT_ANALYSIS_CONFIG,
  SCORING_WEIGHTS,
} from './analysis.types.js';
