/**
 * @package @forge/analysis
 * @description TypeScript interfaces for multi-language code analysis
 */

/**
 * Supported programming languages for analysis
 */
export type SupportedLanguage =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'java'
  | 'go'
  | 'csharp'
  | 'ruby'
  | 'php'
  | 'rust'
  | 'kotlin'
  | 'swift'
  | 'cobol'
  | 'unknown';

/**
 * Language tier classification for analysis depth
 */
export type LanguageTier = 'primary' | 'secondary' | 'legacy' | 'unknown';

/**
 * Severity levels for anti-patterns and issues
 */
export type Severity = 'low' | 'medium' | 'high' | 'critical';

/**
 * AI-readiness grade scale
 */
export type AIReadinessGrade = 'A' | 'B' | 'C' | 'D' | 'F';

/**
 * Anti-pattern categories
 */
export type AntiPatternCategory =
  | 'complexity'
  | 'maintainability'
  | 'documentation'
  | 'naming'
  | 'structure'
  | 'testing'
  | 'security';

/**
 * File extensions mapped to languages
 */
export const LANGUAGE_EXTENSIONS: Record<string, SupportedLanguage> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.pyw': 'python',
  '.java': 'java',
  '.go': 'go',
  '.cs': 'csharp',
  '.rb': 'ruby',
  '.php': 'php',
  '.rs': 'rust',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.swift': 'swift',
  '.cob': 'cobol',
  '.cbl': 'cobol',
};

/**
 * Language tier mapping
 */
export const LANGUAGE_TIERS: Record<SupportedLanguage, LanguageTier> = {
  typescript: 'primary',
  javascript: 'primary',
  python: 'primary',
  java: 'primary',
  go: 'primary',
  csharp: 'primary',
  ruby: 'secondary',
  php: 'secondary',
  rust: 'secondary',
  kotlin: 'secondary',
  swift: 'secondary',
  cobol: 'legacy',
  unknown: 'unknown',
};

/**
 * Source file representation
 */
export interface SourceFile {
  /** Absolute file path */
  path: string;
  /** File content */
  content: string;
  /** Detected language */
  language: SupportedLanguage;
  /** File extension */
  extension: string;
  /** File size in bytes */
  size: number;
}

/**
 * Structural metrics for code analysis
 */
export interface StructuralMetrics {
  /** Total number of lines */
  totalLines: number;
  /** Lines containing code (non-blank, non-comment) */
  codeLines: number;
  /** Lines containing comments */
  commentLines: number;
  /** Blank lines */
  blankLines: number;
  /** Number of functions/methods */
  functionCount: number;
  /** Number of classes */
  classCount: number;
  /** Number of interfaces (TypeScript, Java) */
  interfaceCount: number;
  /** Number of import statements */
  importCount: number;
  /** Number of export statements */
  exportCount: number;
  /** Average function size in lines */
  averageFunctionSize: number;
  /** Largest function size in lines */
  largestFunctionSize: number;
  /** Number of files over 500 LOC */
  filesOver500LOC: number;
  /** Total number of files analyzed */
  totalFiles: number;
  /** Average file size in lines */
  averageFileSize: number;
}

/**
 * Complexity metrics for individual functions
 */
export interface FunctionComplexity {
  /** Function name */
  name: string;
  /** File path containing the function */
  filePath: string;
  /** Starting line number */
  startLine: number;
  /** Ending line number */
  endLine: number;
  /** Lines of code in function */
  linesOfCode: number;
  /** McCabe's cyclomatic complexity */
  cyclomaticComplexity: number;
  /** Cognitive complexity score */
  cognitiveComplexity: number;
  /** Maximum nesting depth */
  nestingDepth: number;
  /** Number of parameters */
  parameterCount: number;
}

/**
 * Aggregated complexity metrics
 */
export interface ComplexityMetrics {
  /** Average cyclomatic complexity across all functions */
  averageCyclomaticComplexity: number;
  /** Maximum cyclomatic complexity found */
  maxCyclomaticComplexity: number;
  /** Functions with complexity > 10 */
  functionsOverComplexity10: number;
  /** Average cognitive complexity */
  averageCognitiveComplexity: number;
  /** Average nesting depth */
  averageNestingDepth: number;
  /** Maximum nesting depth found */
  maxNestingDepth: number;
  /** Functions with nesting > 3 levels */
  functionsWithDeepNesting: number;
  /** Average parameter count */
  averageParameterCount: number;
  /** Functions with > 5 parameters */
  functionsWithManyParameters: number;
  /** Individual function complexity details */
  functions: FunctionComplexity[];
}

