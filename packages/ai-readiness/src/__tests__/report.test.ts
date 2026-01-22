/**
 * @package @forge/ai-readiness
 * @description Tests for report generation
 */

import { describe, it, expect } from 'vitest';
import {
  generateReport,
  exportToMarkdown,
  exportToJson,
  exportToHtml,
  exportToCsv,
  exportReport,
} from '../report.js';
import type { AIReadinessAssessment, ImprovementRecommendation } from '../ai-readiness.types.js';

// Helper to create mock assessment
function createMockAssessment(overrides: Partial<AIReadinessAssessment> = {}): AIReadinessAssessment {
  return {
    overallScore: 75,
    grade: 'C',
    breakdown: {
      structuralQuality: 80,
      complexityManagement: 70,
      documentationCoverage: 65,
      testCoverage: 85,
      typeAnnotations: 75,
      namingClarity: 70,
      architecturalClarity: 75,
      toolingSupport: 90,
      githubReadiness: 70,
    },
    dimensionScores: new Map(),
    recommendations: [
      {
        id: 'rec1',
        priority: 'HIGH',
        impact: 'HIGH',
        effort: 'MEDIUM',
        title: 'Reduce Function Complexity',
        description: '10 functions have high cyclomatic complexity',
        dimension: 'complexityManagement',
        estimatedImpact: 15,
        estimatedHours: 20,
        automationAvailable: true,
        affectedFiles: ['src/complex.ts:45', 'src/utils.ts:120'],
        actionSteps: ['Identify complex functions', 'Extract helper functions'],
      },
      {
        id: 'rec2',
        priority: 'MEDIUM',
        impact: 'MEDIUM',
        effort: 'LOW',
        title: 'Add Documentation',
        description: '25 functions lack documentation',
        dimension: 'documentationCoverage',
        estimatedImpact: 10,
        estimatedHours: 5,
        automationAvailable: true,
        affectedFiles: [],
        actionSteps: ['Add JSDoc comments'],
      },
    ],
    effortEstimate: {
      totalHours: 25,
      byDimension: {
        structuralQuality: 0,
        complexityManagement: 20,
        documentationCoverage: 5,
        testCoverage: 0,
        typeAnnotations: 0,
        namingClarity: 0,
        architecturalClarity: 0,
        toolingSupport: 0,
        githubReadiness: 0,
      },
      targetScore: 85,
      byPriority: {
        high: 20,
        medium: 5,
        low: 0,
      },
    },
    details: {
      largeFiles: [
        { path: 'src/large.ts', linesOfCode: 600, language: 'typescript', issuesCount: 5 },
      ],
      complexFunctions: [
        {
          name: 'complexFunction',
          filePath: 'src/complex.ts',
          startLine: 45,
          endLine: 120,
          linesOfCode: 75,
          cyclomaticComplexity: 15,
          cognitiveComplexity: 20,
          nestingDepth: 5,
          parameterCount: 4,
          hasDocumentation: false,
          hasTypeAnnotations: true,
          issues: ['High complexity', 'Deep nesting'],
        },
      ],
      functionsNeedingAttention: [],
      antiPatternsByCategory: {
        complexity: [],
        maintainability: [],
      },
      filesMissingDocs: ['src/undocumented.ts'],
      filesMissingTests: ['src/untested.ts'],
    },
    tooling: {
      hasEslint: true,
      hasPrettier: true,
      hasPylint: false,
      hasBlack: false,
      hasRubocop: false,
      hasGofmt: false,
      hasPackageManager: true,
      packageManager: 'npm',
      hasBuildTool: true,
      buildTool: 'vite',
      hasPreCommitHooks: true,
      hasHusky: true,
    },
    githubReadiness: {
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
      hasADRs: true,
    },
    sourceAnalysis: {
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
        functions: [],
      },
      quality: {
        typeAnnotationCoverage: 0.75,
        documentationCoverage: 0.65,
        testCoverage: 85,
        antiPatternCount: 15,
        antiPatternsBySeverity: { low: 10, medium: 4, high: 1, critical: 0 },
        filesMissingDocumentation: 10,
        functionsMissingDocumentation: 25,
      },
      aiReadiness: {} as any,
      antiPatterns: [],
      analyzedAt: new Date('2024-01-15T10:00:00Z'),
      analysisDuration: 5000,
    },
    assessedAt: new Date('2024-01-15T10:00:05Z'),
    assessmentDuration: 5000,
    ...overrides,
  };
}

