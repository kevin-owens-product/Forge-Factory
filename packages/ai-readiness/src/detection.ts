/**
 * @package @forge/ai-readiness
 * @description Tooling and GitHub readiness detection for AI-readiness assessment
 */

import type { ToolingConfig, GitHubReadinessConfig } from './ai-readiness.types.js';

/**
 * File system abstraction for testing
 */
export interface FileSystem {
  exists(path: string): Promise<boolean>;
  readFile(path: string): Promise<string>;
  readDir(path: string): Promise<string[]>;
}

/**
 * Default file system implementation using in-memory simulation
 * In production, this would use actual file system operations
 */
export class InMemoryFileSystem implements FileSystem {
  private files: Map<string, string> = new Map();
  private directories: Map<string, string[]> = new Map();

  constructor(files: Record<string, string> = {}, directories: Record<string, string[]> = {}) {
    for (const [path, content] of Object.entries(files)) {
      this.files.set(path, content);
    }
    for (const [path, contents] of Object.entries(directories)) {
      this.directories.set(path, contents);
    }
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path) || this.directories.has(path);
  }

  async readFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }

  async readDir(path: string): Promise<string[]> {
    const contents = this.directories.get(path);
    if (contents === undefined) {
      // Return files that match the directory prefix
      const matches: string[] = [];
      for (const filePath of this.files.keys()) {
        if (filePath.startsWith(path + '/')) {
          const relative = filePath.slice(path.length + 1);
          const firstPart = relative.split('/')[0];
          if (firstPart && !matches.includes(firstPart)) {
            matches.push(firstPart);
          }
        }
      }
      return matches;
    }
    return contents;
  }

  addFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  addDirectory(path: string, contents: string[]): void {
    this.directories.set(path, contents);
  }
}

/**
 * Detect tooling configuration in a repository
 */
