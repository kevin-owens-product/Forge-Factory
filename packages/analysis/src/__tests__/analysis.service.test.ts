/**
 * @package @forge/analysis
 * @description Tests for analysis service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AnalysisService,
  getAnalysisService,
  resetAnalysisService,
  analyzeFile,
  analyzeFiles,
  analyzeRepository,
} from '../analysis.service.js';
import { AnalysisProgress } from '../analysis.types.js';

describe('AnalysisService', () => {
  beforeEach(() => {
    resetAnalysisService();
  });

  describe('analyzeFile', () => {
    it('should analyze a single TypeScript file', async () => {
      const service = new AnalysisService();
      const content = `
/**
 * Adds two numbers
 */
export function add(a: number, b: number): number {
  return a + b;
}

export function subtract(a: number, b: number): number {
  return a - b;
}
      `;

      const result = await service.analyzeFile('math.ts', content);

      expect(result.file.path).toBe('math.ts');
      expect(result.file.language).toBe('typescript');
      expect(result.structural.functionCount).toBeGreaterThanOrEqual(2);
      expect(result.structural.totalLines).toBeGreaterThan(0);
      expect(result.analysisDuration).toBeGreaterThanOrEqual(0);
    });

    it('should analyze a Python file', async () => {
      const service = new AnalysisService();
      const content = `
def greet(name):
    """Greet a person"""
    return f"Hello, {name}"

class Calculator:
    def add(self, a, b):
        return a + b
      `;

      const result = await service.analyzeFile('app.py', content);

      expect(result.file.language).toBe('python');
      expect(result.structural.functionCount).toBeGreaterThanOrEqual(2);
      expect(result.structural.classCount).toBe(1);
    });

    it('should detect anti-patterns', async () => {
      const service = new AnalysisService();
      const content = `
// TODO: fix this
function test() {
  console.log('debug');
  if (a && b && c && d) {
    return true;
  }
}
      `;

      const result = await service.analyzeFile('test.ts', content);

      expect(result.antiPatterns.length).toBeGreaterThan(0);
      expect(result.antiPatterns.some(p => p.id === 'todo-comment')).toBe(true);
      expect(result.antiPatterns.some(p => p.id === 'console-log')).toBe(true);
    });

    it('should calculate function complexity', async () => {
      const service = new AnalysisService();
      const content = `
function complex(x) {
  if (x > 0) {
    if (x > 10) {
      for (let i = 0; i < x; i++) {
        while (condition) {
          doSomething();
        }
      }
    }
  }
  return x;
}
      `;

      const result = await service.analyzeFile('complex.ts', content);

      expect(result.complexity.length).toBeGreaterThanOrEqual(1);
      const complexFunc = result.complexity.find(f => f.name === 'complex');
      expect(complexFunc).toBeDefined();
      expect(complexFunc?.cyclomaticComplexity).toBeGreaterThan(1);
    });
  });

  describe('analyzeFiles', () => {
    it('should analyze multiple files', async () => {
      const service = new AnalysisService();
      const files = [
        { path: 'a.ts', content: 'const a = 1;' },
        { path: 'b.ts', content: 'const b = 2;' },
        { path: 'c.ts', content: 'const c = 3;' },
      ];

      const results = await service.analyzeFiles(files);

      expect(results.length).toBe(3);
      expect(results.every(r => r.file.language === 'typescript')).toBe(true);
    });

    it('should call progress callback', async () => {
      const service = new AnalysisService();
      const files = [
        { path: 'a.ts', content: 'const a = 1;' },
        { path: 'b.ts', content: 'const b = 2;' },
      ];

      const progressCalls: AnalysisProgress[] = [];
      const onProgress = (progress: AnalysisProgress) => {
        progressCalls.push({ ...progress });
      };

      await service.analyzeFiles(files, onProgress);

      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls.some(p => p.phase === 'analyzing')).toBe(true);
      expect(progressCalls.some(p => p.phase === 'complete')).toBe(true);
    });

    it('should skip large files', async () => {
      const service = new AnalysisService({
        maxFileSize: 100,
      });
      const files = [
        { path: 'small.ts', content: 'const a = 1;' },
        { path: 'large.ts', content: 'const a = ' + 'x'.repeat(200) + ';' },
      ];

      const results = await service.analyzeFiles(files);

      expect(results.length).toBe(1);
      expect(results[0]?.file.path).toBe('small.ts');
    });

    it('should skip test files in non-deep mode', async () => {
      const service = new AnalysisService({
        deepAnalysis: false,
      });
      const files = [
        { path: 'src/app.ts', content: 'const a = 1;' },
        { path: 'src/app.test.ts', content: 'describe("app", () => {});' },
        { path: 'src/__tests__/app.test.ts', content: 'test("works", () => {});' },
      ];

      const results = await service.analyzeFiles(files);

      expect(results.length).toBe(1);
      expect(results[0]?.file.path).toBe('src/app.ts');
    });

    it('should include test files in deep mode', async () => {
      const service = new AnalysisService({
        deepAnalysis: true,
      });
      const files = [
        { path: 'src/app.ts', content: 'const a = 1;' },
        { path: 'src/app.test.ts', content: 'describe("app", () => {});' },
      ];

      const results = await service.analyzeFiles(files);

      expect(results.length).toBe(2);
    });
  });

  describe('analyzeRepository', () => {
    it('should analyze a repository', async () => {
      const service = new AnalysisService();
      const files = [
        {
          path: 'src/utils.ts',
          content: `
