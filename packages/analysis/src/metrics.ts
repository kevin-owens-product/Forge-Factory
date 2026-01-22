/**
 * @package @forge/analysis
 * @description Metrics extraction for structural and complexity analysis
 */

import {
  SourceFile,
  StructuralMetrics,
  ComplexityMetrics,
  FunctionComplexity,
  QualityIndicators,
  Severity,
  DEFAULT_THRESHOLDS,
  AnalysisThresholds,
} from './analysis.types.js';
import { calculateFunctionComplexity, ParseResult } from './parser.js';

/**
 * Extract structural metrics from a source file
 */
export function extractStructuralMetrics(
  content: string,
  parseResult?: ParseResult
): StructuralMetrics {
  const lines = content.split('\n');
  const totalLines = lines.length;

  let codeLines = 0;
  let commentLines = 0;
  let blankLines = 0;

  // Analyze each line
  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      blankLines++;
    } else if (isCommentLine(trimmed)) {
      commentLines++;
    } else {
      codeLines++;
    }
  }

  const functionCount = parseResult?.functions.length ?? 0;
  const classCount = parseResult?.classes.length ?? 0;
  const interfaceCount = countInterfaces(content);
  const importCount = parseResult?.imports.length ?? 0;
  const exportCount = parseResult?.exports.length ?? 0;

  // Calculate function sizes
  const functionSizes = parseResult?.functions.map(
    (f) => f.endLine - f.startLine + 1
  ) ?? [];

  const averageFunctionSize =
    functionSizes.length > 0
      ? functionSizes.reduce((a, b) => a + b, 0) / functionSizes.length
      : 0;

  const largestFunctionSize =
    functionSizes.length > 0 ? Math.max(...functionSizes) : 0;

  return {
    totalLines,
    codeLines,
    commentLines,
    blankLines,
    functionCount,
    classCount,
    interfaceCount,
    importCount,
    exportCount,
    averageFunctionSize: Math.round(averageFunctionSize * 10) / 10,
    largestFunctionSize,
    filesOver500LOC: codeLines > 500 ? 1 : 0,
    totalFiles: 1,
    averageFileSize: codeLines,
  };
}

/**
 * Aggregate structural metrics from multiple files
 */
export function aggregateStructuralMetrics(
  metrics: StructuralMetrics[]
): StructuralMetrics {
  if (metrics.length === 0) {
    return createEmptyStructuralMetrics();
  }

  const totalLines = sum(metrics.map((m) => m.totalLines));
  const codeLines = sum(metrics.map((m) => m.codeLines));
  const commentLines = sum(metrics.map((m) => m.commentLines));
  const blankLines = sum(metrics.map((m) => m.blankLines));
  const functionCount = sum(metrics.map((m) => m.functionCount));
  const classCount = sum(metrics.map((m) => m.classCount));
  const interfaceCount = sum(metrics.map((m) => m.interfaceCount));
  const importCount = sum(metrics.map((m) => m.importCount));
  const exportCount = sum(metrics.map((m) => m.exportCount));
  const filesOver500LOC = sum(metrics.map((m) => m.filesOver500LOC));
  const totalFiles = metrics.length;

  // Weighted average for function size
  const totalFunctionSizes = sum(
    metrics.map((m) => m.averageFunctionSize * m.functionCount)
  );
  const averageFunctionSize =
    functionCount > 0 ? totalFunctionSizes / functionCount : 0;

  const largestFunctionSize = Math.max(...metrics.map((m) => m.largestFunctionSize));

  const averageFileSize = codeLines / totalFiles;

  return {
    totalLines,
    codeLines,
    commentLines,
    blankLines,
    functionCount,
    classCount,
    interfaceCount,
    importCount,
    exportCount,
    averageFunctionSize: Math.round(averageFunctionSize * 10) / 10,
    largestFunctionSize,
    filesOver500LOC,
    totalFiles,
    averageFileSize: Math.round(averageFileSize * 10) / 10,
  };
}

/**
 * Calculate complexity metrics for a file
 */
export function calculateComplexityMetrics(
  file: SourceFile,
  parseResult: ParseResult
): ComplexityMetrics {
  const functions: FunctionComplexity[] = parseResult.functions.map((func) =>
    calculateFunctionComplexity(func, file.path)
  );

  return aggregateComplexityMetrics(functions);
}

/**
 * Aggregate complexity metrics from functions
 */
export function aggregateComplexityMetrics(
  functions: FunctionComplexity[]
): ComplexityMetrics {
  if (functions.length === 0) {
    return createEmptyComplexityMetrics();
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
    functions,
  };
}

/**
 * Merge complexity metrics from multiple files
 */