/**
 * Anti-pattern detection result
 */
export interface AntiPattern {
  /** Unique identifier for this pattern type */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of the anti-pattern */
  description: string;
  /** Category of the anti-pattern */
  category: AntiPatternCategory;
  /** Severity level */
  severity: Severity;
  /** File path where detected */
  filePath: string;
  /** Line number */
  line: number;
  /** Column number */
  column?: number;
  /** Code snippet showing the issue */
  snippet?: string;
  /** Suggested fix */
  suggestion?: string;
}

/**
 * Quality indicators for code
 */
export interface QualityIndicators {
  /** Type annotation coverage (0-1) */
  typeAnnotationCoverage: number;
  /** Documentation coverage (0-1) */
  documentationCoverage: number;
  /** Test coverage percentage (if available) */
  testCoverage?: number;
  /** Number of detected anti-patterns */
  antiPatternCount: number;
  /** Anti-patterns by severity */
  antiPatternsBySeverity: Record<Severity, number>;
  /** Files missing documentation */
  filesMissingDocumentation: number;
  /** Functions missing documentation */
  functionsMissingDocumentation: number;
}

/**
 * AI-readiness specific indicators
 */
export interface AIReadinessIndicators {
  /** Files over 500 LOC (context window concern) */
  largeFilesCount: number;
  /** Functions over 50 LOC (comprehension limit) */
  largeFunctionsCount: number;
  /** Functions missing type annotations */
  missingTypesCount: number;
  /** Functions missing documentation */
  missingDocumentationCount: number;
  /** Functions missing tests */
  missingTestsCount: number;
  /** Functions with deep nesting (>3 levels) */
  deepNestingCount: number;
  /** Functions with long parameter lists (>5) */
  longParameterListCount: number;
  /** Percentage of code that is AI-friendly (0-1) */
  aiFriendlyRatio: number;
}

/**
 * Score breakdown for AI-readiness
 */
export interface AIReadinessScoreBreakdown {
  /** Structural quality score (0-100) */
  structuralQuality: number;
  /** Complexity score (0-100) */
  complexity: number;
  /** Documentation score (0-100) */
  documentation: number;
  /** Testing score (0-100) */
  testing: number;
  /** Type annotations score (0-100) */
  typeAnnotations: number;
  /** Security score (0-100) */
  security: number;
}

/**
 * Recommendation for improving AI-readiness
 */
export interface AIReadinessRecommendation {
  /** Priority (1 = highest) */
  priority: number;
  /** Category */
  category: AntiPatternCategory;
  /** Title */
  title: string;
  /** Description */
  description: string;
  /** Impact on AI-readiness score (estimated points) */
  impact: number;
  /** Files affected */
  affectedFiles: string[];
  /** Estimated effort (low, medium, high) */
  effort: 'low' | 'medium' | 'high';
}

/**
 * Complete AI-readiness score
 */
export interface AIReadinessScore {
  /** Overall score (0-100) */
  overall: number;
  /** Letter grade */
  grade: AIReadinessGrade;
  /** Score breakdown by category */
  breakdown: AIReadinessScoreBreakdown;
  /** Prioritized recommendations */
  recommendations: AIReadinessRecommendation[];
  /** AI-readiness specific indicators */
  indicators: AIReadinessIndicators;
}

/**
 * Analysis result for a single file
 */
export interface FileAnalysisResult {
  /** Source file info */
  file: SourceFile;
  /** Structural metrics */
  structural: StructuralMetrics;
  /** Function complexity details */
  complexity: FunctionComplexity[];
  /** Detected anti-patterns */
  antiPatterns: AntiPattern[];
  /** Parse errors if any */
  parseErrors: string[];
  /** Analysis duration in milliseconds */
  analysisDuration: number;
}

/**
 * Language breakdown in a repository
 */
export interface LanguageBreakdown {
  /** Language */
  language: SupportedLanguage;
  /** Number of files */
  fileCount: number;
  /** Total lines of code */
  linesOfCode: number;
  /** Percentage of codebase */
  percentage: number;
}

/**
 * Complete repository analysis result
 */