export function add(a: number, b: number): number {
  return a + b;
}
export function subtract(a: number, b: number): number {
  return a - b;
}
          `,
        },
        {
          path: 'src/math.ts',
          content: `
import { add } from './utils';
export function double(x: number): number {
  return add(x, x);
}
          `,
        },
        {
          path: 'src/index.ts',
          content: `
export * from './utils';
export * from './math';
          `,
        },
      ];

      const result = await service.analyzeRepository('/repo', files);

      expect(result.repositoryPath).toBe('/repo');
      expect(result.totalFiles).toBe(3);
      expect(result.languageBreakdown.length).toBeGreaterThanOrEqual(1);
      expect(result.languageBreakdown[0]?.language).toBe('typescript');
      expect(result.structural.functionCount).toBeGreaterThanOrEqual(3);
      expect(result.aiReadiness.overall).toBeGreaterThanOrEqual(0);
      expect(result.aiReadiness.overall).toBeLessThanOrEqual(100);
      expect(result.aiReadiness.grade).toBeDefined();
      expect(result.analyzedAt).toBeInstanceOf(Date);
      expect(result.analysisDuration).toBeGreaterThanOrEqual(0);
    });

    it('should filter files by include/exclude patterns', async () => {
      const service = new AnalysisService({
        include: ['**/*.ts'],
        exclude: ['**/node_modules/**', '**/vendor/**'],
      });

      const files = [
        { path: 'src/app.ts', content: 'const a = 1;' },
        { path: 'node_modules/pkg/index.ts', content: 'const b = 2;' },
        { path: 'vendor/lib.ts', content: 'const c = 3;' },
        { path: 'src/style.css', content: 'body {}' },
      ];

      const result = await service.analyzeRepository('/repo', files);

      expect(result.totalFiles).toBe(1);
    });

    it('should calculate language breakdown', async () => {
      const service = new AnalysisService({
        include: ['**/*.ts', '**/*.py'],  // Explicitly include both
        exclude: [],
      });
      const files = [
        { path: 'a.ts', content: 'const a = 1;\nconst b = 2;\nconst c = 3;' },
        { path: 'b.ts', content: 'const d = 4;' },
        { path: 'c.py', content: 'x = 1\ny = 2' },
      ];

      const result = await service.analyzeRepository('/repo', files);

      expect(result.languageBreakdown.length).toBe(2);

      const tsBreakdown = result.languageBreakdown.find(l => l.language === 'typescript');
      const pyBreakdown = result.languageBreakdown.find(l => l.language === 'python');

      expect(tsBreakdown?.fileCount).toBe(2);
      expect(pyBreakdown?.fileCount).toBe(1);
      expect(tsBreakdown!.percentage + pyBreakdown!.percentage).toBe(100);
    });

    it('should aggregate quality indicators', async () => {
      const service = new AnalysisService();
      const files = [
        {
          path: 'a.ts',
          content: `
