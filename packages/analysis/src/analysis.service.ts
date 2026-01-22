/**
 * @package @forge/analysis
 * @description Main analysis service orchestrator
 */

import {
  RepositoryAnalysis,
  FileAnalysisResult,
  AnalysisConfig,
  AnalysisProgressCallback,
  LanguageBreakdown,
  DEFAULT_ANALYSIS_CONFIG,
  DEFAULT_THRESHOLDS,
} from './analysis.types.js';
import {
  createSourceFile,
  getLanguageStatistics,
  shouldIncludeFile,
  isTestFile,
  isConfigFile,
  isGeneratedFile,
} from './language.js';
import { parseSourceCode, ParseResult } from './parser.js';
import {
  extractStructuralMetrics,
  aggregateStructuralMetrics,
  mergeComplexityMetrics,
  calculateQualityIndicators,
} from './metrics.js';
import {
  detectAntiPatterns,
  detectComplexityAntiPatterns,
  countBySeverity,
} from './antipatterns.js';
import { calculateAIReadinessScore } from './scoring.js';

/**
 * Analysis service instance
 */
let analysisServiceInstance: AnalysisService | null = null;

/**
 * Main analysis service for code analysis
 */
export class AnalysisService {
  private config: AnalysisConfig;

  constructor(config: Partial<AnalysisConfig> = {}) {
    this.config = { ...DEFAULT_ANALYSIS_CONFIG, ...config };
  }

  /**
   * Analyze a single file
   */
  async analyzeFile(
    path: string,
    content: string
  ): Promise<FileAnalysisResult> {
    const startTime = Date.now();
    const file = createSourceFile(path, content);

    // Parse the file
    const parseResult = parseSourceCode(content, file.language);

    // Extract structural metrics
    const structural = extractStructuralMetrics(content, parseResult);

    // Calculate complexity for all functions
    const complexity = parseResult.functions.map((func) => {
      const lines = func.endLine - func.startLine + 1;
      // Re-parse function body for complexity
      let cyclomaticComplexity = 1;
      let cognitiveComplexity = 0;
      let nestingDepth = 0;

      if (func.body) {
        cyclomaticComplexity = calculateBasicComplexity(func.body);
        cognitiveComplexity = calculateCognitiveFromBody(func.body);
        nestingDepth = calculateNestingFromBody(func.body);
      }

      return {
        name: func.name,
        filePath: path,
        startLine: func.startLine,
        endLine: func.endLine,
        linesOfCode: lines,
        cyclomaticComplexity,
        cognitiveComplexity,
        nestingDepth,
        parameterCount: func.params.length,
      };
    });

    // Detect anti-patterns
    const antiPatterns = detectAntiPatterns(file, parseResult);

    return {
      file,
      structural,
      complexity,
      antiPatterns,
      parseErrors: parseResult.errors,
      analysisDuration: Date.now() - startTime,
    };
  }

  /**
   * Analyze multiple files
   */
  async analyzeFiles(
    files: { path: string; content: string }[],
    onProgress?: AnalysisProgressCallback
  ): Promise<FileAnalysisResult[]> {
    const results: FileAnalysisResult[] = [];
    const totalFiles = files.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;

      if (onProgress) {
        onProgress({
          phase: 'analyzing',
          filesProcessed: i,
          totalFiles,
          currentFile: file.path,
          percentage: Math.round((i / totalFiles) * 100),
        });
      }

      // Skip files that are too large
      if (
        this.config.maxFileSize &&
        Buffer.byteLength(file.content, 'utf8') > this.config.maxFileSize
      ) {
        continue;
      }

      // Skip test/config/generated files if not in deep analysis mode
      if (!this.config.deepAnalysis) {
        if (isTestFile(file.path) || isConfigFile(file.path) || isGeneratedFile(file.path)) {
          continue;
        }
      }

      const result = await this.analyzeFile(file.path, file.content);
      results.push(result);
    }

    if (onProgress) {
      onProgress({
        phase: 'complete',
        filesProcessed: totalFiles,
        totalFiles,
        percentage: 100,
      });
    }

