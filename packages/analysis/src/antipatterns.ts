/**
 * @package @forge/analysis
 * @description Anti-pattern detection for code quality analysis
 */

import {
  SourceFile,
  AntiPattern,
  AntiPatternCategory,
  Severity,
  FunctionComplexity,
  DEFAULT_THRESHOLDS,
  AnalysisThresholds,
} from './analysis.types.js';
import { ParseResult } from './parser.js';

/**
 * Anti-pattern detector interface
 */
interface AntiPatternDetector {
  id: string;
  name: string;
  description: string;
  category: AntiPatternCategory;
  severity: Severity;
  detect(file: SourceFile, parseResult: ParseResult): AntiPattern[];
}

/**
 * Large file detector
 */
const largeFileDetector: AntiPatternDetector = {
  id: 'large-file',
  name: 'Large File',
  description: 'File exceeds recommended line count for AI processing',
  category: 'structure',
  severity: 'medium',
  detect(file: SourceFile, _parseResult: ParseResult): AntiPattern[] {
    const lines = file.content.split('\n').length;
    if (lines > 500) {
      return [
        {
          id: 'large-file',
          name: 'Large File',
          description: `File has ${lines} lines, exceeding the 500 line threshold`,
          category: 'structure',
          severity: lines > 1000 ? 'high' : 'medium',
          filePath: file.path,
          line: 1,
          suggestion: 'Consider splitting this file into smaller, focused modules',
        },
      ];
    }
    return [];
  },
};

/**
 * Long function detector
 */
const longFunctionDetector: AntiPatternDetector = {
  id: 'long-function',
  name: 'Long Function',
  description: 'Function exceeds recommended line count',
  category: 'complexity',
  severity: 'medium',
  detect(file: SourceFile, parseResult: ParseResult): AntiPattern[] {
    const patterns: AntiPattern[] = [];

    for (const func of parseResult.functions) {
      const lines = func.endLine - func.startLine + 1;
      if (lines > 50) {
        patterns.push({
          id: 'long-function',
          name: 'Long Function',
          description: `Function '${func.name}' has ${lines} lines, exceeding the 50 line threshold`,
          category: 'complexity',
          severity: lines > 100 ? 'high' : 'medium',
          filePath: file.path,
          line: func.startLine,
          suggestion: 'Extract helper functions or refactor to reduce complexity',
        });
      }
    }

    return patterns;
  },
};

/**
 * Deep nesting detector
 */
const deepNestingDetector: AntiPatternDetector = {
  id: 'deep-nesting',
  name: 'Deep Nesting',
  description: 'Code has excessive nesting depth',
  category: 'complexity',
  severity: 'medium',
  detect(file: SourceFile, _parseResult: ParseResult): AntiPattern[] {
    const patterns: AntiPattern[] = [];
    const lines = file.content.split('\n');
    let maxNesting = 0;
    let maxNestingLine = 0;
    let currentNesting = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;

      const opens = (line.match(/\{/g) ?? []).length;
      const closes = (line.match(/\}/g) ?? []).length;

      currentNesting += opens;
      if (currentNesting > maxNesting) {
        maxNesting = currentNesting;
        maxNestingLine = i + 1;
      }
      currentNesting -= closes;
      currentNesting = Math.max(0, currentNesting);
    }

    if (maxNesting > 4) {
      patterns.push({
        id: 'deep-nesting',
        name: 'Deep Nesting',
        description: `Maximum nesting depth of ${maxNesting} exceeds threshold of 4`,
        category: 'complexity',
        severity: maxNesting > 6 ? 'high' : 'medium',
        filePath: file.path,
        line: maxNestingLine,
        suggestion: 'Use early returns, extract functions, or flatten conditions',
      });
    }

    return patterns;
  },
};

/**
 * Many parameters detector
 */
const manyParametersDetector: AntiPatternDetector = {
  id: 'many-parameters',
  name: 'Many Parameters',
  description: 'Function has too many parameters',
  category: 'maintainability',
  severity: 'low',
  detect(file: SourceFile, parseResult: ParseResult): AntiPattern[] {
    const patterns: AntiPattern[] = [];

    for (const func of parseResult.functions) {
      if (func.params.length > 5) {
        patterns.push({
          id: 'many-parameters',
          name: 'Many Parameters',
          description: `Function '${func.name}' has ${func.params.length} parameters, exceeding threshold of 5`,
          category: 'maintainability',
          severity: func.params.length > 7 ? 'medium' : 'low',
          filePath: file.path,
          line: func.startLine,
          suggestion: 'Consider using an options object or breaking down the function',
        });
      }
    }

    return patterns;
  },
};