describe('generateReport', () => {
  it('should generate report with all sections', () => {
    const assessment = createMockAssessment();
    const report = generateReport(assessment);

    expect(report.title).toBe('AI-Readiness Assessment Report');
    expect(report.overallScore).toBe(75);
    expect(report.grade).toBe('C');
    expect(report.sections.length).toBeGreaterThan(0);
  });

  it('should include executive summary', () => {
    const assessment = createMockAssessment();
    const report = generateReport(assessment);

    expect(report.summary).toContain('75');
    expect(report.summary).toContain('Grade C');
  });

  it('should include score breakdown section', () => {
    const assessment = createMockAssessment();
    const report = generateReport(assessment);

    const breakdownSection = report.sections.find((s) => s.id === 'score-breakdown');
    expect(breakdownSection).toBeDefined();
    expect(breakdownSection?.content).toContain('Structural Quality');
    expect(breakdownSection?.content).toContain('Complexity Management');
  });

  it('should include recommendations section', () => {
    const assessment = createMockAssessment();
    const report = generateReport(assessment);

    const recsSection = report.sections.find((s) => s.id === 'recommendations');
    expect(recsSection).toBeDefined();
    expect(recsSection?.content).toContain('Reduce Function Complexity');
    expect(recsSection?.content).toContain('Add Documentation');
  });

  it('should include effort estimate section', () => {
    const assessment = createMockAssessment();
    const report = generateReport(assessment);

    const effortSection = report.sections.find((s) => s.id === 'effort-estimate');
    expect(effortSection).toBeDefined();
    expect(effortSection?.content).toContain('25');
    expect(effortSection?.content).toContain('85');
  });

  it('should include details section', () => {
    const assessment = createMockAssessment();
    const report = generateReport(assessment);

    const detailsSection = report.sections.find((s) => s.id === 'details');
    expect(detailsSection).toBeDefined();
    expect(detailsSection?.content).toContain('Large Files');
    expect(detailsSection?.content).toContain('Complex Functions');
  });

  it('should include tooling section', () => {
    const assessment = createMockAssessment();
    const report = generateReport(assessment);

    const toolingSection = report.sections.find((s) => s.id === 'tooling');
    expect(toolingSection).toBeDefined();
    expect(toolingSection?.content).toContain('ESLint');
    expect(toolingSection?.content).toContain('Prettier');
    expect(toolingSection?.content).toContain('CLAUDE.md');
  });

  it('should handle empty recommendations', () => {
    const assessment = createMockAssessment({ recommendations: [] });
    const report = generateReport(assessment);

    const recsSection = report.sections.find((s) => s.id === 'recommendations');
    expect(recsSection?.content).toContain('well-optimized');
  });

  it('should handle assessment with grade A', () => {
    const assessment = createMockAssessment({ overallScore: 95, grade: 'A' });
    const report = generateReport(assessment);

    expect(report.summary).toContain('95');
    expect(report.summary).toContain('Excellent');
  });

  it('should handle assessment with grade F', () => {
    const assessment = createMockAssessment({ overallScore: 45, grade: 'F' });
    const report = generateReport(assessment);

    expect(report.summary).toContain('45');
    expect(report.summary).toContain('Not AI-ready');
  });
});

describe('exportToMarkdown', () => {
  it('should export as markdown', () => {
    const assessment = createMockAssessment();
    const report = generateReport(assessment);
    const markdown = exportToMarkdown(report);

    expect(markdown).toContain('# AI-Readiness Assessment Report');
    expect(markdown).toContain('## Summary');
    expect(markdown).toContain('**Generated**:');
    expect(markdown).toContain('**Repository**:');
  });

  it('should include all sections', () => {
    const assessment = createMockAssessment();
    const report = generateReport(assessment);
    const markdown = exportToMarkdown(report);

    expect(markdown).toContain('Score Breakdown');
    expect(markdown).toContain('Recommendations');
    expect(markdown).toContain('Effort Estimate');
  });

  it('should format tables correctly', () => {
    const assessment = createMockAssessment();
    const report = generateReport(assessment);
    const markdown = exportToMarkdown(report);

    expect(markdown).toContain('|');
    expect(markdown).toContain('---');
  });
});