    return results;
  }

  /**
   * Analyze a repository from file list
   */
  async analyzeRepository(
    repositoryPath: string,
    files: { path: string; content: string }[],
    onProgress?: AnalysisProgressCallback
  ): Promise<RepositoryAnalysis> {
    const startTime = Date.now();

    if (onProgress) {
      onProgress({
        phase: 'discovering',
        filesProcessed: 0,
        totalFiles: files.length,
        percentage: 0,
      });
    }

    // Filter files based on include/exclude patterns
    const filteredFiles = files.filter((f) =>
      shouldIncludeFile(
        f.path,
        this.config.include ?? [],
        this.config.exclude ?? []
      )
    );

    // Analyze all files
    const fileResults = await this.analyzeFiles(filteredFiles, onProgress);

    // Aggregate results
    return this.aggregateResults(repositoryPath, fileResults, startTime);
  }

  /**
   * Aggregate file results into repository analysis
   */
  private aggregateResults(
    repositoryPath: string,
    fileResults: FileAnalysisResult[],
    startTime: number
  ): RepositoryAnalysis {
    // Create source files array for grouping
    const sourceFiles = fileResults.map((r) => r.file);

    // Calculate language breakdown
    const langStats = getLanguageStatistics(sourceFiles);
    const totalLOC = fileResults.reduce(
      (sum, r) => sum + r.structural.codeLines,
      0
    );

    const languageBreakdown: LanguageBreakdown[] = langStats.map((stat) => ({
      language: stat.language,
      fileCount: stat.count,
      linesOfCode: fileResults
        .filter((r) => r.file.language === stat.language)
        .reduce((sum, r) => sum + r.structural.codeLines, 0),
      percentage:
        totalLOC > 0
          ? Math.round(
              (fileResults
                .filter((r) => r.file.language === stat.language)
                .reduce((sum, r) => sum + r.structural.codeLines, 0) /
                totalLOC) *
                100
            )
          : 0,
    }));

    // Aggregate structural metrics
    const structuralMetrics = fileResults.map((r) => r.structural);
    const structural = aggregateStructuralMetrics(structuralMetrics);

    // Aggregate complexity metrics
    const complexityMetrics = fileResults.map((r) => ({
      ...calculateComplexityMetricsFromFunctions(r.complexity),
      functions: r.complexity,
    }));
    const complexity = mergeComplexityMetrics(complexityMetrics);

    // Collect all anti-patterns
    const antiPatterns = fileResults.flatMap((r) => r.antiPatterns);

    // Add complexity-based anti-patterns
    const complexityAntiPatterns = detectComplexityAntiPatterns(
      complexity.functions,
      this.config.thresholds ?? DEFAULT_THRESHOLDS
    );
    const allAntiPatterns = [...antiPatterns, ...complexityAntiPatterns];

    // Calculate anti-pattern counts
    const antiPatternsBySeverity = countBySeverity(allAntiPatterns);

    // Build parse results map for quality calculation
    const parseResults = new Map<string, ParseResult>();
    for (const result of fileResults) {
      // Recreate parse result from file analysis
      const parseResult = parseSourceCode(result.file.content, result.file.language);
      parseResults.set(result.file.path, parseResult);
    }

    // Calculate quality indicators
    const quality = calculateQualityIndicators(
      sourceFiles,
      parseResults,
      allAntiPatterns.length,
      antiPatternsBySeverity,
      this.config.thresholds ?? DEFAULT_THRESHOLDS
    );

    // Calculate AI-readiness score
    const aiReadiness = calculateAIReadinessScore(
      structural,
      complexity,
      quality,
      allAntiPatterns,
      this.config.thresholds ?? DEFAULT_THRESHOLDS
    );

    return {
      repositoryPath,
      totalFiles: fileResults.length,
      languageBreakdown,
      structural,
      complexity,
      quality,
      aiReadiness,
      antiPatterns: allAntiPatterns,
      analyzedAt: new Date(),
      analysisDuration: Date.now() - startTime,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AnalysisConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): AnalysisConfig {
    return { ...this.config };
  }
}

/**
 * Get or create analysis service instance
 */
export function getAnalysisService(
  config?: Partial<AnalysisConfig>
): AnalysisService {
  if (!analysisServiceInstance) {
    analysisServiceInstance = new AnalysisService(config);
  } else if (config) {
    analysisServiceInstance.updateConfig(config);
  }
  return analysisServiceInstance;
}

/**
 * Reset analysis service instance
 */
export function resetAnalysisService(): void {
  analysisServiceInstance = null;
}

/**
 * Analyze a single file (convenience function)
 */
export async function analyzeFile(
  path: string,
  content: string,
  config?: Partial<AnalysisConfig>
): Promise<FileAnalysisResult> {
  const service = new AnalysisService(config);
  return service.analyzeFile(path, content);
}

/**
 * Analyze multiple files (convenience function)
 */
