/**
 * @package @forge/analysis
 * @description Tests for anti-pattern detection
 */

import { describe, it, expect } from 'vitest';
import {
  detectAntiPatterns,
  detectComplexityAntiPatterns,
  getAvailableDetectors,
  getDetectorInfo,
  countBySeverity,
  countByCategory,
} from '../antipatterns.js';
import { parseSourceCode } from '../parser.js';
import { createSourceFile } from '../language.js';
import { FunctionComplexity, AntiPattern } from '../analysis.types.js';

describe('antipatterns', () => {
  describe('detectAntiPatterns', () => {
    describe('large file detector', () => {
      it('should detect files over 500 lines', () => {
        const content = new Array(600).fill('const x = 1;').join('\n');
        const file = createSourceFile('test.ts', content);
        const parseResult = parseSourceCode(content, 'typescript');

        const patterns = detectAntiPatterns(file, parseResult);

        const largeFile = patterns.find(p => p.id === 'large-file');
        expect(largeFile).toBeDefined();
        expect(largeFile?.severity).toBe('medium');
      });

      it('should set high severity for very large files', () => {
        const content = new Array(1200).fill('const x = 1;').join('\n');
        const file = createSourceFile('test.ts', content);
        const parseResult = parseSourceCode(content, 'typescript');

        const patterns = detectAntiPatterns(file, parseResult);

        const largeFile = patterns.find(p => p.id === 'large-file');
        expect(largeFile?.severity).toBe('high');
      });

      it('should not flag small files', () => {
        const content = 'const x = 1;\nconst y = 2;';
        const file = createSourceFile('test.ts', content);
        const parseResult = parseSourceCode(content, 'typescript');

        const patterns = detectAntiPatterns(file, parseResult);

        const largeFile = patterns.find(p => p.id === 'large-file');
        expect(largeFile).toBeUndefined();
      });
    });

    describe('long function detector', () => {
      it('should detect functions over 50 lines', () => {
        const functionBody = new Array(60).fill('  const x = 1;').join('\n');
        const content = `function longFunction() {\n${functionBody}\n}`;
        const file = createSourceFile('test.ts', content);
        const parseResult = parseSourceCode(content, 'typescript');

        const patterns = detectAntiPatterns(file, parseResult);

        const longFunc = patterns.find(p => p.id === 'long-function');
        expect(longFunc).toBeDefined();
        expect(longFunc?.description).toContain('longFunction');
      });
    });

    describe('many parameters detector', () => {
      it('should detect functions with more than 5 parameters', () => {
        const content = `function manyParams(a, b, c, d, e, f, g) {
  return a + b + c + d + e + f + g;
}`;
        const file = createSourceFile('test.ts', content);
        const parseResult = parseSourceCode(content, 'typescript');

        const patterns = detectAntiPatterns(file, parseResult);

        const manyParams = patterns.find(p => p.id === 'many-parameters');
        expect(manyParams).toBeDefined();
        expect(manyParams?.description).toContain('manyParams');
      });

      it('should not flag functions with few parameters', () => {
        const content = `function fewParams(a, b) {
  return a + b;
}`;
        const file = createSourceFile('test.ts', content);
        const parseResult = parseSourceCode(content, 'typescript');

        const patterns = detectAntiPatterns(file, parseResult);

        const manyParams = patterns.find(p => p.id === 'many-parameters');
        expect(manyParams).toBeUndefined();
      });
    });

    describe('TODO/FIXME detector', () => {
      it('should detect TODO comments', () => {
        const content = `
function test() {
  // TODO: implement this
  return null;
}`;
        const file = createSourceFile('test.ts', content);
        const parseResult = parseSourceCode(content, 'typescript');

        const patterns = detectAntiPatterns(file, parseResult);

        const todo = patterns.find(p => p.id === 'todo-comment');
        expect(todo).toBeDefined();
        expect(todo?.description).toContain('implement this');
      });

      it('should detect FIXME comments', () => {
        const content = `
// FIXME: this is broken
const x = 1;`;
        const file = createSourceFile('test.ts', content);
        const parseResult = parseSourceCode(content, 'typescript');

        const patterns = detectAntiPatterns(file, parseResult);

        const fixme = patterns.find(p => p.id === 'todo-comment' && p.name.includes('FIXME'));
        expect(fixme).toBeDefined();
        expect(fixme?.severity).toBe('medium');
      });

      it('should detect BUG comments', () => {
        const content = `
// BUG: off by one error
for (let i = 0; i <= arr.length; i++) {}`;
        const file = createSourceFile('test.ts', content);
        const parseResult = parseSourceCode(content, 'typescript');

        const patterns = detectAntiPatterns(file, parseResult);

        const bug = patterns.find(p => p.id === 'todo-comment' && p.name.includes('BUG'));
        expect(bug).toBeDefined();
      });
    });

    describe('console log detector', () => {
      it('should detect console.log statements', () => {
        const content = `
function debug() {
  console.log('debug info');
  console.warn('warning');
  console.error('error');
}`;
        const file = createSourceFile('test.ts', content);
        const parseResult = parseSourceCode(content, 'typescript');

        const patterns = detectAntiPatterns(file, parseResult);

        const consoleLogs = patterns.filter(p => p.id === 'console-log');
        expect(consoleLogs.length).toBe(3);
      });

      it('should not flag code without console statements', () => {
        const content = `
function clean() {
  return 42;
}`;
        const file = createSourceFile('test.ts', content);
        const parseResult = parseSourceCode(content, 'typescript');

        const patterns = detectAntiPatterns(file, parseResult);

        const consoleLogs = patterns.filter(p => p.id === 'console-log');
        expect(consoleLogs.length).toBe(0);
      });
    });

    describe('complex condition detector', () => {
      it('should detect complex conditions', () => {
        const content = `
if (a && b && c || d && e) {
  doSomething();
}`;
        const file = createSourceFile('test.ts', content);
        const parseResult = parseSourceCode(content, 'typescript');

        const patterns = detectAntiPatterns(file, parseResult);

        const complex = patterns.find(p => p.id === 'complex-condition');
        expect(complex).toBeDefined();
      });

      it('should not flag simple conditions', () => {
        const content = `
if (a && b) {
  doSomething();
}`;
        const file = createSourceFile('test.ts', content);
        const parseResult = parseSourceCode(content, 'typescript');

        const patterns = detectAntiPatterns(file, parseResult);

        const complex = patterns.find(p => p.id === 'complex-condition');
        expect(complex).toBeUndefined();
      });
    });

    describe('empty catch detector', () => {
      it('should detect empty catch blocks', () => {
        const content = `
try {
  riskyOperation();
} catch (e) {}`;
        const file = createSourceFile('test.ts', content);
        const parseResult = parseSourceCode(content, 'typescript');

        const patterns = detectAntiPatterns(file, parseResult);

        const emptyCatch = patterns.find(p => p.id === 'empty-catch');
        expect(emptyCatch).toBeDefined();
      });

      it('should not flag catch blocks with handling', () => {
        const content = `
try {
  riskyOperation();
} catch (e) {
  console.error(e);
}`;
        const file = createSourceFile('test.ts', content);
        const parseResult = parseSourceCode(content, 'typescript');

        const patterns = detectAntiPatterns(file, parseResult);

        const emptyCatch = patterns.find(p => p.id === 'empty-catch');
        expect(emptyCatch).toBeUndefined();
      });
    });

    describe('duplicate string detector', () => {
      it('should detect duplicate strings', () => {
        const content = `
const a = "This is a long duplicate string";
const b = "This is a long duplicate string";
const c = "This is a long duplicate string";`;
        const file = createSourceFile('test.ts', content);
        const parseResult = parseSourceCode(content, 'typescript');

        const patterns = detectAntiPatterns(file, parseResult);

        const duplicate = patterns.find(p => p.id === 'duplicate-string');
        expect(duplicate).toBeDefined();
      });

      it('should not flag unique strings', () => {
        const content = `
const a = "unique string one";
const b = "unique string two";`;
        const file = createSourceFile('test.ts', content);
        const parseResult = parseSourceCode(content, 'typescript');

        const patterns = detectAntiPatterns(file, parseResult);

        const duplicate = patterns.find(p => p.id === 'duplicate-string');
        expect(duplicate).toBeUndefined();
      });
    });

    describe('hardcoded value detector', () => {
      it('should detect hardcoded URLs', () => {
        const content = `
function makeRequest() {
  fetch("https://api.example.com/data");
}`;
        const file = createSourceFile('test.ts', content);
        const parseResult = parseSourceCode(content, 'typescript');

        const patterns = detectAntiPatterns(file, parseResult);

        const hardcoded = patterns.find(p => p.id === 'hardcoded-value');
        expect(hardcoded).toBeDefined();
      });

      it('should detect hardcoded IP addresses', () => {
        const content = `
function connect() {
  socket.connect("192.168.1.100");
}`;
        const file = createSourceFile('test.ts', content);
        const parseResult = parseSourceCode(content, 'typescript');

        const patterns = detectAntiPatterns(file, parseResult);

        const hardcoded = patterns.find(p => p.id === 'hardcoded-value');
        expect(hardcoded).toBeDefined();
      });

      it('should skip imports and constants', () => {
        const content = `
import axios from 'axios';
export const API_URL = "https://api.example.com";`;
        const file = createSourceFile('test.ts', content);
        const parseResult = parseSourceCode(content, 'typescript');

        const patterns = detectAntiPatterns(file, parseResult);

        const hardcoded = patterns.filter(p => p.id === 'hardcoded-value');
        expect(hardcoded.length).toBe(0);
      });
    });

    describe('filter by enabled detectors', () => {
      it('should only run enabled detectors', () => {
        const content = `
// TODO: fix this
console.log('debug');`;
        const file = createSourceFile('test.ts', content);
        const parseResult = parseSourceCode(content, 'typescript');

        const patterns = detectAntiPatterns(file, parseResult, ['todo-comment']);

        expect(patterns.filter(p => p.id === 'todo-comment').length).toBe(1);
        expect(patterns.filter(p => p.id === 'console-log').length).toBe(0);
      });
    });
  });

  describe('detectComplexityAntiPatterns', () => {
    it('should detect high cyclomatic complexity', () => {
      const functions: FunctionComplexity[] = [
        {
          name: 'complex',
          filePath: 'test.ts',
          startLine: 1,
          endLine: 50,
          linesOfCode: 50,
          cyclomaticComplexity: 15,
          cognitiveComplexity: 12,
          nestingDepth: 3,
          parameterCount: 3,
        },
      ];

      const patterns = detectComplexityAntiPatterns(functions);

      const highComplexity = patterns.find(p => p.id === 'high-complexity');
      expect(highComplexity).toBeDefined();
      expect(highComplexity?.description).toContain('complex');
      expect(highComplexity?.description).toContain('15');
    });

    it('should detect high nesting depth', () => {
      const functions: FunctionComplexity[] = [
        {
          name: 'nested',
          filePath: 'test.ts',
          startLine: 1,
          endLine: 30,
          linesOfCode: 30,
          cyclomaticComplexity: 5,
          cognitiveComplexity: 10,
          nestingDepth: 5,
          parameterCount: 2,
        },
      ];

      const patterns = detectComplexityAntiPatterns(functions);

      const highNesting = patterns.find(p => p.id === 'high-nesting');
      expect(highNesting).toBeDefined();
      expect(highNesting?.description).toContain('nested');
    });

    it('should detect large functions', () => {
      const functions: FunctionComplexity[] = [
        {
          name: 'giant',
          filePath: 'test.ts',
          startLine: 1,
          endLine: 100,
          linesOfCode: 100,
          cyclomaticComplexity: 8,
          cognitiveComplexity: 10,
          nestingDepth: 2,
          parameterCount: 2,
        },
      ];

      const patterns = detectComplexityAntiPatterns(functions);

      const largeFunc = patterns.find(p => p.id === 'large-function');
      expect(largeFunc).toBeDefined();
    });

    it('should detect too many parameters', () => {
      const functions: FunctionComplexity[] = [
        {
          name: 'manyParams',
          filePath: 'test.ts',
          startLine: 1,
          endLine: 10,
          linesOfCode: 10,
          cyclomaticComplexity: 2,
          cognitiveComplexity: 1,
          nestingDepth: 1,
          parameterCount: 8,
        },
      ];

      const patterns = detectComplexityAntiPatterns(functions);

      const tooManyParams = patterns.find(p => p.id === 'too-many-params');
      expect(tooManyParams).toBeDefined();
    });

    it('should not flag compliant functions', () => {
      const functions: FunctionComplexity[] = [
        {
          name: 'good',
          filePath: 'test.ts',
          startLine: 1,
          endLine: 20,
          linesOfCode: 20,
          cyclomaticComplexity: 5,
          cognitiveComplexity: 3,
          nestingDepth: 2,
          parameterCount: 3,
        },
      ];

      const patterns = detectComplexityAntiPatterns(functions);

      expect(patterns.length).toBe(0);
    });
  });

  describe('getAvailableDetectors', () => {
    it('should return list of detector IDs', () => {
      const detectors = getAvailableDetectors();

      expect(detectors).toContain('large-file');
      expect(detectors).toContain('long-function');
      expect(detectors).toContain('deep-nesting');
      expect(detectors).toContain('many-parameters');
      expect(detectors).toContain('todo-comment');
      expect(detectors).toContain('console-log');
      expect(detectors.length).toBeGreaterThan(5);
    });
  });

  describe('getDetectorInfo', () => {
    it('should return detector info by ID', () => {
      const info = getDetectorInfo('large-file');

      expect(info).toBeDefined();
      expect(info?.name).toBe('Large File');
      expect(info?.category).toBe('structure');
      expect(info?.severity).toBe('medium');
    });

    it('should return null for unknown detector', () => {
      const info = getDetectorInfo('unknown-detector');

      expect(info).toBeNull();
    });
  });

  describe('countBySeverity', () => {
    it('should count patterns by severity', () => {
      const patterns: AntiPattern[] = [
        { id: 'a', name: 'A', description: '', category: 'complexity', severity: 'high', filePath: '', line: 1 },
        { id: 'b', name: 'B', description: '', category: 'complexity', severity: 'high', filePath: '', line: 2 },
        { id: 'c', name: 'C', description: '', category: 'complexity', severity: 'medium', filePath: '', line: 3 },
        { id: 'd', name: 'D', description: '', category: 'complexity', severity: 'low', filePath: '', line: 4 },
        { id: 'e', name: 'E', description: '', category: 'complexity', severity: 'low', filePath: '', line: 5 },
        { id: 'f', name: 'F', description: '', category: 'complexity', severity: 'low', filePath: '', line: 6 },
      ];

      const counts = countBySeverity(patterns);

      expect(counts.critical).toBe(0);
      expect(counts.high).toBe(2);
      expect(counts.medium).toBe(1);
      expect(counts.low).toBe(3);
    });
  });

  describe('countByCategory', () => {
    it('should count patterns by category', () => {
      const patterns: AntiPattern[] = [
        { id: 'a', name: 'A', description: '', category: 'complexity', severity: 'low', filePath: '', line: 1 },
        { id: 'b', name: 'B', description: '', category: 'complexity', severity: 'low', filePath: '', line: 2 },
        { id: 'c', name: 'C', description: '', category: 'maintainability', severity: 'low', filePath: '', line: 3 },
        { id: 'd', name: 'D', description: '', category: 'documentation', severity: 'low', filePath: '', line: 4 },
      ];

      const counts = countByCategory(patterns);

      expect(counts.complexity).toBe(2);
      expect(counts.maintainability).toBe(1);
      expect(counts.documentation).toBe(1);
      expect(counts.security).toBe(0);
    });
  });
});