export function mergeComplexityMetrics(
  metricsArray: ComplexityMetrics[]
): ComplexityMetrics {
  const allFunctions = metricsArray.flatMap((m) => m.functions);
  return aggregateComplexityMetrics(allFunctions);
}

/**
 * Calculate quality indicators
 */
export function calculateQualityIndicators(
  files: SourceFile[],
  parseResults: Map<string, ParseResult>,
  antiPatternCount: number,
  antiPatternsBySeverity: Record<Severity, number>,
  _thresholds: AnalysisThresholds = DEFAULT_THRESHOLDS
): QualityIndicators {
  let totalFunctions = 0;
  let functionsWithTypes = 0;
  let functionsWithDocs = 0;
  let filesMissingDocumentation = 0;
  let functionsMissingDocumentation = 0;

  for (const file of files) {
    const parseResult = parseResults.get(file.path);
    if (!parseResult) continue;

    // Check if file has any documentation
    if (parseResult.comments.length === 0) {
      filesMissingDocumentation++;
    }

    for (const func of parseResult.functions) {
      totalFunctions++;

      if (func.hasTypeAnnotations) {
        functionsWithTypes++;
      }

      if (func.hasDocumentation) {
        functionsWithDocs++;
      } else {
        functionsMissingDocumentation++;
      }
    }
  }

  const typeAnnotationCoverage =
    totalFunctions > 0 ? functionsWithTypes / totalFunctions : 1;

  const documentationCoverage =
    totalFunctions > 0 ? functionsWithDocs / totalFunctions : 1;

  return {
    typeAnnotationCoverage: Math.round(typeAnnotationCoverage * 100) / 100,
    documentationCoverage: Math.round(documentationCoverage * 100) / 100,
    antiPatternCount,
    antiPatternsBySeverity,
    filesMissingDocumentation,
    functionsMissingDocumentation,
  };
}

/**
 * Check if a line is a comment
 */
function isCommentLine(trimmedLine: string): boolean {
  return (
    trimmedLine.startsWith('//') ||
    trimmedLine.startsWith('#') ||
    trimmedLine.startsWith('/*') ||
    trimmedLine.startsWith('*') ||
    trimmedLine.startsWith('*/') ||
    trimmedLine.startsWith('"""') ||
    trimmedLine.startsWith("'''")
  );
}

/**
 * Count interfaces (TypeScript/Java specific)
 */
function countInterfaces(content: string): number {
  const matches = content.match(/\binterface\s+\w+/g);
  return matches ? matches.length : 0;
}

/**
 * Create empty structural metrics
 */
function createEmptyStructuralMetrics(): StructuralMetrics {
  return {
    totalLines: 0,
    codeLines: 0,
    commentLines: 0,
    blankLines: 0,
    functionCount: 0,
    classCount: 0,
    interfaceCount: 0,
    importCount: 0,
    exportCount: 0,
    averageFunctionSize: 0,
    largestFunctionSize: 0,
    filesOver500LOC: 0,
    totalFiles: 0,
    averageFileSize: 0,
  };
}

/**
 * Create empty complexity metrics
 */
function createEmptyComplexityMetrics(): ComplexityMetrics {
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
    functions: [],
  };
}

/**
 * Sum helper
 */
function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/**
 * Calculate comment density ratio
 */
export function calculateCommentDensity(metrics: StructuralMetrics): number {
  const totalNonBlank = metrics.codeLines + metrics.commentLines;
  if (totalNonBlank === 0) return 0;
  return Math.round((metrics.commentLines / totalNonBlank) * 100) / 100;
}

/**
 * Get complexity grade for a function
 */
export function getComplexityGrade(
  cyclomaticComplexity: number
): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (cyclomaticComplexity <= 5) return 'A';
  if (cyclomaticComplexity <= 10) return 'B';
  if (cyclomaticComplexity <= 20) return 'C';
  if (cyclomaticComplexity <= 50) return 'D';
  return 'F';
}

/**
 * Find the most complex functions
 */
export function findMostComplexFunctions(
  complexity: ComplexityMetrics,
  limit: number = 10
): FunctionComplexity[] {
  return [...complexity.functions]
    .sort((a, b) => b.cyclomaticComplexity - a.cyclomaticComplexity)
    .slice(0, limit);
}

/**
 * Find functions that need attention
 */
export function findFunctionsNeedingAttention(
  complexity: ComplexityMetrics,
  thresholds: AnalysisThresholds = DEFAULT_THRESHOLDS
): FunctionComplexity[] {
  return complexity.functions.filter(
    (f) =>
      f.cyclomaticComplexity > thresholds.maxCyclomaticComplexity ||
      f.nestingDepth > thresholds.maxNestingDepth ||
      f.parameterCount > thresholds.maxParameters ||
      f.linesOfCode > thresholds.maxFunctionLOC
  );
}
