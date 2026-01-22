/**
 * @package @forge/ai-readiness
 * @description Tests for AI-Readiness Assessment Service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AIReadinessService,
  getAIReadinessService,
  resetAIReadinessService,
  quickAssess,
} from '../ai-readiness.service.js';
import { InMemoryFileSystem } from '../detection.js';
import type { RepositoryAnalysis } from '@forge/analysis';

// Helper to create mock repository analysis
function createMockAnalysis(overrides: Partial<RepositoryAnalysis> = {}): RepositoryAnalysis {
  return {
    repositoryPath: '/test/repo',
    totalFiles: 50,
    languageBreakdown: [
      { language: 'typescript', percentage: 80, fileCount: 40, linesOfCode: 8000 },
      { language: 'javascript', percentage: 20, fileCount: 10, linesOfCode: 2000 },
    ],
    structural: {
      totalLines: 10000,
      codeLines: 8000,
      commentLines: 1500,
      blankLines: 500,
      functionCount: 200,
      classCount: 30,
      interfaceCount: 20,
      importCount: 300,
      exportCount: 150,
      averageFunctionSize: 25,
      largestFunctionSize: 75,
      filesOver500LOC: 2,
      totalFiles: 50,
      averageFileSize: 200,
    },
    complexity: {
      averageCyclomaticComplexity: 5,
      maxCyclomaticComplexity: 15,
      functionsOverComplexity10: 10,
      averageCognitiveComplexity: 8,
      averageNestingDepth: 2,
      maxNestingDepth: 5,
      functionsWithDeepNesting: 5,
      averageParameterCount: 2,
      functionsWithManyParameters: 3,
      functions: [
        {
          name: 'complexFunction',
          filePath: '/test/repo/src/complex.ts',
          startLine: 10,
          endLine: 80,
          linesOfCode: 70,
          cyclomaticComplexity: 15,
          cognitiveComplexity: 20,
          nestingDepth: 5,
          parameterCount: 4,
        },
      ],
    },
    quality: {
      typeAnnotationCoverage: 0.75,
      documentationCoverage: 0.65,
      testCoverage: 80,
      antiPatternCount: 15,
      antiPatternsBySeverity: { low: 10, medium: 4, high: 1, critical: 0 },
      filesMissingDocumentation: 10,
      functionsMissingDocumentation: 25,
    },
    aiReadiness: {
      overall: 72,
      grade: 'C',
      breakdown: {
        structuralQuality: 75,
        complexity: 70,
        documentation: 65,
        testing: 80,
        typeAnnotations: 75,
        security: 85,
      },
      recommendations: [],
      indicators: {
        largeFilesCount: 2,
        largeFunctionsCount: 5,
        missingTypesCount: 20,
        missingDocumentationCount: 25,
        missingTestsCount: 10,
        deepNestingCount: 5,
        longParameterListCount: 3,
        aiFriendlyRatio: 0.85,
      },
    },
    antiPatterns: [
      {
        id: 'high-complexity',
        name: 'High Complexity',
        description: 'Function has high cyclomatic complexity',
        category: 'complexity',
        severity: 'high',
        filePath: '/test/repo/src/complex.ts',
        line: 10,
      },
    ],
    analyzedAt: new Date(),
    analysisDuration: 5000,
    ...overrides,
  };
}

describe('AIReadinessService', () => {
  let service: AIReadinessService;
  let fs: InMemoryFileSystem;

  beforeEach(() => {
    resetAIReadinessService();
    fs = new InMemoryFileSystem();
    service = new AIReadinessService(fs);
  });

  afterEach(() => {
    resetAIReadinessService();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = AIReadinessService.getInstance();
      const instance2 = AIReadinessService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should accept custom file system', () => {
      const customFs = new InMemoryFileSystem();
      const instance = AIReadinessService.getInstance(customFs);
      expect(instance).toBeDefined();
    });
  });

  describe('resetInstance', () => {
    it('should reset singleton', () => {
      const instance1 = AIReadinessService.getInstance();
      AIReadinessService.resetInstance();
      const instance2 = AIReadinessService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('setFileSystem', () => {
    it('should update file system', () => {
      const newFs = new InMemoryFileSystem({ '/test/new.ts': '' });
      service.setFileSystem(newFs);
      // No error thrown
      expect(true).toBe(true);
    });
  });

  describe('assessRepository', () => {
    it('should perform full assessment', async () => {
      const analysis = createMockAnalysis();

      // Setup file system with test files
      fs.addFile('/test/repo/CLAUDE.md', '# Claude Instructions');
      fs.addFile('/test/repo/README.md', '# Test Repo');
      fs.addFile('/test/repo/.eslintrc.json', '{}');
      fs.addFile('/test/repo/.prettierrc', '{}');
      fs.addFile('/test/repo/package.json', '{}');
      fs.addFile('/test/repo/package-lock.json', '{}');
      fs.addDirectory('/test/repo/.github/workflows', ['ci.yml']);

      const assessment = await service.assessRepository(analysis);

      expect(assessment.overallScore).toBeDefined();
      expect(assessment.grade).toBeDefined();
      expect(assessment.breakdown).toBeDefined();
      expect(assessment.recommendations).toBeDefined();
      expect(assessment.effortEstimate).toBeDefined();
      expect(assessment.tooling).toBeDefined();
      expect(assessment.githubReadiness).toBeDefined();
    });

    it('should report progress', async () => {
      const analysis = createMockAnalysis();
      const progressUpdates: string[] = [];

      const assessment = await service.assessRepository(analysis, {}, (progress) => {
        progressUpdates.push(progress.phase);
      });

      expect(progressUpdates).toContain('initializing');
      expect(progressUpdates).toContain('analyzing');
      expect(progressUpdates).toContain('scoring');
      expect(progressUpdates).toContain('complete');
      expect(assessment).toBeDefined();
    });

    it('should use custom thresholds', async () => {
      const analysis = createMockAnalysis();

      const assessment = await service.assessRepository(analysis, {
        thresholds: {
          largeFile: 300, // Lower threshold
          largeFunction: 30,
          highComplexity: 5,
          deepNesting: 2,
          longParameterList: 3,
          lowDocumentation: 0.5,
          lowTestCoverage: 60,
        },
      });

      // With stricter thresholds, score should be lower
      expect(assessment.overallScore).toBeDefined();
    });

    it('should calculate trends with previous assessment', async () => {
      const analysis = createMockAnalysis();
      const previousAssessment = await service.assessRepository(analysis);

      // Improve the analysis slightly
      const improvedAnalysis = createMockAnalysis({
        quality: {
          typeAnnotationCoverage: 0.85,
          documentationCoverage: 0.75,
          testCoverage: 90,
          antiPatternCount: 5,
          antiPatternsBySeverity: { low: 3, medium: 2, high: 0, critical: 0 },
          filesMissingDocumentation: 5,
          functionsMissingDocumentation: 10,
        },
      });

      const newAssessment = await service.assessRepository(improvedAnalysis, {
        previousAssessment,
      });

      expect(newAssessment.trends).toBeDefined();
      expect(newAssessment.trends?.direction).toBeDefined();
      expect(newAssessment.trends?.history.length).toBe(2);
    });

    it('should use target score for effort estimate', async () => {
      const analysis = createMockAnalysis();

      const assessment = await service.assessRepository(analysis, {
        targetScore: 90,
      });

      expect(assessment.effortEstimate.targetScore).toBeLessThanOrEqual(100);
    });
  });

  describe('assessFromAnalysis', () => {
    it('should assess with pre-configured tooling', async () => {
      const analysis = createMockAnalysis();
      const tooling = {
        hasEslint: true,
        hasPrettier: true,
        hasPylint: false,
        hasBlack: false,
        hasRubocop: false,
        hasGofmt: false,
        hasPackageManager: true,
        packageManager: 'npm' as const,
        hasBuildTool: true,
        buildTool: 'vite',
        hasPreCommitHooks: true,
        hasHusky: true,
      };
      const githubConfig = {
        hasClaudeMd: true,
        hasCursorRules: false,
        hasGitHubActions: true,
        hasCircleCI: false,
        hasJenkins: false,
        hasPrTemplate: true,
        hasIssueTemplates: false,
        hasContributing: true,
        hasBranchProtection: false,
        hasReadme: true,
        hasCodeowners: false,
        hasADRs: true,
      };

      const assessment = await service.assessFromAnalysis(analysis, tooling, githubConfig);

      expect(assessment.overallScore).toBeDefined();
      expect(assessment.tooling.hasEslint).toBe(true);
      expect(assessment.githubReadiness.hasClaudeMd).toBe(true);
    });

    it('should work with minimal config', async () => {
      const analysis = createMockAnalysis();
      const tooling = {
        hasEslint: false,
        hasPrettier: false,
        hasPylint: false,
        hasBlack: false,
        hasRubocop: false,
        hasGofmt: false,
        hasPackageManager: false,
        hasBuildTool: false,
        hasPreCommitHooks: false,
        hasHusky: false,
      };
      const githubConfig = {
        hasClaudeMd: false,
        hasCursorRules: false,
        hasGitHubActions: false,
        hasCircleCI: false,
        hasJenkins: false,
        hasPrTemplate: false,
        hasIssueTemplates: false,
        hasContributing: false,
        hasBranchProtection: false,
        hasReadme: false,
        hasCodeowners: false,
        hasADRs: false,
      };

      const assessment = await service.assessFromAnalysis(analysis, tooling, githubConfig);

      // Score should be lower without tooling/github readiness
      expect(assessment.overallScore).toBeDefined();
      expect(assessment.breakdown.toolingSupport).toBe(0);
      expect(assessment.breakdown.githubReadiness).toBeLessThan(50);
    });
  });

  describe('generateReport', () => {
    it('should generate report from assessment', async () => {
      const analysis = createMockAnalysis();
      const assessment = await service.assessFromAnalysis(
        analysis,
        {
          hasEslint: true,
          hasPrettier: true,
          hasPylint: false,
          hasBlack: false,
          hasRubocop: false,
          hasGofmt: false,
          hasPackageManager: true,
          hasBuildTool: true,
          hasPreCommitHooks: true,
          hasHusky: false,
        },
        {
          hasClaudeMd: true,
          hasCursorRules: false,
          hasGitHubActions: true,
          hasCircleCI: false,
          hasJenkins: false,
          hasPrTemplate: true,
          hasIssueTemplates: false,
          hasContributing: false,
          hasBranchProtection: false,
          hasReadme: true,
          hasCodeowners: false,
          hasADRs: false,
        }
      );

      const report = service.generateReport(assessment);

      expect(report.title).toBe('AI-Readiness Assessment Report');
      expect(report.overallScore).toBe(assessment.overallScore);
      expect(report.sections.length).toBeGreaterThan(0);
    });
  });

  describe('exportAssessment', () => {
    it('should export to markdown', async () => {
      const analysis = createMockAnalysis();
      const assessment = await service.assessFromAnalysis(
        analysis,
        {
          hasEslint: true,
          hasPrettier: true,
          hasPylint: false,
          hasBlack: false,
          hasRubocop: false,
          hasGofmt: false,
          hasPackageManager: true,
          hasBuildTool: true,
          hasPreCommitHooks: true,
          hasHusky: false,
        },
        {
          hasClaudeMd: true,
          hasCursorRules: false,
          hasGitHubActions: true,
          hasCircleCI: false,
          hasJenkins: false,
          hasPrTemplate: true,
          hasIssueTemplates: false,
          hasContributing: false,
          hasBranchProtection: false,
          hasReadme: true,
          hasCodeowners: false,
          hasADRs: false,
        }
      );

      const markdown = service.exportAssessment(assessment, { format: 'markdown' });

      expect(markdown).toContain('# AI-Readiness Assessment Report');
    });

    it('should export to JSON', async () => {
      const analysis = createMockAnalysis();
      const assessment = await service.assessFromAnalysis(
        analysis,
        {
          hasEslint: true,
          hasPrettier: true,
          hasPylint: false,
          hasBlack: false,
          hasRubocop: false,
          hasGofmt: false,
          hasPackageManager: true,
          hasBuildTool: true,
          hasPreCommitHooks: true,
          hasHusky: false,
        },
        {
          hasClaudeMd: true,
          hasCursorRules: false,
          hasGitHubActions: true,
          hasCircleCI: false,
          hasJenkins: false,
          hasPrTemplate: true,
          hasIssueTemplates: false,
          hasContributing: false,
          hasBranchProtection: false,
          hasReadme: true,
          hasCodeowners: false,
          hasADRs: false,
        }
      );

      const json = service.exportAssessment(assessment, { format: 'json' });

      expect(() => JSON.parse(json)).not.toThrow();
    });
  });

  describe('getDimensionScore', () => {
    it('should return dimension score result', async () => {
      const analysis = createMockAnalysis();
      const assessment = await service.assessFromAnalysis(
        analysis,
        {
          hasEslint: true,
          hasPrettier: true,
          hasPylint: false,
          hasBlack: false,
          hasRubocop: false,
          hasGofmt: false,
          hasPackageManager: true,
          hasBuildTool: true,
          hasPreCommitHooks: true,
          hasHusky: false,
        },
        {
          hasClaudeMd: true,
          hasCursorRules: false,
          hasGitHubActions: true,
          hasCircleCI: false,
          hasJenkins: false,
          hasPrTemplate: true,
          hasIssueTemplates: false,
          hasContributing: false,
          hasBranchProtection: false,
          hasReadme: true,
          hasCodeowners: false,
          hasADRs: false,
        }
      );

      const result = service.getDimensionScore(assessment, 'structuralQuality');

      expect(result).toBeDefined();
      expect(result?.score).toBeDefined();
    });

    it('should return undefined for missing dimension', async () => {
      const analysis = createMockAnalysis();
      const assessment = await service.assessFromAnalysis(
        analysis,
        {
          hasEslint: true,
          hasPrettier: true,
          hasPylint: false,
          hasBlack: false,
          hasRubocop: false,
          hasGofmt: false,
          hasPackageManager: true,
          hasBuildTool: true,
          hasPreCommitHooks: true,
          hasHusky: false,
        },
        {
          hasClaudeMd: true,
          hasCursorRules: false,
          hasGitHubActions: true,
          hasCircleCI: false,
          hasJenkins: false,
          hasPrTemplate: true,
          hasIssueTemplates: false,
          hasContributing: false,
          hasBranchProtection: false,
          hasReadme: true,
          hasCodeowners: false,
          hasADRs: false,
        }
      );

      // Clear the map to simulate missing dimension
      assessment.dimensionScores.clear();

      const result = service.getDimensionScore(assessment, 'structuralQuality');
      expect(result).toBeUndefined();
    });
  });

  describe('compareAssessments', () => {
    it('should compare two assessments', async () => {
      const analysis1 = createMockAnalysis();
      const analysis2 = createMockAnalysis({
        quality: {
          typeAnnotationCoverage: 0.85,
          documentationCoverage: 0.75,
          testCoverage: 90,
          antiPatternCount: 5,
          antiPatternsBySeverity: { low: 3, medium: 2, high: 0, critical: 0 },
          filesMissingDocumentation: 5,
          functionsMissingDocumentation: 10,
        },
      });

      const tooling = {
        hasEslint: true,
        hasPrettier: true,
        hasPylint: false,
        hasBlack: false,
        hasRubocop: false,
        hasGofmt: false,
        hasPackageManager: true,
        hasBuildTool: true,
        hasPreCommitHooks: true,
        hasHusky: false,
      };
      const github = {
        hasClaudeMd: true,
        hasCursorRules: false,
        hasGitHubActions: true,
        hasCircleCI: false,
        hasJenkins: false,
        hasPrTemplate: true,
        hasIssueTemplates: false,
        hasContributing: false,
        hasBranchProtection: false,
        hasReadme: true,
        hasCodeowners: false,
        hasADRs: false,
      };

      const assessment1 = await service.assessFromAnalysis(analysis1, tooling, github);
      const assessment2 = await service.assessFromAnalysis(analysis2, tooling, github);

      const comparison = service.compareAssessments(assessment2, assessment1);

      expect(comparison.scoreChange).toBeDefined();
      expect(comparison.gradeChange).toBeDefined();
      expect(comparison.dimensionChanges).toBeDefined();
      expect(comparison.improvements).toBeDefined();
      expect(comparison.regressions).toBeDefined();
    });

    it('should identify improvements', async () => {
      const analysis1 = createMockAnalysis({
        quality: {
          typeAnnotationCoverage: 0.5,
          documentationCoverage: 0.4,
          testCoverage: 50,
          antiPatternCount: 30,
          antiPatternsBySeverity: { low: 20, medium: 8, high: 2, critical: 0 },
          filesMissingDocumentation: 20,
          functionsMissingDocumentation: 50,
        },
      });
      const analysis2 = createMockAnalysis({
        quality: {
          typeAnnotationCoverage: 0.9,
          documentationCoverage: 0.85,
          testCoverage: 95,
          antiPatternCount: 5,
          antiPatternsBySeverity: { low: 3, medium: 2, high: 0, critical: 0 },
          filesMissingDocumentation: 2,
          functionsMissingDocumentation: 5,
        },
      });

      const tooling = {
        hasEslint: true,
        hasPrettier: true,
        hasPylint: false,
        hasBlack: false,
        hasRubocop: false,
        hasGofmt: false,
        hasPackageManager: true,
        hasBuildTool: true,
        hasPreCommitHooks: true,
        hasHusky: false,
      };
      const github = {
        hasClaudeMd: true,
        hasCursorRules: false,
        hasGitHubActions: true,
        hasCircleCI: false,
        hasJenkins: false,
        hasPrTemplate: true,
        hasIssueTemplates: false,
        hasContributing: false,
        hasBranchProtection: false,
        hasReadme: true,
        hasCodeowners: false,
        hasADRs: false,
      };

      const assessment1 = await service.assessFromAnalysis(analysis1, tooling, github);
      const assessment2 = await service.assessFromAnalysis(analysis2, tooling, github);

      const comparison = service.compareAssessments(assessment2, assessment1);

      expect(comparison.scoreChange).toBeGreaterThan(0);
      expect(comparison.improvements.length).toBeGreaterThan(0);
    });
  });
});

describe('getAIReadinessService', () => {
  beforeEach(() => {
    resetAIReadinessService();
  });

  it('should return service instance', () => {
    const service = getAIReadinessService();
    expect(service).toBeInstanceOf(AIReadinessService);
  });
});

describe('quickAssess', () => {
  beforeEach(() => {
    resetAIReadinessService();
  });

  it('should perform quick assessment', async () => {
    const analysis = createMockAnalysis();

    const assessment = await quickAssess(analysis, {
      hasEslint: true,
      hasPrettier: true,
    }, {
      hasClaudeMd: true,
      hasReadme: true,
    });

    expect(assessment.overallScore).toBeDefined();
    expect(assessment.grade).toBeDefined();
    expect(assessment.recommendations).toBeDefined();
  });

  it('should work with no config', async () => {
    const analysis = createMockAnalysis();

    const assessment = await quickAssess(analysis);

    expect(assessment.overallScore).toBeDefined();
    expect(assessment.grade).toBeDefined();
  });
});