/**
 * Missing documentation detector
 */
const missingDocumentationDetector: AntiPatternDetector = {
  id: 'missing-documentation',
  name: 'Missing Documentation',
  description: 'Public function lacks documentation',
  category: 'documentation',
  severity: 'low',
  detect(file: SourceFile, parseResult: ParseResult): AntiPattern[] {
    const patterns: AntiPattern[] = [];

    for (const func of parseResult.functions) {
      if (!func.hasDocumentation && isPublicFunction(file.content, func.startLine)) {
        patterns.push({
          id: 'missing-documentation',
          name: 'Missing Documentation',
          description: `Function '${func.name}' lacks documentation`,
          category: 'documentation',
          severity: 'low',
          filePath: file.path,
          line: func.startLine,
          suggestion: 'Add JSDoc/docstring explaining purpose and parameters',
        });
      }
    }

    return patterns;
  },
};

/**
 * Hardcoded value detector
 */
const hardcodedValueDetector: AntiPatternDetector = {
  id: 'hardcoded-value',
  name: 'Hardcoded Value',
  description: 'Magic numbers or strings in code',
  category: 'maintainability',
  severity: 'low',
  detect(file: SourceFile, _parseResult: ParseResult): AntiPattern[] {
    const patterns: AntiPattern[] = [];
    const lines = file.content.split('\n');

    // Patterns for suspicious hardcoded values
    const magicPatterns = [
      { regex: /[^a-zA-Z0-9_](\d{4,})[^a-zA-Z0-9_]/, name: 'large number' },
      { regex: /['"]https?:\/\/[^'"]+['"]/, name: 'URL' },
      { regex: /['"][\w.-]+@[\w.-]+\.[a-z]{2,}['"]/, name: 'email' },
      { regex: /['"]\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}['"]/, name: 'IP address' },
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;
      const trimmed = line.trim();

      // Skip comments, imports, and constant declarations
      if (
        trimmed.startsWith('//') ||
        trimmed.startsWith('#') ||
        trimmed.startsWith('import') ||
        trimmed.startsWith('const ') ||
        trimmed.startsWith('export const')
      ) {
        continue;
      }

      for (const pattern of magicPatterns) {
        if (pattern.regex.test(line)) {
          patterns.push({
            id: 'hardcoded-value',
            name: 'Hardcoded Value',
            description: `Possible hardcoded ${pattern.name} detected`,
            category: 'maintainability',
            severity: 'low',
            filePath: file.path,
            line: i + 1,
            snippet: trimmed.slice(0, 80),
            suggestion: 'Extract to a named constant or configuration',
          });
          break; // Only report once per line
        }
      }
    }

    return patterns;
  },
};

/**
 * TODO/FIXME detector
 */
const todoDetector: AntiPatternDetector = {
  id: 'todo-comment',
  name: 'TODO/FIXME Comment',
  description: 'Unresolved TODO or FIXME comment',
  category: 'maintainability',
  severity: 'low',
  detect(file: SourceFile, _parseResult: ParseResult): AntiPattern[] {
    const patterns: AntiPattern[] = [];
    const lines = file.content.split('\n');

    const todoPattern = /\b(TODO|FIXME|HACK|XXX|BUG)\b:?\s*(.+)?/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;

      const match = todoPattern.exec(line);
      if (match) {
        const todoType = match[1]?.toUpperCase() ?? 'TODO';
        const message = match[2]?.trim() ?? '';

        patterns.push({
          id: 'todo-comment',
          name: `${todoType} Comment`,
          description: message || `Unresolved ${todoType}`,
          category: 'maintainability',
          severity: todoType === 'FIXME' || todoType === 'BUG' ? 'medium' : 'low',
          filePath: file.path,
          line: i + 1,
          snippet: line.trim().slice(0, 80),
          suggestion: 'Address or create a ticket for this item',
        });
      }
    }

    return patterns;
  },
};

/**
 * Console log detector
 */
const consoleLogDetector: AntiPatternDetector = {
  id: 'console-log',
  name: 'Console Statement',
  description: 'Debug console statement in production code',
  category: 'maintainability',
  severity: 'low',
  detect(file: SourceFile, _parseResult: ParseResult): AntiPattern[] {
    const patterns: AntiPattern[] = [];
    const lines = file.content.split('\n');

    const consolePattern = /\bconsole\.(log|warn|error|debug|info|trace)\s*\(/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;

      if (consolePattern.test(line)) {
        patterns.push({
          id: 'console-log',
          name: 'Console Statement',
          description: 'Debug console statement found',
          category: 'maintainability',
          severity: 'low',
          filePath: file.path,
          line: i + 1,
          snippet: line.trim().slice(0, 80),
          suggestion: 'Use a proper logging framework or remove',
        });
      }
    }

    return patterns;
  },
};

/**
 * Complex condition detector
 */
const complexConditionDetector: AntiPatternDetector = {
  id: 'complex-condition',
  name: 'Complex Condition',
  description: 'Overly complex boolean condition',
  category: 'complexity',
  severity: 'medium',
  detect(file: SourceFile, _parseResult: ParseResult): AntiPattern[] {
    const patterns: AntiPattern[] = [];
    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;

      // Count logical operators in the line
      const andCount = (line.match(/&&/g) ?? []).length;
      const orCount = (line.match(/\|\|/g) ?? []).length;
      const totalOps = andCount + orCount;

      if (totalOps >= 3) {
        patterns.push({
          id: 'complex-condition',
          name: 'Complex Condition',
          description: `Condition has ${totalOps} logical operators`,
          category: 'complexity',
          severity: totalOps >= 5 ? 'high' : 'medium',
          filePath: file.path,
          line: i + 1,
          suggestion: 'Extract into named boolean variables or helper functions',
        });
      }
    }

    return patterns;
  },
};

/**
 * Duplicate string detector
 */
const duplicateStringDetector: AntiPatternDetector = {
  id: 'duplicate-string',
  name: 'Duplicate String',
  description: 'Same string literal used multiple times',
  category: 'maintainability',
  severity: 'low',
  detect(file: SourceFile, _parseResult: ParseResult): AntiPattern[] {
    const patterns: AntiPattern[] = [];
    const stringCounts = new Map<string, number[]>();

    // Find all string literals
    const stringRegex = /['"]([^'"]{10,})['"](?!\s*:)/g;
    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;

      let match;
      while ((match = stringRegex.exec(line)) !== null) {
        const str = match[1];
        if (str) {
          const existing = stringCounts.get(str) ?? [];
          existing.push(i + 1);
          stringCounts.set(str, existing);
        }
      }
    }

    // Report strings used 3+ times
    for (const [str, lineNums] of stringCounts) {
      if (lineNums.length >= 3) {
        const firstLine = lineNums[0];
        if (firstLine !== undefined) {
          patterns.push({
            id: 'duplicate-string',
            name: 'Duplicate String',
            description: `String "${str.slice(0, 30)}..." used ${lineNums.length} times`,
            category: 'maintainability',
            severity: 'low',
            filePath: file.path,
            line: firstLine,
            suggestion: 'Extract to a named constant',
          });
        }
      }
    }

    return patterns;
  },
};

/**
 * Empty catch block detector
 */
const emptyCatchDetector: AntiPatternDetector = {
  id: 'empty-catch',
  name: 'Empty Catch Block',
  description: 'Catch block without error handling',
  category: 'maintainability',
  severity: 'medium',
  detect(file: SourceFile, _parseResult: ParseResult): AntiPattern[] {
    const patterns: AntiPattern[] = [];
    const content = file.content;

    // Pattern for empty catch blocks
    const emptyCatchPattern = /catch\s*\([^)]*\)\s*\{\s*\}/g;

    let match;
    while ((match = emptyCatchPattern.exec(content)) !== null) {
      const line = getLineNumber(content, match.index);
      patterns.push({
        id: 'empty-catch',
        name: 'Empty Catch Block',
        description: 'Catch block swallows errors without handling',
        category: 'maintainability',
        severity: 'medium',
        filePath: file.path,
        line,
        suggestion: 'Log the error or rethrow if recovery is not possible',
      });
    }

    return patterns;
  },
};

