/**
 * @package @forge/ai-readiness
 * @description Tests for tooling and GitHub readiness detection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  detectTooling,
  detectGitHubReadiness,
  detectTests,
  supportsTypeAnnotations,
  hasStrictTypeConfig,
  createToolingConfig,
  createGitHubReadinessConfig,
  InMemoryFileSystem,
} from '../detection.js';

describe('InMemoryFileSystem', () => {
  it('should check file existence', async () => {
    const fs = new InMemoryFileSystem({
      '/test/file.ts': 'content',
    });

    expect(await fs.exists('/test/file.ts')).toBe(true);
    expect(await fs.exists('/test/missing.ts')).toBe(false);
  });

  it('should read file content', async () => {
    const fs = new InMemoryFileSystem({
      '/test/file.ts': 'const x = 1;',
    });

    const content = await fs.readFile('/test/file.ts');
    expect(content).toBe('const x = 1;');
  });

  it('should throw for missing file', async () => {
    const fs = new InMemoryFileSystem();

    await expect(fs.readFile('/missing.ts')).rejects.toThrow('File not found');
  });

  it('should read directory contents', async () => {
    const fs = new InMemoryFileSystem(
      {},
      {
        '/test': ['file1.ts', 'file2.ts'],
      }
    );

    const contents = await fs.readDir('/test');
    expect(contents).toContain('file1.ts');
    expect(contents).toContain('file2.ts');
  });

  it('should infer directory contents from files', async () => {
    const fs = new InMemoryFileSystem({
      '/test/file1.ts': '',
      '/test/file2.ts': '',
      '/test/subdir/file3.ts': '',
    });

    const contents = await fs.readDir('/test');
    expect(contents).toContain('file1.ts');
    expect(contents).toContain('file2.ts');
    expect(contents).toContain('subdir');
  });

  it('should add files dynamically', async () => {
    const fs = new InMemoryFileSystem();
    fs.addFile('/new/file.ts', 'content');

    expect(await fs.exists('/new/file.ts')).toBe(true);
  });

  it('should add directories dynamically', async () => {
    const fs = new InMemoryFileSystem();
    fs.addDirectory('/new', ['a.ts', 'b.ts']);

    expect(await fs.exists('/new')).toBe(true);
    const contents = await fs.readDir('/new');
    expect(contents).toContain('a.ts');
  });
});

describe('detectTooling', () => {
  let fs: InMemoryFileSystem;

  beforeEach(() => {
    fs = new InMemoryFileSystem();
  });

  it('should detect ESLint config', async () => {
    fs.addFile('/repo/.eslintrc.json', '{}');

    const tooling = await detectTooling('/repo', fs);
    expect(tooling.hasEslint).toBe(true);
  });

  it('should detect ESLint flat config', async () => {
    fs.addFile('/repo/eslint.config.js', 'module.exports = {}');

    const tooling = await detectTooling('/repo', fs);
    expect(tooling.hasEslint).toBe(true);
  });

  it('should detect Prettier config', async () => {
    fs.addFile('/repo/.prettierrc', '{}');

    const tooling = await detectTooling('/repo', fs);
    expect(tooling.hasPrettier).toBe(true);
  });

  it('should detect Pylint config', async () => {
    fs.addFile('/repo/.pylintrc', '[pylint]');

    const tooling = await detectTooling('/repo', fs);
    expect(tooling.hasPylint).toBe(true);
  });

  it('should detect Black config in pyproject.toml', async () => {
    fs.addFile('/repo/pyproject.toml', '[tool.black]\nline-length = 88');

    const tooling = await detectTooling('/repo', fs);
    expect(tooling.hasBlack).toBe(true);
  });

  it('should detect RuboCop config', async () => {
    fs.addFile('/repo/.rubocop.yml', 'Style:');

    const tooling = await detectTooling('/repo', fs);
    expect(tooling.hasRubocop).toBe(true);
  });

  it('should detect GoFmt via go.mod', async () => {
    fs.addFile('/repo/go.mod', 'module example.com');

    const tooling = await detectTooling('/repo', fs);
    expect(tooling.hasGofmt).toBe(true);
  });

  it('should detect npm package manager', async () => {
    fs.addFile('/repo/package.json', '{}');
    fs.addFile('/repo/package-lock.json', '{}');

    const tooling = await detectTooling('/repo', fs);
    expect(tooling.hasPackageManager).toBe(true);
    expect(tooling.packageManager).toBe('npm');
  });

  it('should detect pnpm package manager', async () => {
    fs.addFile('/repo/package.json', '{}');
    fs.addFile('/repo/pnpm-lock.yaml', '');

    const tooling = await detectTooling('/repo', fs);
    expect(tooling.packageManager).toBe('pnpm');
  });

  it('should detect yarn package manager', async () => {
    fs.addFile('/repo/package.json', '{}');
    fs.addFile('/repo/yarn.lock', '');

    const tooling = await detectTooling('/repo', fs);
    expect(tooling.packageManager).toBe('yarn');
  });

  it('should detect pip package manager', async () => {
    fs.addFile('/repo/requirements.txt', 'flask');

    const tooling = await detectTooling('/repo', fs);
    expect(tooling.hasPackageManager).toBe(true);
    expect(tooling.packageManager).toBe('pip');
  });

  it('should detect poetry package manager', async () => {
    fs.addFile('/repo/pyproject.toml', '[tool.poetry]');
    fs.addFile('/repo/poetry.lock', '');

    const tooling = await detectTooling('/repo', fs);
    expect(tooling.packageManager).toBe('poetry');
  });

  it('should detect vite build tool', async () => {
    fs.addFile('/repo/vite.config.ts', 'export default {}');

    const tooling = await detectTooling('/repo', fs);
    expect(tooling.hasBuildTool).toBe(true);
    expect(tooling.buildTool).toBe('vite');
  });

  it('should detect webpack build tool', async () => {
    fs.addFile('/repo/webpack.config.js', 'module.exports = {}');

    const tooling = await detectTooling('/repo', fs);
    expect(tooling.hasBuildTool).toBe(true);
    expect(tooling.buildTool).toBe('webpack');
  });

  it('should detect pre-commit config', async () => {
    fs.addFile('/repo/.pre-commit-config.yaml', 'repos:');

    const tooling = await detectTooling('/repo', fs);
    expect(tooling.hasPreCommitHooks).toBe(true);
  });

  it('should detect Husky', async () => {
    fs.addFile('/repo/.husky/_', '');

    const tooling = await detectTooling('/repo', fs);
    expect(tooling.hasHusky).toBe(true);
    expect(tooling.hasPreCommitHooks).toBe(true);
  });

  it('should detect Husky in package.json', async () => {
    fs.addFile('/repo/package.json', JSON.stringify({ devDependencies: { husky: '^8.0.0' } }));

    const tooling = await detectTooling('/repo', fs);
    expect(tooling.hasHusky).toBe(true);
  });

  it('should return empty config for empty repo', async () => {
    const tooling = await detectTooling('/repo', fs);

    expect(tooling.hasEslint).toBe(false);
    expect(tooling.hasPrettier).toBe(false);
    expect(tooling.hasPackageManager).toBe(false);
    expect(tooling.hasBuildTool).toBe(false);
  });
});

describe('detectGitHubReadiness', () => {
  let fs: InMemoryFileSystem;

  beforeEach(() => {
    fs = new InMemoryFileSystem();
  });

  it('should detect CLAUDE.md', async () => {
    fs.addFile('/repo/CLAUDE.md', '# Claude Instructions');

    const config = await detectGitHubReadiness('/repo', fs);
    expect(config.hasClaudeMd).toBe(true);
  });

  it('should detect CLAUDE.md in .claude directory', async () => {
    fs.addFile('/repo/.claude/CLAUDE.md', '# Claude Instructions');

    const config = await detectGitHubReadiness('/repo', fs);
    expect(config.hasClaudeMd).toBe(true);
  });

  it('should detect .cursorrules', async () => {
    fs.addFile('/repo/.cursorrules', 'rules');

    const config = await detectGitHubReadiness('/repo', fs);
    expect(config.hasCursorRules).toBe(true);
  });

  it('should detect GitHub Actions', async () => {
    fs.addDirectory('/repo/.github/workflows', ['ci.yml']);

    const config = await detectGitHubReadiness('/repo', fs);
    expect(config.hasGitHubActions).toBe(true);
  });

  it('should detect CircleCI', async () => {
    fs.addFile('/repo/.circleci/config.yml', 'version: 2.1');

    const config = await detectGitHubReadiness('/repo', fs);
    expect(config.hasCircleCI).toBe(true);
  });

  it('should detect Jenkins', async () => {
    fs.addFile('/repo/Jenkinsfile', 'pipeline {}');

    const config = await detectGitHubReadiness('/repo', fs);
    expect(config.hasJenkins).toBe(true);
  });

  it('should detect PR template', async () => {
    fs.addFile('/repo/.github/PULL_REQUEST_TEMPLATE.md', '## Description');

    const config = await detectGitHubReadiness('/repo', fs);
    expect(config.hasPrTemplate).toBe(true);
  });

  it('should detect issue templates', async () => {
    fs.addDirectory('/repo/.github/ISSUE_TEMPLATE', ['bug.yml']);

    const config = await detectGitHubReadiness('/repo', fs);
    expect(config.hasIssueTemplates).toBe(true);
  });

  it('should detect CONTRIBUTING.md', async () => {
    fs.addFile('/repo/CONTRIBUTING.md', '# Contributing');

    const config = await detectGitHubReadiness('/repo', fs);
    expect(config.hasContributing).toBe(true);
  });

  it('should detect README.md', async () => {
    fs.addFile('/repo/README.md', '# Project');

    const config = await detectGitHubReadiness('/repo', fs);
    expect(config.hasReadme).toBe(true);
  });

  it('should detect CODEOWNERS', async () => {
    fs.addFile('/repo/.github/CODEOWNERS', '* @owner');

    const config = await detectGitHubReadiness('/repo', fs);
    expect(config.hasCodeowners).toBe(true);
  });

  it('should detect ADRs', async () => {
    fs.addDirectory('/repo/docs/adr', ['001-initial.md']);

    const config = await detectGitHubReadiness('/repo', fs);
    expect(config.hasADRs).toBe(true);
  });

  it('should detect ADRs in tools/adrs', async () => {
    fs.addDirectory('/repo/tools/adrs', ['ADR-001.md']);

    const config = await detectGitHubReadiness('/repo', fs);
    expect(config.hasADRs).toBe(true);
  });

  it('should return empty config for empty repo', async () => {
    const config = await detectGitHubReadiness('/repo', fs);

    expect(config.hasClaudeMd).toBe(false);
    expect(config.hasGitHubActions).toBe(false);
    expect(config.hasReadme).toBe(false);
    expect(config.hasADRs).toBe(false);
  });
});

describe('detectTests', () => {
  let fs: InMemoryFileSystem;

  beforeEach(() => {
    fs = new InMemoryFileSystem();
  });

  it('should detect __tests__ directory', async () => {
    fs.addDirectory('/repo/__tests__', ['test.ts']);

    const { hasUnitTests } = await detectTests('/repo', fs);
    expect(hasUnitTests).toBe(true);
  });

  it('should detect tests directory', async () => {
    fs.addDirectory('/repo/tests', ['test.ts']);

    const { hasUnitTests } = await detectTests('/repo', fs);
    expect(hasUnitTests).toBe(true);
  });

  it('should detect integration tests', async () => {
    fs.addDirectory('/repo/integration', ['test.ts']);

    const { hasIntegrationTests } = await detectTests('/repo', fs);
    expect(hasIntegrationTests).toBe(true);
  });

  it('should detect E2E tests', async () => {
    fs.addDirectory('/repo/e2e', ['test.ts']);

    const { hasE2ETests } = await detectTests('/repo', fs);
    expect(hasE2ETests).toBe(true);
  });

  it('should detect cypress', async () => {
    fs.addFile('/repo/cypress.config.ts', 'export default {}');

    const { hasE2ETests } = await detectTests('/repo', fs);
    expect(hasE2ETests).toBe(true);
  });

  it('should detect playwright', async () => {
    fs.addFile('/repo/playwright.config.ts', 'export default {}');

    const { hasE2ETests } = await detectTests('/repo', fs);
    expect(hasE2ETests).toBe(true);
  });

  it('should detect jest config', async () => {
    fs.addFile('/repo/jest.config.ts', 'export default {}');

    const { hasUnitTests } = await detectTests('/repo', fs);
    expect(hasUnitTests).toBe(true);
  });

  it('should detect vitest config', async () => {
    fs.addFile('/repo/vitest.config.ts', 'export default {}');

    const { hasUnitTests } = await detectTests('/repo', fs);
    expect(hasUnitTests).toBe(true);
  });

  it('should detect pytest', async () => {
    fs.addFile('/repo/pytest.ini', '[pytest]');

    const { hasUnitTests } = await detectTests('/repo', fs);
    expect(hasUnitTests).toBe(true);
  });
});

describe('supportsTypeAnnotations', () => {
  it('should return true for TypeScript', () => {
    expect(supportsTypeAnnotations('typescript')).toBe(true);
  });

  it('should return true for Python', () => {
    expect(supportsTypeAnnotations('python')).toBe(true);
  });

  it('should return true for Java', () => {
    expect(supportsTypeAnnotations('java')).toBe(true);
  });

  it('should return true for Go', () => {
    expect(supportsTypeAnnotations('go')).toBe(true);
  });

  it('should return true for Rust', () => {
    expect(supportsTypeAnnotations('rust')).toBe(true);
  });

  it('should return false for JavaScript', () => {
    expect(supportsTypeAnnotations('javascript')).toBe(false);
  });

  it('should return false for Ruby', () => {
    expect(supportsTypeAnnotations('ruby')).toBe(false);
  });
});

describe('hasStrictTypeConfig', () => {
  let fs: InMemoryFileSystem;

  beforeEach(() => {
    fs = new InMemoryFileSystem();
  });

  it('should detect strict TypeScript config', async () => {
    fs.addFile(
      '/repo/tsconfig.json',
      JSON.stringify({ compilerOptions: { strict: true } })
    );

    const result = await hasStrictTypeConfig('/repo', 'typescript', fs);
    expect(result).toBe(true);
  });

  it('should return false for non-strict TypeScript', async () => {
    fs.addFile(
      '/repo/tsconfig.json',
      JSON.stringify({ compilerOptions: { strict: false } })
    );

    const result = await hasStrictTypeConfig('/repo', 'typescript', fs);
    expect(result).toBe(false);
  });

  it('should detect mypy for Python', async () => {
    fs.addFile('/repo/mypy.ini', '[mypy]');

    const result = await hasStrictTypeConfig('/repo', 'python', fs);
    expect(result).toBe(true);
  });

  it('should detect mypy in pyproject.toml', async () => {
    fs.addFile('/repo/pyproject.toml', '[tool.mypy]\nstrict = true');

    const result = await hasStrictTypeConfig('/repo', 'python', fs);
    expect(result).toBe(true);
  });

  it('should return false for unsupported language', async () => {
    const result = await hasStrictTypeConfig('/repo', 'ruby', fs);
    expect(result).toBe(false);
  });
});

describe('createToolingConfig', () => {
  it('should create default config', () => {
    const config = createToolingConfig();

    expect(config.hasEslint).toBe(false);
    expect(config.hasPrettier).toBe(false);
    expect(config.hasPackageManager).toBe(false);
  });

  it('should merge overrides', () => {
    const config = createToolingConfig({
      hasEslint: true,
      hasPrettier: true,
    });

    expect(config.hasEslint).toBe(true);
    expect(config.hasPrettier).toBe(true);
    expect(config.hasPackageManager).toBe(false);
  });
});

describe('createGitHubReadinessConfig', () => {
  it('should create default config', () => {
    const config = createGitHubReadinessConfig();

    expect(config.hasClaudeMd).toBe(false);
    expect(config.hasGitHubActions).toBe(false);
    expect(config.hasReadme).toBe(false);
  });

  it('should merge overrides', () => {
    const config = createGitHubReadinessConfig({
      hasClaudeMd: true,
      hasReadme: true,
    });

    expect(config.hasClaudeMd).toBe(true);
    expect(config.hasReadme).toBe(true);
    expect(config.hasGitHubActions).toBe(false);
  });
});