export interface RepositoryAnalysis {
  /** Repository path */
  repositoryPath: string;
  /** Total files analyzed */
  totalFiles: number;
  /** Files by language */
  languageBreakdown: LanguageBreakdown[];
  /** Aggregated structural metrics */
  structural: StructuralMetrics;
  /** Aggregated complexity metrics */
  complexity: ComplexityMetrics;
  /** Quality indicators */
  quality: QualityIndicators;
  /** AI-readiness score */
  aiReadiness: AIReadinessScore;
  /** All detected anti-patterns */
  antiPatterns: AntiPattern[];
  /** Analysis timestamp */
  analyzedAt: Date;
  /** Total analysis duration in milliseconds */
  analysisDuration: number;
}

/**
 * Configuration for the analysis engine
 */
export interface AnalysisConfig {
  /** Include patterns (glob) */
  include?: string[];
  /** Exclude patterns (glob) */
  exclude?: string[];
  /** Maximum file size to analyze (bytes) */
  maxFileSize?: number;
  /** Enable deep analysis (slower but more detailed) */
  deepAnalysis?: boolean;
  /** Enable security scanning */
  securityScan?: boolean;
  /** Parallel file processing */
  parallelProcessing?: boolean;
  /** Maximum concurrent files */
  maxConcurrency?: number;
  /** Complexity thresholds for scoring */
  thresholds?: AnalysisThresholds;
}

/**
 * Configurable thresholds for analysis
 */
export interface AnalysisThresholds {
  /** Max LOC per file before penalty */
  maxFileLOC: number;
  /** Max LOC per function before penalty */
  maxFunctionLOC: number;
  /** Max cyclomatic complexity before penalty */
  maxCyclomaticComplexity: number;
  /** Max nesting depth before penalty */
  maxNestingDepth: number;
  /** Max parameters before penalty */
  maxParameters: number;
}

/**
 * Default analysis thresholds
 */
export const DEFAULT_THRESHOLDS: AnalysisThresholds = {
  maxFileLOC: 500,
  maxFunctionLOC: 50,
  maxCyclomaticComplexity: 10,
  maxNestingDepth: 3,
  maxParameters: 5,
};

/**
 * Default analysis configuration
 */
export const DEFAULT_ANALYSIS_CONFIG: AnalysisConfig = {
  include: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.py', '**/*.java', '**/*.go'],
  exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/vendor/**'],
  maxFileSize: 1024 * 1024, // 1MB
  deepAnalysis: false,
  securityScan: false,
  parallelProcessing: true,
  maxConcurrency: 4,
  thresholds: DEFAULT_THRESHOLDS,
};

/**
 * Scoring weights for AI-readiness calculation
 */
export const SCORING_WEIGHTS = {
  structuralQuality: 0.25,
  complexity: 0.2,
  documentation: 0.2,
  testing: 0.15,
  typeAnnotations: 0.1,
  security: 0.1,
} as const;

/**
 * Analysis progress callback
 */
export type AnalysisProgressCallback = (progress: AnalysisProgress) => void;

/**
 * Analysis progress information
 */
export interface AnalysisProgress {
  /** Current phase */
  phase: 'discovering' | 'parsing' | 'analyzing' | 'scoring' | 'complete';
  /** Files processed so far */
  filesProcessed: number;
  /** Total files to process */
  totalFiles: number;
  /** Current file being processed */
  currentFile?: string;
  /** Percentage complete (0-100) */
  percentage: number;
}

/**
 * Language analyzer capabilities
 */
export interface AnalyzerCapabilities {
  /** Can perform structural analysis */
  structuralAnalysis: boolean;
  /** Can calculate complexity metrics */
  complexityMetrics: boolean;
  /** Can analyze type annotations */
  typeAnalysis: boolean;
  /** Can perform security scanning */
  securityScanning: boolean;
  /** Can check test coverage */
  testCoverage: boolean;
}

/**
 * Language analyzer interface
 */
export interface LanguageAnalyzer {
  /** Supported language */
  language: SupportedLanguage;
  /** Analyzer version */
  version: string;
  /** Supported file extensions */
  fileExtensions: string[];
  /** Available capabilities */
  capabilities: AnalyzerCapabilities;
  /** Analyze source files */
  analyze(files: SourceFile[]): Promise<FileAnalysisResult[]>;
  /** Extract structural metrics from content */
  extractStructuralMetrics(content: string): StructuralMetrics;
  /** Calculate function complexity */
  calculateComplexity(content: string): FunctionComplexity[];
  /** Detect anti-patterns */
  detectAntiPatterns(content: string, filePath: string): AntiPattern[];
}