describe('exportToJson', () => {
  it('should export as valid JSON', () => {
    const assessment = createMockAssessment();
    const report = generateReport(assessment);
    const json = exportToJson(report);

    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('should include all report data', () => {
    const assessment = createMockAssessment();
    const report = generateReport(assessment);
    const json = exportToJson(report);
    const parsed = JSON.parse(json);

    expect(parsed.title).toBe('AI-Readiness Assessment Report');
    expect(parsed.overallScore).toBe(75);
    expect(parsed.grade).toBe('C');
    expect(parsed.sections).toBeDefined();
    expect(parsed.recommendations).toBeDefined();
  });

  it('should be pretty-printed', () => {
    const assessment = createMockAssessment();
    const report = generateReport(assessment);
    const json = exportToJson(report);

    expect(json).toContain('\n');
    expect(json).toContain('  ');
  });
});

describe('exportToHtml', () => {
  it('should export as HTML', () => {
    const assessment = createMockAssessment();
    const report = generateReport(assessment);
    const html = exportToHtml(report);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html>');
    expect(html).toContain('</html>');
  });

  it('should include title', () => {
    const assessment = createMockAssessment();
    const report = generateReport(assessment);
    const html = exportToHtml(report);

    expect(html).toContain('<title>AI-Readiness Assessment Report</title>');
  });

  it('should include styles', () => {
    const assessment = createMockAssessment();
    const report = generateReport(assessment);
    const html = exportToHtml(report);

    expect(html).toContain('<style>');
    expect(html).toContain('font-family');
  });

  it('should convert markdown formatting', () => {
    const assessment = createMockAssessment();
    const report = generateReport(assessment);
    const html = exportToHtml(report);

    expect(html).toContain('<h1>');
    expect(html).toContain('<h2>');
    expect(html).toContain('<strong>');
  });
});

describe('exportToCsv', () => {
  it('should export recommendations as CSV', () => {
    const recommendations: ImprovementRecommendation[] = [
      {
        id: 'rec1',
        priority: 'HIGH',
        impact: 'HIGH',
        effort: 'MEDIUM',
        title: 'Test Recommendation',
        description: 'Test description',
        dimension: 'complexityManagement',
        estimatedImpact: 15,
        estimatedHours: 20,
        automationAvailable: true,
        affectedFiles: [],
      },
    ];

    const csv = exportToCsv(recommendations);

    expect(csv).toContain('ID,Title,Priority');
    expect(csv).toContain('rec1');
    expect(csv).toContain('HIGH');
    expect(csv).toContain('complexityManagement');
  });

  it('should include headers', () => {
    const csv = exportToCsv([]);

    expect(csv).toContain('ID');
    expect(csv).toContain('Title');
    expect(csv).toContain('Priority');
    expect(csv).toContain('Impact');
    expect(csv).toContain('Effort');
    expect(csv).toContain('Dimension');
  });

  it('should escape quotes in description', () => {
    const recommendations: ImprovementRecommendation[] = [
      {
        id: 'rec1',
        priority: 'HIGH',
        impact: 'HIGH',
        effort: 'MEDIUM',
        title: 'Test',
        description: 'Description with "quotes" inside',
        dimension: 'complexityManagement',
        estimatedImpact: 15,
        estimatedHours: 20,
        automationAvailable: true,
        affectedFiles: [],
      },
    ];

    const csv = exportToCsv(recommendations);

    expect(csv).toContain('""quotes""');
  });
});

describe('exportReport', () => {
  it('should export as markdown by default', () => {
    const assessment = createMockAssessment();
    const output = exportReport(assessment, { format: 'markdown' });

    expect(output).toContain('# AI-Readiness Assessment Report');
  });

  it('should export as JSON', () => {
    const assessment = createMockAssessment();
    const output = exportReport(assessment, { format: 'json' });

    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('should export as HTML', () => {
    const assessment = createMockAssessment();
    const output = exportReport(assessment, { format: 'html' });

    expect(output).toContain('<!DOCTYPE html>');
  });

  it('should export as CSV', () => {
    const assessment = createMockAssessment();
    const output = exportReport(assessment, { format: 'csv' });

    expect(output).toContain('ID,Title');
  });
});