/**
 * Documented
 */
function documented(x: number): number {
  return x * 2;
}

function undocumented(y) {
  return y + 1;
}
          `,
        },
      ];

      const result = await service.analyzeRepository('/repo', files);

      expect(result.quality.typeAnnotationCoverage).toBeGreaterThanOrEqual(0);
      expect(result.quality.typeAnnotationCoverage).toBeLessThanOrEqual(1);
      expect(result.quality.documentationCoverage).toBeGreaterThanOrEqual(0);
      expect(result.quality.documentationCoverage).toBeLessThanOrEqual(1);
    });

    it('should collect all anti-patterns', async () => {
      const service = new AnalysisService({
        include: ['**/*.ts'],
        exclude: [],
      });
      const files = [
        {
          path: 'a.ts',
          content: `
// TODO: fix this
console.log('debug');
          `,
        },
        {
          path: 'b.ts',
          content: `
// FIXME: broken
console.warn('warning');
          `,
        },
      ];

      const result = await service.analyzeRepository('/repo', files);

      expect(result.antiPatterns.length).toBeGreaterThan(0);
      expect(result.antiPatterns.filter(p => p.id === 'todo-comment').length).toBeGreaterThanOrEqual(2);
    });

    it('should call progress callback', async () => {
      const service = new AnalysisService();
      const files = [
        { path: 'a.ts', content: 'const a = 1;' },
        { path: 'b.ts', content: 'const b = 2;' },
      ];

      const progressCalls: AnalysisProgress[] = [];

      await service.analyzeRepository('/repo', files, (progress) => {
        progressCalls.push({ ...progress });
      });

      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls.some(p => p.phase === 'discovering')).toBe(true);
      expect(progressCalls.some(p => p.phase === 'complete')).toBe(true);
    });
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      const service = new AnalysisService();

      service.updateConfig({ deepAnalysis: true, maxFileSize: 5000 });

      const config = service.getConfig();
      expect(config.deepAnalysis).toBe(true);
      expect(config.maxFileSize).toBe(5000);
    });

    it('should return a copy of configuration', () => {
      const service = new AnalysisService();

      const config = service.getConfig();
      config.deepAnalysis = true;

      expect(service.getConfig().deepAnalysis).toBe(false);
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      const service1 = getAnalysisService();
      const service2 = getAnalysisService();

      expect(service1).toBe(service2);
    });

    it('should reset instance', () => {
      const service1 = getAnalysisService();
      resetAnalysisService();
      const service2 = getAnalysisService();

      expect(service1).not.toBe(service2);
    });

    it('should update config on existing instance', () => {
      const service1 = getAnalysisService({ deepAnalysis: false });
      const service2 = getAnalysisService({ deepAnalysis: true });

      expect(service1).toBe(service2);
      expect(service2.getConfig().deepAnalysis).toBe(true);
    });
  });

  describe('convenience functions', () => {
    it('should analyze single file', async () => {
      const result = await analyzeFile(
        'test.ts',
        'const x = 1;'
      );

      expect(result.file.path).toBe('test.ts');
    });

    it('should analyze multiple files', async () => {
      const results = await analyzeFiles([
        { path: 'a.ts', content: 'const a = 1;' },
        { path: 'b.ts', content: 'const b = 2;' },
      ]);

      expect(results.length).toBe(2);
    });

    it('should analyze repository', async () => {
      const result = await analyzeRepository('/repo', [
        { path: 'a.ts', content: 'const a = 1;' },
      ], {
        include: ['**/*.ts'],
        exclude: [],
      });

      expect(result.repositoryPath).toBe('/repo');
      expect(result.totalFiles).toBe(1);
    });
  });
});