/**
 * All detectors
 */
const DETECTORS: AntiPatternDetector[] = [
  largeFileDetector,
  longFunctionDetector,
  deepNestingDetector,
  manyParametersDetector,
  missingDocumentationDetector,
  hardcodedValueDetector,
  todoDetector,
  consoleLogDetector,
  complexConditionDetector,
  duplicateStringDetector,
  emptyCatchDetector,
];

/**
 * Detect all anti-patterns in a file
 */
export function detectAntiPatterns(
  file: SourceFile,
  parseResult: ParseResult,
  enabledDetectors?: string[]
): AntiPattern[] {
  const patterns: AntiPattern[] = [];

  const detectorsToRun = enabledDetectors
    ? DETECTORS.filter((d) => enabledDetectors.includes(d.id))
    : DETECTORS;

  for (const detector of detectorsToRun) {
    patterns.push(...detector.detect(file, parseResult));
  }

  // Sort by severity then line number
  const severityOrder: Record<Severity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return patterns.sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return a.line - b.line;
  });
}

/**
 * Detect anti-patterns from complexity metrics
 */
export function detectComplexityAntiPatterns(
  functions: FunctionComplexity[],
  thresholds: AnalysisThresholds = DEFAULT_THRESHOLDS
): AntiPattern[] {
  const patterns: AntiPattern[] = [];

  for (const func of functions) {
    if (func.cyclomaticComplexity > thresholds.maxCyclomaticComplexity) {
      patterns.push({
        id: 'high-complexity',
        name: 'High Cyclomatic Complexity',
        description: `Function '${func.name}' has complexity ${func.cyclomaticComplexity}, exceeding threshold of ${thresholds.maxCyclomaticComplexity}`,
        category: 'complexity',
        severity: func.cyclomaticComplexity > 20 ? 'high' : 'medium',
        filePath: func.filePath,
        line: func.startLine,
        suggestion: 'Refactor to reduce decision points and branching',
      });
    }

    if (func.nestingDepth > thresholds.maxNestingDepth) {
      patterns.push({
        id: 'high-nesting',
        name: 'High Nesting Depth',
        description: `Function '${func.name}' has nesting depth ${func.nestingDepth}, exceeding threshold of ${thresholds.maxNestingDepth}`,
        category: 'complexity',
        severity: func.nestingDepth > 5 ? 'high' : 'medium',
        filePath: func.filePath,
        line: func.startLine,
        suggestion: 'Use early returns and extract nested logic',
      });
    }

    if (func.linesOfCode > thresholds.maxFunctionLOC) {
      patterns.push({
        id: 'large-function',
        name: 'Large Function',
        description: `Function '${func.name}' has ${func.linesOfCode} lines, exceeding threshold of ${thresholds.maxFunctionLOC}`,
        category: 'complexity',
        severity: func.linesOfCode > 100 ? 'high' : 'medium',
        filePath: func.filePath,
        line: func.startLine,
        suggestion: 'Break down into smaller, single-purpose functions',
      });
    }

    if (func.parameterCount > thresholds.maxParameters) {
      patterns.push({
        id: 'too-many-params',
        name: 'Too Many Parameters',
        description: `Function '${func.name}' has ${func.parameterCount} parameters, exceeding threshold of ${thresholds.maxParameters}`,
        category: 'maintainability',
        severity: 'low',
        filePath: func.filePath,
        line: func.startLine,
        suggestion: 'Use an options object or refactor responsibilities',
      });
    }
  }

  return patterns;
}

