/**
 * @package @forge/analysis
 * @description Tests for language detection and file utilities
 */

import { describe, it, expect } from 'vitest';
import {
  detectLanguage,
  getFileExtension,
  getLanguageTier,
  isLanguageSupported,
  getSupportedExtensions,
  getExtensionsForLanguage,
  createSourceFile,
  groupFilesByLanguage,
  filterByLanguageTier,
  shouldIncludeFile,
  matchPattern,
  getLanguageStatistics,
  detectPrimaryLanguage,
  isTestFile,
  isConfigFile,
  isGeneratedFile,
} from '../language.js';
import { SourceFile } from '../analysis.types.js';

describe('language', () => {
  describe('detectLanguage', () => {
    it('should detect TypeScript files', () => {
      expect(detectLanguage('file.ts')).toBe('typescript');
      expect(detectLanguage('file.tsx')).toBe('typescript');
      expect(detectLanguage('/path/to/component.tsx')).toBe('typescript');
    });

    it('should detect JavaScript files', () => {
      expect(detectLanguage('file.js')).toBe('javascript');
      expect(detectLanguage('file.jsx')).toBe('javascript');
      expect(detectLanguage('file.mjs')).toBe('javascript');
      expect(detectLanguage('file.cjs')).toBe('javascript');
    });

    it('should detect Python files', () => {
      expect(detectLanguage('script.py')).toBe('python');
      expect(detectLanguage('script.pyw')).toBe('python');
    });

    it('should detect Java files', () => {
      expect(detectLanguage('Main.java')).toBe('java');
    });

    it('should detect Go files', () => {
      expect(detectLanguage('main.go')).toBe('go');
    });

    it('should detect C# files', () => {
      expect(detectLanguage('Program.cs')).toBe('csharp');
    });

    it('should detect secondary languages', () => {
      expect(detectLanguage('app.rb')).toBe('ruby');
      expect(detectLanguage('index.php')).toBe('php');
      expect(detectLanguage('main.rs')).toBe('rust');
      expect(detectLanguage('App.kt')).toBe('kotlin');
      expect(detectLanguage('App.swift')).toBe('swift');
    });

    it('should detect legacy languages', () => {
      expect(detectLanguage('program.cob')).toBe('cobol');
      expect(detectLanguage('program.cbl')).toBe('cobol');
    });

    it('should return unknown for unsupported extensions', () => {
      expect(detectLanguage('file.xyz')).toBe('unknown');
      expect(detectLanguage('file')).toBe('unknown');
    });

    it('should handle case insensitivity', () => {
      expect(detectLanguage('FILE.TS')).toBe('typescript');
      expect(detectLanguage('FILE.PY')).toBe('python');
    });
  });

  describe('getFileExtension', () => {
    it('should extract file extension', () => {
      expect(getFileExtension('file.ts')).toBe('.ts');
      expect(getFileExtension('/path/to/file.tsx')).toBe('.tsx');
      expect(getFileExtension('file.test.ts')).toBe('.ts');
    });

    it('should return empty for files without extension', () => {
      expect(getFileExtension('Makefile')).toBe('');
      expect(getFileExtension('README')).toBe('');
    });

    it('should handle trailing dots', () => {
      expect(getFileExtension('file.')).toBe('');
    });
  });

  describe('getLanguageTier', () => {
    it('should return primary for primary languages', () => {
      expect(getLanguageTier('typescript')).toBe('primary');
      expect(getLanguageTier('javascript')).toBe('primary');
      expect(getLanguageTier('python')).toBe('primary');
      expect(getLanguageTier('java')).toBe('primary');
      expect(getLanguageTier('go')).toBe('primary');
      expect(getLanguageTier('csharp')).toBe('primary');
    });

    it('should return secondary for secondary languages', () => {
      expect(getLanguageTier('ruby')).toBe('secondary');
      expect(getLanguageTier('php')).toBe('secondary');
      expect(getLanguageTier('rust')).toBe('secondary');
      expect(getLanguageTier('kotlin')).toBe('secondary');
      expect(getLanguageTier('swift')).toBe('secondary');
    });

    it('should return legacy for legacy languages', () => {
      expect(getLanguageTier('cobol')).toBe('legacy');
    });

    it('should return unknown for unknown language', () => {
      expect(getLanguageTier('unknown')).toBe('unknown');
    });
  });

  describe('isLanguageSupported', () => {
    it('should return true for supported languages', () => {
      expect(isLanguageSupported('typescript')).toBe(true);
      expect(isLanguageSupported('python')).toBe(true);
    });

    it('should return false for unsupported languages', () => {
      expect(isLanguageSupported('fortran' as any)).toBe(false);
    });
  });

  describe('getSupportedExtensions', () => {
    it('should return all supported extensions', () => {
      const extensions = getSupportedExtensions();
      expect(extensions).toContain('.ts');
      expect(extensions).toContain('.tsx');
      expect(extensions).toContain('.py');
      expect(extensions).toContain('.java');
      expect(extensions.length).toBeGreaterThan(10);
    });
  });

  describe('getExtensionsForLanguage', () => {
    it('should return extensions for TypeScript', () => {
      const extensions = getExtensionsForLanguage('typescript');
      expect(extensions).toContain('.ts');
      expect(extensions).toContain('.tsx');
      expect(extensions).not.toContain('.js');
    });

    it('should return extensions for JavaScript', () => {
      const extensions = getExtensionsForLanguage('javascript');
      expect(extensions).toContain('.js');
      expect(extensions).toContain('.jsx');
      expect(extensions).toContain('.mjs');
    });

    it('should return empty for unknown', () => {
      const extensions = getExtensionsForLanguage('unknown');
      expect(extensions).toHaveLength(0);
    });
  });

  describe('createSourceFile', () => {
    it('should create source file with detected language', () => {
      const content = 'const x = 1;';
      const file = createSourceFile('/path/to/file.ts', content);

      expect(file.path).toBe('/path/to/file.ts');
      expect(file.content).toBe(content);
      expect(file.language).toBe('typescript');
      expect(file.extension).toBe('.ts');
      expect(file.size).toBe(Buffer.byteLength(content, 'utf8'));
    });

    it('should handle UTF-8 content correctly', () => {
      const content = 'const emoji = "🚀";';
      const file = createSourceFile('file.js', content);

      expect(file.size).toBe(Buffer.byteLength(content, 'utf8'));
    });
  });

  describe('groupFilesByLanguage', () => {
    it('should group files by language', () => {
      const files: SourceFile[] = [
        createSourceFile('a.ts', 'const a = 1;'),
        createSourceFile('b.ts', 'const b = 2;'),
        createSourceFile('c.py', 'x = 1'),
        createSourceFile('d.java', 'class D {}'),
      ];

      const groups = groupFilesByLanguage(files);

      expect(groups.get('typescript')?.length).toBe(2);
      expect(groups.get('python')?.length).toBe(1);
      expect(groups.get('java')?.length).toBe(1);
    });

    it('should handle empty array', () => {
      const groups = groupFilesByLanguage([]);
      expect(groups.size).toBe(0);
    });
  });

  describe('filterByLanguageTier', () => {
    it('should filter files by tier', () => {
      const files: SourceFile[] = [
        createSourceFile('a.ts', 'const a = 1;'),
        createSourceFile('b.rb', 'x = 1'),
        createSourceFile('c.cob', 'DATA DIVISION'),
      ];

      const primary = filterByLanguageTier(files, 'primary');
      expect(primary.length).toBe(1);
      expect(primary[0]?.language).toBe('typescript');

      const secondary = filterByLanguageTier(files, 'secondary');
      expect(secondary.length).toBe(1);
      expect(secondary[0]?.language).toBe('ruby');

      const legacy = filterByLanguageTier(files, 'legacy');
      expect(legacy.length).toBe(1);
      expect(legacy[0]?.language).toBe('cobol');
    });
  });

  describe('shouldIncludeFile', () => {
    it('should include files matching include patterns', () => {
      expect(shouldIncludeFile('src/file.ts', ['**/*.ts'], [])).toBe(true);
      expect(shouldIncludeFile('src/file.js', ['**/*.ts'], [])).toBe(false);
    });

    it('should exclude files matching exclude patterns', () => {
      expect(shouldIncludeFile('node_modules/file.ts', ['**/*.ts'], ['**/node_modules/**'])).toBe(false);
      expect(shouldIncludeFile('src/file.ts', ['**/*.ts'], ['**/node_modules/**'])).toBe(true);
    });

    it('should include all when no include patterns', () => {
      expect(shouldIncludeFile('any/file.xyz', [], [])).toBe(true);
    });

    it('should handle multiple patterns', () => {
      expect(shouldIncludeFile('src/file.ts', ['**/*.ts', '**/*.js'], [])).toBe(true);
      expect(shouldIncludeFile('src/file.py', ['**/*.ts', '**/*.js'], [])).toBe(false);
    });
  });

  describe('matchPattern', () => {
    it('should match glob patterns', () => {
      expect(matchPattern('file.ts', '*.ts')).toBe(true);
      expect(matchPattern('src/file.ts', '**/*.ts')).toBe(true);
      expect(matchPattern('src/deep/file.ts', '**/file.ts')).toBe(true);
    });

    it('should not match non-matching patterns', () => {
      expect(matchPattern('file.js', '*.ts')).toBe(false);
      expect(matchPattern('src/file.js', '**/*.ts')).toBe(false);
    });

    it('should handle single character wildcard', () => {
      expect(matchPattern('file1.ts', 'file?.ts')).toBe(true);
      expect(matchPattern('file10.ts', 'file?.ts')).toBe(false);
    });

    it('should handle Windows paths', () => {
      expect(matchPattern('src\\file.ts', '**/*.ts')).toBe(true);
    });
  });

  describe('getLanguageStatistics', () => {
    it('should calculate language statistics', () => {
      const files: SourceFile[] = [
        createSourceFile('a.ts', 'const a = 1;'),
        createSourceFile('b.ts', 'const b = 2;'),
        createSourceFile('c.py', 'x = 1'),
      ];

      const stats = getLanguageStatistics(files);

      expect(stats.length).toBe(2);
      expect(stats[0]?.language).toBe('typescript');
      expect(stats[0]?.count).toBe(2);
      expect(stats[1]?.language).toBe('python');
      expect(stats[1]?.count).toBe(1);
    });

    it('should sort by count descending', () => {
      const files: SourceFile[] = [
        createSourceFile('a.py', 'x = 1'),
        createSourceFile('b.ts', 'const a = 1;'),
        createSourceFile('c.ts', 'const b = 2;'),
        createSourceFile('d.ts', 'const c = 3;'),
      ];

      const stats = getLanguageStatistics(files);

      expect(stats[0]?.language).toBe('typescript');
      expect(stats[1]?.language).toBe('python');
    });
  });

  describe('detectPrimaryLanguage', () => {
    it('should detect primary language by file count', () => {
      const files: SourceFile[] = [
        createSourceFile('a.ts', 'const a = 1;'),
        createSourceFile('b.ts', 'const b = 2;'),
        createSourceFile('c.py', 'x = 1'),
      ];

      expect(detectPrimaryLanguage(files)).toBe('typescript');
    });

    it('should return unknown for empty files', () => {
      expect(detectPrimaryLanguage([])).toBe('unknown');
    });
  });

  describe('isTestFile', () => {
    it('should detect test files', () => {
      expect(isTestFile('file.test.ts')).toBe(true);
      expect(isTestFile('file.spec.ts')).toBe(true);
      expect(isTestFile('test_file.py')).toBe(true);
      expect(isTestFile('file_test.py')).toBe(true);
      expect(isTestFile('FileTest.java')).toBe(true);
      expect(isTestFile('src/__tests__/file.ts')).toBe(true);
      expect(isTestFile('tests/file.ts')).toBe(true);
    });

    it('should not detect non-test files', () => {
      expect(isTestFile('file.ts')).toBe(false);
      expect(isTestFile('testing.ts')).toBe(false);
      expect(isTestFile('src/file.ts')).toBe(false);
    });
  });

  describe('isConfigFile', () => {
    it('should detect config files', () => {
      expect(isConfigFile('vite.config.ts')).toBe(true);
      expect(isConfigFile('tsconfig.json')).toBe(true);
      expect(isConfigFile('package.json')).toBe(true);
      expect(isConfigFile('.eslintrc.js')).toBe(true);
      expect(isConfigFile('jest.config.ts')).toBe(true);
      expect(isConfigFile('vitest.config.ts')).toBe(true);
      expect(isConfigFile('webpack.config.js')).toBe(true);
    });

    it('should not detect non-config files', () => {
      expect(isConfigFile('src/config.ts')).toBe(false);
      expect(isConfigFile('config/settings.ts')).toBe(false);
    });
  });

  describe('isGeneratedFile', () => {
    it('should detect generated files', () => {
      expect(isGeneratedFile('file.d.ts')).toBe(true);
      expect(isGeneratedFile('bundle.min.js')).toBe(true);
      expect(isGeneratedFile('dist/file.js')).toBe(true);
      expect(isGeneratedFile('build/output.js')).toBe(true);
      expect(isGeneratedFile('generated/types.ts')).toBe(true);
      expect(isGeneratedFile('file.generated.ts')).toBe(true);
    });

    it('should not detect non-generated files', () => {
      expect(isGeneratedFile('src/file.ts')).toBe(false);
      expect(isGeneratedFile('lib/utils.ts')).toBe(false);
    });
  });
});
