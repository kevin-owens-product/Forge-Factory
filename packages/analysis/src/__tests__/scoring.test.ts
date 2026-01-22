/**
 * @package @forge/analysis
 * @description Tests for AI-readiness scoring
 */

import { describe, it, expect } from 'vitest';
import {
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
} from '../scoring.js';
import {
  StructuralMetrics,
  ComplexityMetrics,
  QualityIndicators,
  AntiPattern,
  FunctionComplexity,
  AIReadinessScoreBreakdown,
} from '../analysis.types.js';

describe('scoring', () => {
  const createStructuralMetrics = (overrides: Partial<StructuralMetrics> = {}): StructuralMetrics => ({
    totalLines: 1000,
    codeLines: 800,
    commentLines: 150,
    blankLines: 50,
    functionCount: 40,
    classCount: 5,
    interfaceCount: 10,
    importCount: 20,
    exportCount: 15,
    averageFunctionSize: 15,
    largestFunctionSize: 40,
    filesOver500LOC: 0,
    totalFiles: 10,
    averageFileSize: 80,
    ...overrides,
  });

  const createComplexityMetrics = (overrides: Partial<ComplexityMetrics> = {}): ComplexityMetrics => ({
    averageCyclomaticComplexity: 4,
    maxCyclomaticComplexity: 8,
    functionsOverComplexity10: 0,
    averageCognitiveComplexity: 3,
    averageNestingDepth: 2,
    maxNestingDepth: 3,
    functionsWithDeepNesting: 0,
    averageParameterCount: 2.5,
    functionsWithManyParameters: 0,
    functions: [],
    ...overrides,
  });

  const createQualityIndicators = (overrides: Partial<QualityIndicators> = {}): QualityIndicators => ({
    typeAnnotationCoverage: 0.9,
    documentationCoverage: 0.75,
    antiPatternCount: 5,
    antiPatternsBySeverity: { critical: 0, high: 0, medium: 2, low: 3 },
    filesMissingDocumentation: 2,
    functionsMissingDocumentation: 10,
    ...overrides,
  });

  describe('calculateStructuralScore', () => {
    it('should return 100 for well-structured code', () => {
      const metrics = createStructuralMetrics();
      const score = calculateStructuralScore(metrics);

      expect(score).toBeGreaterThanOrEqual(90);
    });

    it('should penalize large files', () => {
      const metrics = createStructuralMetrics({
        filesOver500LOC: 5,
        totalFiles: 10,
      });
      const score = calculateStructuralScore(metrics);

      expect(score).toBeLessThan(100);
    });

    it('should penalize high average file size', () => {
      const metrics = createStructuralMetrics({
        averageFileSize: 400,
      });
      const score = calculateStructuralScore(metrics);

      expect(score).toBeLessThan(100);
    });

    it('should reward small files', () => {
      const metrics = createStructuralMetrics({
        averageFileSize: 100,
      });
      const score = calculateStructuralScore(metrics);

      expect(score).toBeGreaterThanOrEqual(100);
    });

    it('should penalize low comment density', () => {
      const metrics = createStructuralMetrics({
        commentLines: 10,
        codeLines: 800,
      });
      const score = calculateStructuralScore(metrics);

      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('calculateComplexityScore', () => {
    it('should return 100 for low complexity', () => {
      const metrics = createComplexityMetrics();
      const score = calculateComplexityScore(metrics);

      expect(score).toBeGreaterThanOrEqual(90);
    });

    it('should penalize high average complexity', () => {
      const metrics = createComplexityMetrics({
        averageCyclomaticComplexity: 12,
      });
      const score = calculateComplexityScore(metrics);

      expect(score).toBeLessThanOrEqual(70);
    });

    it('should penalize functions over complexity 10', () => {
      const metrics = createComplexityMetrics({
        functionsOverComplexity10: 10,
        functions: new Array(20).fill({} as FunctionComplexity),
      });
      const score = calculateComplexityScore(metrics);

      expect(score).toBeLessThan(90);
    });

    it('should penalize deep nesting', () => {
      const metrics = createComplexityMetrics({
        functionsWithDeepNesting: 10,
        functions: new Array(20).fill({} as FunctionComplexity),
      });
      const score = calculateComplexityScore(metrics);

      expect(score).toBeLessThanOrEqual(90);
    });

    it('should penalize many parameters', () => {
      const metrics = createComplexityMetrics({
        functionsWithManyParameters: 10,
        functions: new Array(20).fill({} as FunctionComplexity),
      });
      const score = calculateComplexityScore(metrics);

      expect(score).toBeLessThan(100);
    });
  });

  describe('calculateDocumentationScore', () => {
    it('should use documentation coverage', () => {
      const quality = createQualityIndicators({
        documentationCoverage: 0.8,
      });
      const score = calculateDocumentationScore(quality);

      expect(score).toBe(80);
    });

    it('should penalize many missing docs', () => {
      const quality = createQualityIndicators({
        documentationCoverage: 0.5,
        functionsMissingDocumentation: 50,
      });
      const score = calculateDocumentationScore(quality);

      expect(score).toBeLessThan(50);
    });
  });

  describe('calculateTestingScore', () => {
    it('should use test coverage when available', () => {
      const quality = createQualityIndicators({
        testCoverage: 85,
      });
      const score = calculateTestingScore(quality);

      expect(score).toBe(85);
    });

    it('should return 50 when coverage unknown', () => {
      const quality = createQualityIndicators({
        testCoverage: undefined,
      });
      const score = calculateTestingScore(quality);

      expect(score).toBe(50);
    });
  });

  describe('calculateTypeScore', () => {
    it('should use type annotation coverage', () => {
      const quality = createQualityIndicators({
        typeAnnotationCoverage: 0.95,
      });
      const score = calculateTypeScore(quality);

      expect(score).toBe(95);
    });
  });

  describe('calculateSecurityScore', () => {
    it('should return 100 for no security issues', () => {
      const patterns: AntiPattern[] = [];
      const score = calculateSecurityScore(patterns);

      expect(score).toBe(100);
    });

    it('should heavily penalize critical issues', () => {
      const patterns: AntiPattern[] = [
        { id: 'a', name: '', description: '', category: 'security', severity: 'critical', filePath: '', line: 1 },
      ];
      const score = calculateSecurityScore(patterns);

      expect(score).toBe(80);
    });

    it('should penalize high severity issues', () => {
      const patterns: AntiPattern[] = [
        { id: 'a', name: '', description: '', category: 'security', severity: 'high', filePath: '', line: 1 },
        { id: 'b', name: '', description: '', category: 'security', severity: 'high', filePath: '', line: 2 },
      ];
      const score = calculateSecurityScore(patterns);

      expect(score).toBe(80);
    });

    it('should penalize hardcoded values', () => {
      const patterns: AntiPattern[] = [
        { id: 'hardcoded-value', name: '', description: '', category: 'maintainability', severity: 'low', filePath: '', line: 1 },
        { id: 'hardcoded-value', name: '', description: '', category: 'maintainability', severity: 'low', filePath: '', line: 2 },
      ];
      const score = calculateSecurityScore(patterns);

      expect(score).toBe(98);
    });
  });

  describe('calculateAIReadinessScore', () => {
    it('should calculate overall score', () => {
      const structural = createStructuralMetrics();
      const complexity = createComplexityMetrics();
      const quality = createQualityIndicators();

      const result = calculateAIReadinessScore(
        structural,
        complexity,
        quality,
        []
      );

      expect(result.overall).toBeGreaterThanOrEqual(0);
      expect(result.overall).toBeLessThanOrEqual(100);
      expect(result.grade).toBeDefined();
      expect(result.breakdown).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(result.indicators).toBeDefined();
    });

    it('should return grade A for excellent code', () => {
      const structural = createStructuralMetrics({
        filesOver500LOC: 0,
        averageFileSize: 100,
      });
      const complexity = createComplexityMetrics({
        averageCyclomaticComplexity: 3,
        functionsOverComplexity10: 0,
        functionsWithDeepNesting: 0,
      });
      const quality = createQualityIndicators({
        typeAnnotationCoverage: 0.95,
        documentationCoverage: 0.9,
        testCoverage: 90,
      });

      const result = calculateAIReadinessScore(
        structural,
        complexity,
        quality,
        []
      );

      expect(result.grade).toBe('A');
    });

    it('should return grade F for poor code', () => {
      const structural = createStructuralMetrics({
        filesOver500LOC: 8,
        totalFiles: 10,
        averageFileSize: 500,
      });
      const complexity = createComplexityMetrics({
        averageCyclomaticComplexity: 15,
        maxCyclomaticComplexity: 50,
        functionsOverComplexity10: 20,
        functions: new Array(30).fill({} as FunctionComplexity),
        functionsWithDeepNesting: 15,
      });
      const quality = createQualityIndicators({
        typeAnnotationCoverage: 0.1,
        documentationCoverage: 0.1,
        testCoverage: 10,
      });

      const result = calculateAIReadinessScore(
        structural,
        complexity,
        quality,
        []
      );

      expect(result.grade).toBe('F');
    });
  });

  describe('calculateIndicators', () => {
    it('should calculate AI-readiness indicators', () => {
      const structural = createStructuralMetrics({
        filesOver500LOC: 2,
        functionCount: 40,
      });
      const complexity = createComplexityMetrics({
        functionsWithDeepNesting: 5,
        functionsWithManyParameters: 3,
        functions: [
          { name: 'f1', filePath: '', startLine: 1, endLine: 60, linesOfCode: 60, cyclomaticComplexity: 5, cognitiveComplexity: 3, nestingDepth: 2, parameterCount: 2 },
          { name: 'f2', filePath: '', startLine: 70, endLine: 90, linesOfCode: 20, cyclomaticComplexity: 3, cognitiveComplexity: 2, nestingDepth: 1, parameterCount: 1 },
        ],
      });
      const quality = createQualityIndicators({
        typeAnnotationCoverage: 0.7,
        functionsMissingDocumentation: 15,
        testCoverage: 60,
      });

      const indicators = calculateIndicators(structural, complexity, quality);

      expect(indicators.largeFilesCount).toBe(2);
      expect(indicators.largeFunctionsCount).toBe(1);
      expect(indicators.deepNestingCount).toBe(5);
      expect(indicators.longParameterListCount).toBe(3);
      expect(indicators.missingDocumentationCount).toBe(15);
      expect(indicators.aiFriendlyRatio).toBeGreaterThanOrEqual(0);
      expect(indicators.aiFriendlyRatio).toBeLessThanOrEqual(1);
    });
  });

  describe('generateRecommendations', () => {
    it('should generate recommendations for low scores', () => {
      const breakdown: AIReadinessScoreBreakdown = {
        structuralQuality: 50,
        complexity: 60,
        documentation: 40,
        testing: 30,
        typeAnnotations: 50,
        security: 90,
      };

      const structural = createStructuralMetrics({
        filesOver500LOC: 5,
        averageFileSize: 400,
      });
      const complexity = createComplexityMetrics({
        functionsOverComplexity10: 10,
        functionsWithDeepNesting: 5,
        functions: new Array(20).fill({
          name: 'f',
          filePath: 'test.ts',
          startLine: 1,
          endLine: 50,
          linesOfCode: 50,
          cyclomaticComplexity: 15,
          cognitiveComplexity: 10,
          nestingDepth: 5,
          parameterCount: 3,
        } as FunctionComplexity),
      });
      const quality = createQualityIndicators({
        functionsMissingDocumentation: 30,
      });

      const recommendations = generateRecommendations(
        breakdown,
        [],
        structural,
        complexity,
        quality
      );

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.category === 'structure')).toBe(true);
      expect(recommendations.some(r => r.category === 'complexity')).toBe(true);
      expect(recommendations.some(r => r.category === 'documentation')).toBe(true);
    });

    it('should not generate recommendations for high scores', () => {
      const breakdown: AIReadinessScoreBreakdown = {
        structuralQuality: 95,
        complexity: 95,
        documentation: 90,
        testing: 85,
        typeAnnotations: 90,
        security: 100,
      };

      const structural = createStructuralMetrics();
      const complexity = createComplexityMetrics();
      const quality = createQualityIndicators({
        functionsMissingDocumentation: 5,
      });

      const recommendations = generateRecommendations(
        breakdown,
        [],
        structural,
        complexity,
        quality
      );

      expect(recommendations.length).toBeLessThan(5);
    });

    it('should include TODO recommendations', () => {
      const breakdown: AIReadinessScoreBreakdown = {
        structuralQuality: 90,
        complexity: 90,
        documentation: 90,
        testing: 90,
        typeAnnotations: 90,
        security: 90,
      };

      const antiPatterns: AntiPattern[] = new Array(15).fill({
        id: 'todo-comment',
        name: 'TODO',
        description: '',
        category: 'maintainability' as const,
        severity: 'low' as const,
        filePath: 'test.ts',
        line: 1,
      });

      const recommendations = generateRecommendations(
        breakdown,
        antiPatterns,
        createStructuralMetrics(),
        createComplexityMetrics(),
        createQualityIndicators()
      );

      expect(recommendations.some(r => r.title.includes('TODO'))).toBe(true);
    });
  });

  describe('calculateGrade', () => {
    it('should return correct grades', () => {
      expect(calculateGrade(95)).toBe('A');
      expect(calculateGrade(90)).toBe('A');
      expect(calculateGrade(85)).toBe('B');
      expect(calculateGrade(80)).toBe('B');
      expect(calculateGrade(75)).toBe('C');
      expect(calculateGrade(70)).toBe('C');
      expect(calculateGrade(65)).toBe('D');
      expect(calculateGrade(60)).toBe('D');
      expect(calculateGrade(55)).toBe('F');
      expect(calculateGrade(0)).toBe('F');
    });
  });

  describe('getGradeDescription', () => {
    it('should return descriptions for all grades', () => {
      expect(getGradeDescription('A')).toContain('Excellent');
      expect(getGradeDescription('B')).toContain('Good');
      expect(getGradeDescription('C')).toContain('Fair');
      expect(getGradeDescription('D')).toContain('Poor');
      expect(getGradeDescription('F')).toContain('Not AI-ready');
    });
  });

  describe('calculatePotentialImprovement', () => {
    it('should sum recommendation impacts', () => {
      const recommendations = [
        { priority: 1, category: 'complexity' as const, title: '', description: '', impact: 15, affectedFiles: [], effort: 'medium' as const },
        { priority: 2, category: 'documentation' as const, title: '', description: '', impact: 10, affectedFiles: [], effort: 'low' as const },
      ];

      const improvement = calculatePotentialImprovement(recommendations);

      expect(improvement).toBe(25);
    });

    it('should cap at 40 points', () => {
      const recommendations = [
        { priority: 1, category: 'complexity' as const, title: '', description: '', impact: 30, affectedFiles: [], effort: 'high' as const },
        { priority: 2, category: 'documentation' as const, title: '', description: '', impact: 20, affectedFiles: [], effort: 'medium' as const },
      ];

      const improvement = calculatePotentialImprovement(recommendations);

      expect(improvement).toBe(40);
    });
  });

  describe('getScoreCategory', () => {
    it('should return readable labels', () => {
      expect(getScoreCategory('structuralQuality')).toBe('Structure');
      expect(getScoreCategory('complexity')).toBe('Complexity');
      expect(getScoreCategory('documentation')).toBe('Documentation');
      expect(getScoreCategory('testing')).toBe('Testing');
      expect(getScoreCategory('typeAnnotations')).toBe('Types');
      expect(getScoreCategory('security')).toBe('Security');
    });
  });
});
