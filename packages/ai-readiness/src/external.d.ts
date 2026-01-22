/**
 * External module declarations for @forge/ai-readiness
 */

declare module '@forge/analysis' {
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

  export type LanguageTier = 'primary' | 'secondary' | 'legacy' | 'unknown';
  export type Severity = 'low' | 'medium' | 'high' | 'critical';
  export type AIReadinessGrade = 'A' | 'B' | 'C' | 'D' | 'F';
  export type AntiPatternCategory =
    | 'complexity'
    | 'maintainability'
    | 'documentation'
    | 'naming'
    | 'structure'
    | 'testing'
    | 'security';

  export interface SourceFile {
    path: string;
    content: string;
    language: SupportedLanguage;
    extension: string;
    size: number;
  }

  export interface StructuralMetrics {
    totalLines: number;
    codeLines: number;
    commentLines: number;
    blankLines: number;
    functionCount: number;
    classCount: number;
    interfaceCount: number;
    importCount: number;
    exportCount: number;
    averageFunctionSize: number;
    largestFunctionSize: number;
    filesOver500LOC: number;
    totalFiles: number;
    averageFileSize: number;
  }

  export interface FunctionComplexity {
    name: string;
    filePath: string;
    startLine: number;
    endLine: number;
    linesOfCode: number;
    cyclomaticComplexity: number;
    cognitiveComplexity: number;
    nestingDepth: number;
    parameterCount: number;
  }

  export interface ComplexityMetrics {
    averageCyclomaticComplexity: number;
    maxCyclomaticComplexity: number;
    functionsOverComplexity10: number;
    averageCognitiveComplexity: number;
    averageNestingDepth: number;
    maxNestingDepth: number;
    functionsWithDeepNesting: number;
    averageParameterCount: number;
    functionsWithManyParameters: number;
    functions: FunctionComplexity[];
  }

  export interface AntiPattern {
    id: string;
    name: string;
    description: string;
    category: AntiPatternCategory;
    severity: Severity;
    filePath: string;
    line: number;
    column?: number;
    snippet?: string;
    suggestion?: string;
  }

  export interface QualityIndicators {
    typeAnnotationCoverage: number;
    documentationCoverage: number;
    testCoverage?: number;
    antiPatternCount: number;
    antiPatternsBySeverity: Record<Severity, number>;
    filesMissingDocumentation: number;
    functionsMissingDocumentation: number;
  }

  export interface AIReadinessIndicators {
    largeFilesCount: number;
    largeFunctionsCount: number;
    missingTypesCount: number;
    missingDocumentationCount: number;
    missingTestsCount: number;
    deepNestingCount: number;
    longParameterListCount: number;
    aiFriendlyRatio: number;
  }

  export interface AIReadinessScoreBreakdown {
    structuralQuality: number;
    complexity: number;
    documentation: number;
    testing: number;
    typeAnnotations: number;
    security: number;
  }

  export interface AIReadinessRecommendation {
    priority: number;
    category: AntiPatternCategory;
    title: string;
    description: string;
    impact: number;
    affectedFiles: string[];
    effort: 'low' | 'medium' | 'high';
  }

  export interface AIReadinessScore {
    overall: number;
    grade: AIReadinessGrade;
    breakdown: AIReadinessScoreBreakdown;
    recommendations: AIReadinessRecommendation[];
    indicators: AIReadinessIndicators;
  }

  export interface FileAnalysisResult {
    file: SourceFile;
    structural: StructuralMetrics;
    complexity: FunctionComplexity[];
    antiPatterns: AntiPattern[];
    parseErrors: string[];
    analysisDuration: number;
  }

  export interface LanguageBreakdown {
    language: SupportedLanguage;
    fileCount: number;
    linesOfCode: number;
    percentage: number;
  }

  export interface RepositoryAnalysis {
    repositoryPath: string;
    totalFiles: number;
    languageBreakdown: LanguageBreakdown[];
    structural: StructuralMetrics;
    complexity: ComplexityMetrics;
    quality: QualityIndicators;
    aiReadiness: AIReadinessScore;
    antiPatterns: AntiPattern[];
    analyzedAt: Date;
    analysisDuration: number;
  }

  export interface AnalysisConfig {
    include?: string[];
    exclude?: string[];
    maxFileSize?: number;
    deepAnalysis?: boolean;
    securityScan?: boolean;
    parallelProcessing?: boolean;
    maxConcurrency?: number;
    thresholds?: AnalysisThresholds;
  }

  export interface AnalysisThresholds {
    maxFileLOC: number;
    maxFunctionLOC: number;
    maxCyclomaticComplexity: number;
    maxNestingDepth: number;
    maxParameters: number;
  }

  export interface AnalysisProgress {
    phase: 'discovering' | 'parsing' | 'analyzing' | 'scoring' | 'complete';
    filesProcessed: number;
    totalFiles: number;
    currentFile?: string;
    percentage: number;
  }

  export type AnalysisProgressCallback = (progress: AnalysisProgress) => void;

  export const DEFAULT_THRESHOLDS: AnalysisThresholds;
  export const DEFAULT_ANALYSIS_CONFIG: AnalysisConfig;
  export const SCORING_WEIGHTS: {
    structuralQuality: number;
    complexity: number;
    documentation: number;
    testing: number;
    typeAnnotations: number;
    security: number;
  };

  export class AnalysisService {
    analyzeRepository(
      repoPath: string,
      config?: AnalysisConfig,
      onProgress?: AnalysisProgressCallback
    ): Promise<RepositoryAnalysis>;
    analyzeFile(filePath: string): Promise<FileAnalysisResult>;
    analyzeFiles(filePaths: string[]): Promise<FileAnalysisResult[]>;
  }

  export function getAnalysisService(): AnalysisService;
  export function resetAnalysisService(): void;
  export function analyzeFile(filePath: string): Promise<FileAnalysisResult>;
  export function analyzeFiles(filePaths: string[]): Promise<FileAnalysisResult[]>;
  export function analyzeRepository(
    repoPath: string,
    config?: AnalysisConfig,
    onProgress?: AnalysisProgressCallback
  ): Promise<RepositoryAnalysis>;

  export function detectLanguage(filePath: string): SupportedLanguage;
  export function getLanguageTier(language: SupportedLanguage): LanguageTier;
  export function isLanguageSupported(language: string): boolean;
  export function calculateGrade(score: number): AIReadinessGrade;
  export function getGradeDescription(grade: AIReadinessGrade): string;
}

declare module '@forge/errors' {
  export class ForgeError extends Error {
    code: string;
    statusCode: number;
    constructor(message: string, code?: string, statusCode?: number);
  }

  export class ValidationError extends ForgeError {
    constructor(message: string);
  }

  export class NotFoundError extends ForgeError {
    constructor(message: string);
  }

  export class ConfigurationError extends ForgeError {
    constructor(message: string);
  }
}