/**
 * Get available detector IDs
 */
export function getAvailableDetectors(): string[] {
  return DETECTORS.map((d) => d.id);
}

/**
 * Get detector info by ID
 */
export function getDetectorInfo(
  id: string
): { name: string; description: string; category: AntiPatternCategory; severity: Severity } | null {
  const detector = DETECTORS.find((d) => d.id === id);
  if (!detector) return null;

  return {
    name: detector.name,
    description: detector.description,
    category: detector.category,
    severity: detector.severity,
  };
}

/**
 * Count anti-patterns by severity
 */
export function countBySeverity(patterns: AntiPattern[]): Record<Severity, number> {
  const counts: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const pattern of patterns) {
    counts[pattern.severity]++;
  }

  return counts;
}

/**
 * Count anti-patterns by category
 */
export function countByCategory(patterns: AntiPattern[]): Record<AntiPatternCategory, number> {
  const counts: Record<AntiPatternCategory, number> = {
    complexity: 0,
    maintainability: 0,
    documentation: 0,
    naming: 0,
    structure: 0,
    testing: 0,
    security: 0,
  };

  for (const pattern of patterns) {
    counts[pattern.category]++;
  }

  return counts;
}

/**
 * Helper: Check if function is public (exported or not prefixed with _)
 */
function isPublicFunction(content: string, startLine: number): boolean {
  const lines = content.split('\n');
  const line = lines[startLine - 1];
  if (!line) return false;

  // Check if exported
  if (line.includes('export')) return true;

  // Check for private naming convention
  const funcMatch = line.match(/(?:function|const|let|var)\s+(_?\w+)/);
  if (funcMatch?.[1]?.startsWith('_')) return false;

  return true;
}

/**
 * Helper: Get line number from character position
 */
function getLineNumber(content: string, position: number): number {
  const substring = content.slice(0, position);
  return (substring.match(/\n/g) ?? []).length + 1;
}