export async function analyzeFiles(
  files: { path: string; content: string }[],
  config?: Partial<AnalysisConfig>,
  onProgress?: AnalysisProgressCallback
): Promise<FileAnalysisResult[]> {
  const service = new AnalysisService(config);
  return service.analyzeFiles(files, onProgress);
}

/**
 * Analyze a repository (convenience function)
 */
export async function analyzeRepository(
  repositoryPath: string,
  files: { path: string; content: string }[],
  config?: Partial<AnalysisConfig>,
  onProgress?: AnalysisProgressCallback
): Promise<RepositoryAnalysis> {
  const service = new AnalysisService(config);
  return service.analyzeRepository(repositoryPath, files, onProgress);
}

/**
 * Helper: Calculate complexity metrics from function list
 */
function calculateComplexityMetricsFromFunctions(
  functions: FileAnalysisResult['complexity']
): {
  averageCyclomaticComplexity: number;
  maxCyclomaticComplexity: number;
  functionsOverComplexity10: number;
  averageCognitiveComplexity: number;
  averageNestingDepth: number;
  maxNestingDepth: number;
  functionsWithDeepNesting: number;
  averageParameterCount: number;
  functionsWithManyParameters: number;
} {
  if (functions.length === 0) {
    return {
      averageCyclomaticComplexity: 0,
      maxCyclomaticComplexity: 0,
      functionsOverComplexity10: 0,
      averageCognitiveComplexity: 0,
      averageNestingDepth: 0,
      maxNestingDepth: 0,
      functionsWithDeepNesting: 0,
      averageParameterCount: 0,
      functionsWithManyParameters: 0,
    };
  }

  const cyclomaticValues = functions.map((f) => f.cyclomaticComplexity);
  const cognitiveValues = functions.map((f) => f.cognitiveComplexity);
  const nestingValues = functions.map((f) => f.nestingDepth);
  const paramValues = functions.map((f) => f.parameterCount);

  return {
    averageCyclomaticComplexity:
      Math.round((sum(cyclomaticValues) / functions.length) * 10) / 10,
    maxCyclomaticComplexity: Math.max(...cyclomaticValues),
    functionsOverComplexity10: cyclomaticValues.filter((v) => v > 10).length,
    averageCognitiveComplexity:
      Math.round((sum(cognitiveValues) / functions.length) * 10) / 10,
    averageNestingDepth:
      Math.round((sum(nestingValues) / functions.length) * 10) / 10,
    maxNestingDepth: Math.max(...nestingValues),
    functionsWithDeepNesting: nestingValues.filter((v) => v > 3).length,
    averageParameterCount:
      Math.round((sum(paramValues) / functions.length) * 10) / 10,
    functionsWithManyParameters: paramValues.filter((v) => v > 5).length,
  };
}

/**
 * Helper: Calculate basic cyclomatic complexity
 */
function calculateBasicComplexity(body: string): number {
  let complexity = 1;

  const patterns = [
    /\bif\b/g,
    /\belse\s+if\b/g,
    /\bwhile\b/g,
    /\bfor\b/g,
    /\bcase\b/g,
    /\bcatch\b/g,
    /\?\s*[^:]/g,
    /&&/g,
    /\|\|/g,
    /\?\?/g,
  ];

  for (const pattern of patterns) {
    const matches = body.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  }

  return complexity;
}

/**
 * Helper: Calculate cognitive complexity from body
 */
function calculateCognitiveFromBody(body: string): number {
  let complexity = 0;
  let nestingLevel = 0;

  const lines = body.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    if (/\b(if|else\s+if|switch|for|while|catch)\b/.test(trimmed)) {
      complexity += 1 + nestingLevel;
    }

    if (/\b(else|else\s+if)\b/.test(trimmed)) {
      complexity += 1;
    }

    const logicalOps = (trimmed.match(/&&|\|\|/g) ?? []).length;
    complexity += logicalOps;

    const opens = (line.match(/\{/g) ?? []).length;
    const closes = (line.match(/\}/g) ?? []).length;
    nestingLevel += opens - closes;
    nestingLevel = Math.max(0, nestingLevel);
  }

  return complexity;
}

/**
 * Helper: Calculate nesting depth from body
 */
function calculateNestingFromBody(body: string): number {
  let maxDepth = 0;
  let currentDepth = 0;

  for (const char of body) {
    if (char === '{') {
      currentDepth++;
      maxDepth = Math.max(maxDepth, currentDepth);
    } else if (char === '}') {
      currentDepth--;
    }
  }

  return maxDepth;
}

/**
 * Helper: Sum array values
 */
function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