export async function detectTooling(
  repoPath: string,
  fs: FileSystem
): Promise<ToolingConfig> {
  const config: ToolingConfig = {
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

  // ESLint detection
  const eslintFiles = [
    '.eslintrc',
    '.eslintrc.js',
    '.eslintrc.cjs',
    '.eslintrc.json',
    '.eslintrc.yml',
    '.eslintrc.yaml',
    'eslint.config.js',
    'eslint.config.mjs',
  ];
  for (const file of eslintFiles) {
    if (await fs.exists(`${repoPath}/${file}`)) {
      config.hasEslint = true;
      break;
    }
  }

  // Prettier detection
  const prettierFiles = [
    '.prettierrc',
    '.prettierrc.js',
    '.prettierrc.cjs',
    '.prettierrc.json',
    '.prettierrc.yml',
    '.prettierrc.yaml',
    'prettier.config.js',
    'prettier.config.mjs',
  ];
  for (const file of prettierFiles) {
    if (await fs.exists(`${repoPath}/${file}`)) {
      config.hasPrettier = true;
      break;
    }
  }

  // Pylint detection
  const pylintFiles = ['.pylintrc', 'pylintrc', 'pyproject.toml', 'setup.cfg'];
  for (const file of pylintFiles) {
    if (await fs.exists(`${repoPath}/${file}`)) {
      try {
        const content = await fs.readFile(`${repoPath}/${file}`);
        if (content.includes('[pylint') || content.includes('pylint') || file === '.pylintrc' || file === 'pylintrc') {
          config.hasPylint = true;
          break;
        }
      } catch {
        // File might not be readable
      }
    }
  }

  // Black detection
  if (await fs.exists(`${repoPath}/pyproject.toml`)) {
    try {
      const content = await fs.readFile(`${repoPath}/pyproject.toml`);
      if (content.includes('[tool.black]')) {
        config.hasBlack = true;
      }
    } catch {
      // File might not be readable
    }
  }

  // RuboCop detection
  if (await fs.exists(`${repoPath}/.rubocop.yml`) || await fs.exists(`${repoPath}/.rubocop.yaml`)) {
    config.hasRubocop = true;
  }

  // Go fmt (implicit if go.mod exists)
  if (await fs.exists(`${repoPath}/go.mod`)) {
    config.hasGofmt = true;
  }

  // Package Manager detection
  if (await fs.exists(`${repoPath}/package.json`)) {
    config.hasPackageManager = true;
    // Determine which package manager
    if (await fs.exists(`${repoPath}/pnpm-lock.yaml`)) {
      config.packageManager = 'pnpm';
    } else if (await fs.exists(`${repoPath}/yarn.lock`)) {
      config.packageManager = 'yarn';
    } else if (await fs.exists(`${repoPath}/package-lock.json`)) {
      config.packageManager = 'npm';
    } else {
      config.packageManager = 'npm';
    }
  } else if (await fs.exists(`${repoPath}/requirements.txt`) || await fs.exists(`${repoPath}/pyproject.toml`)) {
    config.hasPackageManager = true;
    if (await fs.exists(`${repoPath}/poetry.lock`)) {
      config.packageManager = 'poetry';
    } else {
      config.packageManager = 'pip';
    }
  } else if (await fs.exists(`${repoPath}/go.mod`)) {
    config.hasPackageManager = true;
    config.packageManager = 'go';
  } else if (await fs.exists(`${repoPath}/pom.xml`)) {
    config.hasPackageManager = true;
    config.packageManager = 'maven';
  } else if (await fs.exists(`${repoPath}/build.gradle`) || await fs.exists(`${repoPath}/build.gradle.kts`)) {
    config.hasPackageManager = true;
    config.packageManager = 'gradle';
  }

  // Build Tool detection
  const buildTools = [
    { file: 'webpack.config.js', tool: 'webpack' },
    { file: 'webpack.config.ts', tool: 'webpack' },
    { file: 'vite.config.js', tool: 'vite' },
    { file: 'vite.config.ts', tool: 'vite' },
    { file: 'rollup.config.js', tool: 'rollup' },
    { file: 'esbuild.config.js', tool: 'esbuild' },
    { file: 'tsup.config.ts', tool: 'tsup' },
    { file: 'Makefile', tool: 'make' },
    { file: 'CMakeLists.txt', tool: 'cmake' },
    { file: 'build.gradle', tool: 'gradle' },
    { file: 'build.gradle.kts', tool: 'gradle' },
    { file: 'pom.xml', tool: 'maven' },
    { file: 'Cargo.toml', tool: 'cargo' },
  ];

  for (const { file, tool } of buildTools) {
    if (await fs.exists(`${repoPath}/${file}`)) {
      config.hasBuildTool = true;
      config.buildTool = tool;
      break;
    }
  }

  // Pre-commit hooks detection
  if (await fs.exists(`${repoPath}/.pre-commit-config.yaml`) || await fs.exists(`${repoPath}/.pre-commit-config.yml`)) {
    config.hasPreCommitHooks = true;
  }

  // Husky detection
  if (await fs.exists(`${repoPath}/.husky`) || await fs.exists(`${repoPath}/.husky/_`)) {
    config.hasHusky = true;
    config.hasPreCommitHooks = true;
  }

  // Check package.json for husky config
  if (await fs.exists(`${repoPath}/package.json`)) {
    try {
      const content = await fs.readFile(`${repoPath}/package.json`);
      const pkg = JSON.parse(content);
      if (pkg.husky || pkg.devDependencies?.husky || pkg.dependencies?.husky) {
        config.hasHusky = true;
        config.hasPreCommitHooks = true;
      }
    } catch {
      // Invalid JSON
    }
  }

  return config;
}

/**
 * Detect GitHub/DevOps readiness configuration in a repository
 */
export async function detectGitHubReadiness(
  repoPath: string,
  fs: FileSystem
): Promise<GitHubReadinessConfig> {
  const config: GitHubReadinessConfig = {
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

  // CLAUDE.md detection
  if (await fs.exists(`${repoPath}/CLAUDE.md`) || await fs.exists(`${repoPath}/.claude/CLAUDE.md`)) {
    config.hasClaudeMd = true;
  }

  // .cursorrules detection
  if (await fs.exists(`${repoPath}/.cursorrules`)) {
    config.hasCursorRules = true;
  }

  // GitHub Actions detection
  if (await fs.exists(`${repoPath}/.github/workflows`)) {
    try {
      const contents = await fs.readDir(`${repoPath}/.github/workflows`);
      if (contents.some(f => f.endsWith('.yml') || f.endsWith('.yaml'))) {
        config.hasGitHubActions = true;
      }
    } catch {
      // Directory might not be readable
    }
  }

  // CircleCI detection
  if (await fs.exists(`${repoPath}/.circleci/config.yml`) || await fs.exists(`${repoPath}/.circleci/config.yaml`)) {
    config.hasCircleCI = true;
  }

  // Jenkins detection
  if (await fs.exists(`${repoPath}/Jenkinsfile`) || await fs.exists(`${repoPath}/jenkins/Jenkinsfile`)) {
    config.hasJenkins = true;
  }

  // PR Template detection
  const prTemplateLocations = [
    '.github/PULL_REQUEST_TEMPLATE.md',
    '.github/pull_request_template.md',
    'PULL_REQUEST_TEMPLATE.md',
    'docs/PULL_REQUEST_TEMPLATE.md',
  ];
  for (const location of prTemplateLocations) {
    if (await fs.exists(`${repoPath}/${location}`)) {
      config.hasPrTemplate = true;
      break;
    }
  }

  // Issue Templates detection
  if (await fs.exists(`${repoPath}/.github/ISSUE_TEMPLATE`)) {
    config.hasIssueTemplates = true;
  } else if (await fs.exists(`${repoPath}/.github/ISSUE_TEMPLATE.md`)) {
    config.hasIssueTemplates = true;
  }

  // Contributing guide detection
  const contributingLocations = [
    'CONTRIBUTING.md',
    '.github/CONTRIBUTING.md',
    'docs/CONTRIBUTING.md',
  ];
  for (const location of contributingLocations) {
    if (await fs.exists(`${repoPath}/${location}`)) {
      config.hasContributing = true;
      break;
    }
  }

  // Branch protection detection (via settings files)
  if (await fs.exists(`${repoPath}/.github/settings.yml`) || await fs.exists(`${repoPath}/.github/settings.yaml`)) {
    try {
      const content = await fs.readFile(`${repoPath}/.github/settings.yml`) ||
        await fs.readFile(`${repoPath}/.github/settings.yaml`);
      if (content.includes('branch') && content.includes('protection')) {
        config.hasBranchProtection = true;
      }
    } catch {
      // File might not be readable
    }
  }

  // README detection
  const readmeLocations = ['README.md', 'readme.md', 'README', 'README.txt'];
  for (const location of readmeLocations) {
    if (await fs.exists(`${repoPath}/${location}`)) {
      config.hasReadme = true;
      break;
    }
  }

  // CODEOWNERS detection
  const codeownersLocations = [
    'CODEOWNERS',
    '.github/CODEOWNERS',
    'docs/CODEOWNERS',
  ];
  for (const location of codeownersLocations) {
    if (await fs.exists(`${repoPath}/${location}`)) {
      config.hasCodeowners = true;
      break;
    }
  }

  // ADRs detection
  const adrLocations = [
    'docs/adr',
    'docs/adrs',
    'adr',
    'adrs',
    'docs/architecture/decisions',
    'tools/adrs',
  ];
  for (const location of adrLocations) {
    if (await fs.exists(`${repoPath}/${location}`)) {
      try {
        const contents = await fs.readDir(`${repoPath}/${location}`);
        if (contents.some(f => f.endsWith('.md'))) {
          config.hasADRs = true;
          break;
        }
      } catch {
        // Directory might not be readable
      }
    }
  }

  return config;
}

/**
 * Create tooling config from detected files (simplified for testing)
 */
export function createToolingConfig(
  options: Partial<ToolingConfig> = {}
): ToolingConfig {
  return {
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
    ...options,
  };
}

/**
 * Create GitHub readiness config from detected files (simplified for testing)
 */
export function createGitHubReadinessConfig(
  options: Partial<GitHubReadinessConfig> = {}
): GitHubReadinessConfig {
  return {
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
    ...options,
  };
}

/**
 * Detect test presence in repository
 */
export async function detectTests(
  repoPath: string,
  fs: FileSystem
): Promise<{ hasUnitTests: boolean; hasIntegrationTests: boolean; hasE2ETests: boolean }> {
  let hasUnitTests = false;
  let hasIntegrationTests = false;
  let hasE2ETests = false;

  // Check for test directories
  const testDirs = ['__tests__', 'tests', 'test', 'spec', 'specs'];
  for (const dir of testDirs) {
    if (await fs.exists(`${repoPath}/${dir}`)) {
      hasUnitTests = true;
      break;
    }
    if (await fs.exists(`${repoPath}/src/${dir}`)) {
      hasUnitTests = true;
      break;
    }
  }

  // Check for integration test directories
  const integrationDirs = ['integration', 'integration-tests', 'tests/integration'];
  for (const dir of integrationDirs) {
    if (await fs.exists(`${repoPath}/${dir}`)) {
      hasIntegrationTests = true;
      break;
    }
  }

  // Check for E2E test directories
  const e2eDirs = ['e2e', 'e2e-tests', 'tests/e2e', 'cypress', 'playwright'];
  for (const dir of e2eDirs) {
    if (await fs.exists(`${repoPath}/${dir}`)) {
      hasE2ETests = true;
      break;
    }
  }

  // Check test config files
  const testConfigs = [
    'jest.config.js',
    'jest.config.ts',
    'vitest.config.js',
    'vitest.config.ts',
    'karma.conf.js',
    'pytest.ini',
    'setup.py',
    'conftest.py',
  ];
  for (const config of testConfigs) {
    if (await fs.exists(`${repoPath}/${config}`)) {
      hasUnitTests = true;
      break;
    }
  }

  // Check for cypress/playwright
  if (await fs.exists(`${repoPath}/cypress.config.js`) ||
    await fs.exists(`${repoPath}/cypress.config.ts`) ||
    await fs.exists(`${repoPath}/playwright.config.js`) ||
    await fs.exists(`${repoPath}/playwright.config.ts`)) {
    hasE2ETests = true;
  }

  return { hasUnitTests, hasIntegrationTests, hasE2ETests };
}

/**
 * Detect if language supports type annotations
 */
export function supportsTypeAnnotations(primaryLanguage: string): boolean {
  const typedLanguages = [
    'typescript',
    'python',
    'java',
    'csharp',
    'go',
    'rust',
    'kotlin',
    'swift',
  ];
  return typedLanguages.includes(primaryLanguage.toLowerCase());
}

/**
 * Check if repository has strict type configuration
 */
export async function hasStrictTypeConfig(
  repoPath: string,
  language: string,
  fs: FileSystem
): Promise<boolean> {
  if (language === 'typescript') {
    if (await fs.exists(`${repoPath}/tsconfig.json`)) {
      try {
        const content = await fs.readFile(`${repoPath}/tsconfig.json`);
        const config = JSON.parse(content);
        return config.compilerOptions?.strict === true;
      } catch {
        return false;
      }
    }
  }

  if (language === 'python') {
    if (await fs.exists(`${repoPath}/mypy.ini`) || await fs.exists(`${repoPath}/.mypy.ini`)) {
      return true;
    }
    if (await fs.exists(`${repoPath}/pyproject.toml`)) {
      try {
        const content = await fs.readFile(`${repoPath}/pyproject.toml`);
        return content.includes('[tool.mypy]');
      } catch {
        return false;
      }
    }
  }

  return false;
}
