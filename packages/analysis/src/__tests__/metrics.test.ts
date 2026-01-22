/**
 * @package @forge/analysis
 * @description Tests for metrics extraction
 */

import { describe, it, expect } from 'vitest';
import {
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
} from '../metrics.js';
import { parseSourceCode, ParseResult } from '../parser.js';
import { createSourceFile } from '../language.js';
import { FunctionComplexity, StructuralMetrics, Severity } from '../analysis.types.js';

describe('metrics', () => {
  describe('extractStructuralMetrics', () => {
    it('should count total lines', () => {
      const content = `line1
line2
line3`;
      const result = extractStructuralMetrics(content);

      expect(result.totalLines).toBe(3);
    });

    it('should count code lines', () => {
      const content = `const x = 1;
const y = 2;
// comment
const z = 3;`;
      const result = extractStructuralMetrics(content);

      expect(result.codeLines).toBe(3);
    });

    it('should count comment lines', () => {
      const content = `// comment 1
const x = 1;
// comment 2
/* block comment */
const y = 2;`;
      const result = extractStructuralMetrics(content);

      expect(result.commentLines).toBe(3);
    });

    it('should count blank lines', () => {
      const content = `const x = 1;

const y = 2;

const z = 3;`;
      const result = extractStructuralMetrics(content);

      expect(result.blankLines).toBe(2);
    });

    it('should count functions from parse result', () => {
      const content = `
function a() {}
function b() {}
const c = () => {};
      `;
      const parseResult = parseSourceCode(content, 'typescript');
      const result = extractStructuralMetrics(content, parseResult);

      expect(result.functionCount).toBeGreaterThanOrEqual(2);
    });

    it('should count classes from parse result', () => {
      const content = `
class A {}
class B extends A {}
      `;
      const parseResult = parseSourceCode(content, 'typescript');
      const result = extractStructuralMetrics(content, parseResult);

      expect(result.classCount).toBe(2);
    });

    it('should count interfaces', () => {
      const content = `
interface User {}
interface Config {}
interface Options {}
      `;
      const result = extractStructuralMetrics(content);

      expect(result.interfaceCount).toBe(3);
    });

    it('should count imports from parse result', () => {
      const content = `
import { a } from 'a';
import b from 'b';
import * as c from 'c';
      `;
      const parseResult = parseSourceCode(content, 'typescript');
      const result = extractStructuralMetrics(content, parseResult);

      expect(result.importCount).toBe(3);
    });

    it('should detect files over 500 LOC', () => {
      const lines = new Array(600).fill('const x = 1;').join('\n');
      const result = extractStructuralMetrics(lines);

      expect(result.filesOver500LOC).toBe(1);
    });

    it('should not flag small files', () => {
      const content = 'const x = 1;';
      const result = extractStructuralMetrics(content);

      expect(result.filesOver500LOC).toBe(0);
    });
  });

  describe('aggregateStructuralMetrics', () => {
    it('should aggregate multiple metrics', () => {
      const metrics: StructuralMetrics[] = [
        {
          totalLines: 100,
          codeLines: 80,
          commentLines: 10,
          blankLines: 10,
          functionCount: 5,
          classCount: 1,
          interfaceCount: 2,
          importCount: 3,
          exportCount: 2,
          averageFunctionSize: 10,
          largestFunctionSize: 20,
          filesOver500LOC: 0,
          totalFiles: 1,
          averageFileSize: 80,
        },
        {
          totalLines: 200,
          codeLines: 150,
          commentLines: 30,
          blankLines: 20,
          functionCount: 10,
          classCount: 2,
          interfaceCount: 3,
          importCount: 5,
          exportCount: 4,
          averageFunctionSize: 15,
          largestFunctionSize: 50,
          filesOver500LOC: 0,
          totalFiles: 1,
          averageFileSize: 150,
        },
      ];

      const result = aggregateStructuralMetrics(metrics);

      expect(result.totalLines).toBe(300);
      expect(result.codeLines).toBe(230);
      expect(result.commentLines).toBe(40);
      expect(result.blankLines).toBe(30);
      expect(result.functionCount).toBe(15);
      expect(result.classCount).toBe(3);
      expect(result.totalFiles).toBe(2);
      expect(result.largestFunctionSize).toBe(50);
    });

    it('should handle empty array', () => {
      const result = aggregateStructuralMetrics([]);

      expect(result.totalLines).toBe(0);
      expect(result.functionCount).toBe(0);
      expect(result.totalFiles).toBe(0);
    });
  });

  describe('aggregateComplexityMetrics', () => {
    it('should aggregate function complexities', () => {
      const functions: FunctionComplexity[] = [
        {
          name: 'func1',
          filePath: 'a.ts',
          startLine: 1,
          endLine: 10,
          linesOfCode: 10,
          cyclomaticComplexity: 5,
          cognitiveComplexity: 3,
          nestingDepth: 2,
          parameterCount: 2,
        },
        {
          name: 'func2',
          filePath: 'a.ts',
          startLine: 12,
          endLine: 30,
          linesOfCode: 19,
          cyclomaticComplexity: 15,
          cognitiveComplexity: 10,
          nestingDepth: 4,
          parameterCount: 6,
        },
      ];

      const result = aggregateComplexityMetrics(functions);

      expect(result.averageCyclomaticComplexity).toBe(10);
      expect(result.maxCyclomaticComplexity).toBe(15);
      expect(result.functionsOverComplexity10).toBe(1);
      expect(result.maxNestingDepth).toBe(4);
      expect(result.functionsWithDeepNesting).toBe(1);
      expect(result.functionsWithManyParameters).toBe(1);
    });

    it('should handle empty functions', () => {
      const result = aggregateComplexityMetrics([]);

      expect(result.averageCyclomaticComplexity).toBe(0);
      expect(result.maxCyclomaticComplexity).toBe(0);
      expect(result.functions).toHaveLength(0);
    });
  });

  describe('mergeComplexityMetrics', () => {
    it('should merge metrics from multiple files', () => {
      const metrics1 = aggregateComplexityMetrics([
        {
          name: 'func1',
          filePath: 'a.ts',
          startLine: 1,
          endLine: 10,
          linesOfCode: 10,
          cyclomaticComplexity: 5,
          cognitiveComplexity: 3,
          nestingDepth: 2,
          parameterCount: 2,
        },
      ]);

      const metrics2 = aggregateComplexityMetrics([
        {
          name: 'func2',
          filePath: 'b.ts',
          startLine: 1,
          endLine: 20,
          linesOfCode: 20,
          cyclomaticComplexity: 12,
          cognitiveComplexity: 8,
          nestingDepth: 5,
          parameterCount: 4,
        },
      ]);

      const result = mergeComplexityMetrics([metrics1, metrics2]);

      expect(result.functions).toHaveLength(2);
      expect(result.maxCyclomaticComplexity).toBe(12);
      expect(result.maxNestingDepth).toBe(5);
    });
  });

  describe('calculateQualityIndicators', () => {
    it('should calculate quality indicators', () => {
      const file = createSourceFile('test.ts', `
/**
 * Documented function
 */
function documented(x: number): number {
  return x * 2;
}

function undocumented(y) {
  return y + 1;
}
      `);

      const parseResult = parseSourceCode(file.content, file.language);
      const parseResults = new Map<string, ParseResult>();
      parseResults.set(file.path, parseResult);

      const antiPatternsBySeverity: Record<Severity, number> = {
        critical: 0,
        high: 0,
        medium: 1,
        low: 2,
      };

      const result = calculateQualityIndicators(
        [file],
        parseResults,
        3,
        antiPatternsBySeverity
      );

      expect(result.antiPatternCount).toBe(3);
      expect(result.antiPatternsBySeverity.low).toBe(2);
      expect(result.typeAnnotationCoverage).toBeGreaterThanOrEqual(0);
      expect(result.typeAnnotationCoverage).toBeLessThanOrEqual(1);
    });

    it('should handle files without comments', () => {
      const file = createSourceFile('test.ts', `
function a() {}
function b() {}
      `);

      const parseResult = parseSourceCode(file.content, file.language);
      const parseResults = new Map<string, ParseResult>();
      parseResults.set(file.path, parseResult);

      const result = calculateQualityIndicators(
        [file],
        parseResults,
        0,
        { critical: 0, high: 0, medium: 0, low: 0 }
      );

      expect(result.filesMissingDocumentation).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateCommentDensity', () => {
    it('should calculate comment density ratio', () => {
      const metrics: StructuralMetrics = {
        totalLines: 100,
        codeLines: 80,
        commentLines: 20,
        blankLines: 0,
        functionCount: 5,
        classCount: 1,
        interfaceCount: 0,
        importCount: 2,
        exportCount: 2,
        averageFunctionSize: 10,
        largestFunctionSize: 20,
        filesOver500LOC: 0,
        totalFiles: 1,
        averageFileSize: 80,
      };

      const density = calculateCommentDensity(metrics);

      expect(density).toBe(0.2); // 20 / 100
    });

    it('should handle zero lines', () => {
      const metrics: StructuralMetrics = {
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

      const density = calculateCommentDensity(metrics);

      expect(density).toBe(0);
    });
  });

  describe('getComplexityGrade', () => {
    it('should return A for low complexity', () => {
      expect(getComplexityGrade(1)).toBe('A');
      expect(getComplexityGrade(5)).toBe('A');
    });

    it('should return B for medium complexity', () => {
      expect(getComplexityGrade(6)).toBe('B');
      expect(getComplexityGrade(10)).toBe('B');
    });

    it('should return C for high complexity', () => {
      expect(getComplexityGrade(11)).toBe('C');
      expect(getComplexityGrade(20)).toBe('C');
    });

    it('should return D for very high complexity', () => {
      expect(getComplexityGrade(21)).toBe('D');
      expect(getComplexityGrade(50)).toBe('D');
    });

    it('should return F for extreme complexity', () => {
      expect(getComplexityGrade(51)).toBe('F');
      expect(getComplexityGrade(100)).toBe('F');
    });
  });

  describe('findMostComplexFunctions', () => {
    it('should find most complex functions', () => {
      const functions: FunctionComplexity[] = [
        { name: 'simple', filePath: 'a.ts', startLine: 1, endLine: 5, linesOfCode: 5, cyclomaticComplexity: 2, cognitiveComplexity: 1, nestingDepth: 1, parameterCount: 1 },
        { name: 'complex', filePath: 'a.ts', startLine: 10, endLine: 50, linesOfCode: 41, cyclomaticComplexity: 20, cognitiveComplexity: 15, nestingDepth: 4, parameterCount: 5 },
        { name: 'medium', filePath: 'a.ts', startLine: 60, endLine: 80, linesOfCode: 21, cyclomaticComplexity: 8, cognitiveComplexity: 5, nestingDepth: 2, parameterCount: 3 },
      ];

      const metrics = aggregateComplexityMetrics(functions);
      const result = findMostComplexFunctions(metrics, 2);

      expect(result).toHaveLength(2);
      expect(result[0]?.name).toBe('complex');
      expect(result[1]?.name).toBe('medium');
    });

    it('should respect limit', () => {
      const functions: FunctionComplexity[] = new Array(20).fill(null).map((_, i) => ({
        name: `func${i}`,
        filePath: 'a.ts',
        startLine: i * 10,
        endLine: i * 10 + 5,
        linesOfCode: 5,
        cyclomaticComplexity: i + 1,
        cognitiveComplexity: i,
        nestingDepth: 1,
        parameterCount: 1,
      }));

      const metrics = aggregateComplexityMetrics(functions);
      const result = findMostComplexFunctions(metrics, 5);

      expect(result).toHaveLength(5);
    });
  });

  describe('findFunctionsNeedingAttention', () => {
    it('should find functions exceeding thresholds', () => {
      const functions: FunctionComplexity[] = [
        { name: 'ok', filePath: 'a.ts', startLine: 1, endLine: 5, linesOfCode: 5, cyclomaticComplexity: 5, cognitiveComplexity: 3, nestingDepth: 2, parameterCount: 3 },
        { name: 'highComplexity', filePath: 'a.ts', startLine: 10, endLine: 20, linesOfCode: 11, cyclomaticComplexity: 15, cognitiveComplexity: 10, nestingDepth: 2, parameterCount: 3 },
        { name: 'deepNesting', filePath: 'a.ts', startLine: 30, endLine: 40, linesOfCode: 11, cyclomaticComplexity: 5, cognitiveComplexity: 8, nestingDepth: 5, parameterCount: 2 },
        { name: 'tooManyParams', filePath: 'a.ts', startLine: 50, endLine: 55, linesOfCode: 6, cyclomaticComplexity: 3, cognitiveComplexity: 2, nestingDepth: 1, parameterCount: 8 },
        { name: 'tooLong', filePath: 'a.ts', startLine: 60, endLine: 130, linesOfCode: 71, cyclomaticComplexity: 8, cognitiveComplexity: 6, nestingDepth: 2, parameterCount: 2 },
      ];

      const metrics = aggregateComplexityMetrics(functions);
      const result = findFunctionsNeedingAttention(metrics);

      expect(result.length).toBeGreaterThanOrEqual(3);
      expect(result.some(f => f.name === 'highComplexity')).toBe(true);
      expect(result.some(f => f.name === 'deepNesting')).toBe(true);
      expect(result.some(f => f.name === 'tooManyParams')).toBe(true);
      expect(result.some(f => f.name === 'tooLong')).toBe(true);
    });

    it('should return empty for compliant functions', () => {
      const functions: FunctionComplexity[] = [
        { name: 'ok1', filePath: 'a.ts', startLine: 1, endLine: 5, linesOfCode: 5, cyclomaticComplexity: 5, cognitiveComplexity: 3, nestingDepth: 2, parameterCount: 3 },
        { name: 'ok2', filePath: 'a.ts', startLine: 10, endLine: 15, linesOfCode: 6, cyclomaticComplexity: 3, cognitiveComplexity: 2, nestingDepth: 1, parameterCount: 2 },
      ];

      const metrics = aggregateComplexityMetrics(functions);
      const result = findFunctionsNeedingAttention(metrics);

      expect(result).toHaveLength(0);
    });
  });
});
