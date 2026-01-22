/**
 * @package @forge/analysis
 * @description Language detection and file discovery utilities
 */

import {
  SupportedLanguage,
  LanguageTier,
  SourceFile,
  LANGUAGE_EXTENSIONS,
  LANGUAGE_TIERS,
} from './analysis.types.js';

/**
 * Detect language from file extension
 */
export function detectLanguage(filePath: string): SupportedLanguage {
  const ext = getFileExtension(filePath);
  return LANGUAGE_EXTENSIONS[ext] ?? 'unknown';
}

/**
 * Get file extension from path (including dot)
 */
export function getFileExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.');
  if (lastDot === -1 || lastDot === filePath.length - 1) {
    return '';
  }
  return filePath.slice(lastDot).toLowerCase();
}

/**
 * Get language tier classification
 */
export function getLanguageTier(language: SupportedLanguage): LanguageTier {
  return LANGUAGE_TIERS[language];
}

/**
 * Check if a language is supported
 */
export function isLanguageSupported(language: string): language is SupportedLanguage {
  return language in LANGUAGE_TIERS;
}

/**
 * Get all supported file extensions
 */
export function getSupportedExtensions(): string[] {
  return Object.keys(LANGUAGE_EXTENSIONS);
}

/**
 * Get file extensions for a specific language
 */
export function getExtensionsForLanguage(language: SupportedLanguage): string[] {
  return Object.entries(LANGUAGE_EXTENSIONS)
    .filter(([, lang]) => lang === language)
    .map(([ext]) => ext);
}

/**
 * Create a SourceFile from path and content
 */
export function createSourceFile(path: string, content: string): SourceFile {
  return {
    path,
    content,
    language: detectLanguage(path),
    extension: getFileExtension(path),
    size: Buffer.byteLength(content, 'utf8'),
  };
}

/**
 * Group files by language
 */
export function groupFilesByLanguage(
  files: SourceFile[]
): Map<SupportedLanguage, SourceFile[]> {
  const groups = new Map<SupportedLanguage, SourceFile[]>();

  for (const file of files) {
    const existing = groups.get(file.language);
    if (existing) {
      existing.push(file);
    } else {
      groups.set(file.language, [file]);
    }
  }

  return groups;
}

/**
 * Filter files by language tier
 */
export function filterByLanguageTier(
  files: SourceFile[],
  tier: LanguageTier
): SourceFile[] {
  return files.filter((file) => getLanguageTier(file.language) === tier);
}

/**
 * Check if file should be included based on patterns
 */
export function shouldIncludeFile(
  filePath: string,
  includePatterns: string[],
  excludePatterns: string[]
): boolean {
  // Check excludes first
  for (const pattern of excludePatterns) {
    if (matchPattern(filePath, pattern)) {
      return false;
    }
  }

  // Check includes
  if (includePatterns.length === 0) {
    return true;
  }

  for (const pattern of includePatterns) {
    if (matchPattern(filePath, pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Simple glob pattern matching
 */
export function matchPattern(filePath: string, pattern: string): boolean {
  // Normalize paths
  const normalizedPath = filePath.replace(/\\/g, '/');
  const normalizedPattern = pattern.replace(/\\/g, '/');

  // Handle **/*.ext pattern (matches any file with extension in any directory)
  if (normalizedPattern.startsWith('**/') && !normalizedPattern.includes('/**', 3)) {
    const suffix = normalizedPattern.slice(3); // Remove **/
    // Convert the suffix part to regex
    const suffixRegex = suffix
      .replace(/\./g, '\\.') // Escape dots
      .replace(/\*\*/g, '.*') // ** matches anything
      .replace(/\*/g, '[^/]*') // * matches anything except /
      .replace(/\?/g, '.'); // ? matches single char

    // Match if the path ends with the suffix pattern (accounting for directory separator)
    const regex = new RegExp(`(?:^|/)${suffixRegex}$`);
    return regex.test(normalizedPath);
  }

  // Handle **/dir/** pattern (matches anything in or under directory)
  // e.g., **/node_modules/** should match node_modules/foo or foo/node_modules/bar
  if (normalizedPattern.startsWith('**/') && normalizedPattern.endsWith('/**')) {
    const middle = normalizedPattern.slice(3, -3); // Extract the middle part (e.g., "node_modules")
    const escapedMiddle = middle.replace(/\./g, '\\.');
    // Match: (anything/)middle(/) or middle(/anything) or (anything/)middle(/anything)
    const regex = new RegExp(`(?:^|/)${escapedMiddle}(?:/|$)`);
    return regex.test(normalizedPath);
  }

  // Handle patterns with /**/ in the middle
  if (normalizedPattern.includes('/**/')) {
    const regexPattern = normalizedPattern
      .replace(/\./g, '\\.') // Escape dots
      .replace(/\*\*\//g, '(?:.*/)?') // **/ matches any path prefix or none
      .replace(/\/\*\*/g, '(?:/.*)?') // /** matches any path suffix or none
      .replace(/\*/g, '[^/]*') // * matches anything except /
      .replace(/\?/g, '.'); // ? matches single char

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(normalizedPath);
  }

  // Standard glob pattern conversion
  let regexPattern = normalizedPattern
    .replace(/\./g, '\\.') // Escape dots
    .replace(/\*\*/g, '.*') // ** matches anything including /
    .replace(/\*/g, '[^/]*') // * matches anything except /
    .replace(/\?/g, '.'); // ? matches single char

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(normalizedPath);
}

/**
 * Get language statistics from files
 */
export function getLanguageStatistics(
  files: SourceFile[]
): { language: SupportedLanguage; count: number; totalSize: number }[] {
  const stats = new Map<SupportedLanguage, { count: number; totalSize: number }>();

  for (const file of files) {
    const existing = stats.get(file.language);
    if (existing) {
      existing.count++;
      existing.totalSize += file.size;
    } else {
      stats.set(file.language, { count: 1, totalSize: file.size });
    }
  }

  return Array.from(stats.entries())
    .map(([language, { count, totalSize }]) => ({ language, count, totalSize }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Detect primary language of a repository based on file count
 */
export function detectPrimaryLanguage(files: SourceFile[]): SupportedLanguage {
  const stats = getLanguageStatistics(files);
  const primaryStat = stats[0];
  return primaryStat ? primaryStat.language : 'unknown';
}

/**
 * Check if a file is a test file based on common patterns
 */
export function isTestFile(filePath: string): boolean {
  const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');

  // Common test file patterns
  const testPatterns = [
    /\.test\.[jt]sx?$/i,
    /\.spec\.[jt]sx?$/i,
    /_test\.py$/i,
    /test_.*\.py$/i,
    /.*_test\.go$/i,
    /test\.java$/i,
    /tests\.java$/i,
    /\.tests?\.[jt]sx?$/i,
    /(?:^|\/)tests?\//i,
    /__tests__\//i,
    /(?:^|\/)spec\//i,
  ];

  return testPatterns.some((pattern) => pattern.test(normalizedPath));
}

/**
 * Check if a file is a configuration file
 */
export function isConfigFile(filePath: string): boolean {
  const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');

  const configPatterns = [
    /\.config\.[jt]s$/,
    /\.config\.mjs$/,
    /\.config\.cjs$/,
    /tsconfig\.json$/,
    /package\.json$/,
    /\.eslintrc/,
    /\.prettierrc/,
    /jest\.config/,
    /vitest\.config/,
    /webpack\.config/,
    /vite\.config/,
    /\.babelrc/,
    /setup\.[jt]sx?$/,
  ];

  return configPatterns.some((pattern) => pattern.test(normalizedPath));
}

/**
 * Check if a file is a generated file
 */
export function isGeneratedFile(filePath: string): boolean {
  const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');

  const generatedPatterns = [
    /\.d\.ts$/,
    /\.min\.[jt]s$/,
    /\.bundle\.[jt]s$/,
    /(?:^|\/)dist\//,
    /(?:^|\/)build\//,
    /(?:^|\/)generated\//,
    /\.generated\./,
  ];

  return generatedPatterns.some((pattern) => pattern.test(normalizedPath));
}
