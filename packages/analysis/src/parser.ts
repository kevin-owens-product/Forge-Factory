/**
 * @package @forge/analysis
 * @description Lightweight code parser for structural analysis
 * Uses regex-based parsing for portability without native dependencies
 */

import { SupportedLanguage, FunctionComplexity } from './analysis.types.js';

/**
 * Parsed function information
 */
export interface ParsedFunction {
  name: string;
  startLine: number;
  endLine: number;
  params: string[];
  hasTypeAnnotations: boolean;
  hasDocumentation: boolean;
  body: string;
}

/**
 * Parsed class information
 */
export interface ParsedClass {
  name: string;
  startLine: number;
  endLine: number;
  methods: ParsedFunction[];
  hasDocumentation: boolean;
}

/**
 * Parsed import information
 */
export interface ParsedImport {
  source: string;
  specifiers: string[];
  line: number;
  isDefault: boolean;
  isNamespace: boolean;
}

/**
 * Parsed export information
 */
export interface ParsedExport {
  name: string;
  line: number;
  isDefault: boolean;
}

/**
 * Complete parse result
 */
export interface ParseResult {
  functions: ParsedFunction[];
  classes: ParsedClass[];
  imports: ParsedImport[];
  exports: ParsedExport[];
  comments: { line: number; text: string; isBlock: boolean }[];
  errors: string[];
}

/**
 * Language-specific parser configuration
 */
interface ParserConfig {
  functionPatterns: RegExp[];
  classPattern: RegExp;
  importPattern: RegExp;
  exportPattern: RegExp;
  singleLineComment: string;
  blockCommentStart: string;
  blockCommentEnd: string;
  docCommentStart: string;
}

/**
 * Parser configurations by language
 */
const PARSER_CONFIGS: Partial<Record<SupportedLanguage, ParserConfig>> = {
  typescript: {
    functionPatterns: [
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)/g,
      /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=]*)\s*=>/g,
      /(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)\s*(?::\s*[^{]+)?\s*\{/g,
    ],
    classPattern: /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?\s*\{/g,
    importPattern: /import\s+(?:(?:\{([^}]*)\})|(\w+)|\*\s+as\s+(\w+))\s+from\s+['"]([^'"]+)['"]/g,
    exportPattern: /export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type|enum)\s+(\w+)/g,
    singleLineComment: '//',
    blockCommentStart: '/*',
    blockCommentEnd: '*/',
    docCommentStart: '/**',
  },
  javascript: {
    functionPatterns: [
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g,
      /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=]*)\s*=>/g,
      /(\w+)\s*\(([^)]*)\)\s*\{/g,
    ],
    classPattern: /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?\s*\{/g,
    importPattern: /import\s+(?:(?:\{([^}]*)\})|(\w+)|\*\s+as\s+(\w+))\s+from\s+['"]([^'"]+)['"]/g,
    exportPattern: /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/g,
    singleLineComment: '//',
    blockCommentStart: '/*',
    blockCommentEnd: '*/',
    docCommentStart: '/**',
  },
  python: {
    functionPatterns: [
      /(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)/g,
    ],
    classPattern: /class\s+(\w+)(?:\([^)]*\))?\s*:/g,
    importPattern: /(?:from\s+(\S+)\s+)?import\s+(.+)/g,
    exportPattern: /__all__\s*=\s*\[([^\]]*)\]/g,
    singleLineComment: '#',
    blockCommentStart: '"""',
    blockCommentEnd: '"""',
    docCommentStart: '"""',
  },
  java: {
    functionPatterns: [
      /(?:public|private|protected)?\s*(?:static)?\s*(?:\w+(?:<[^>]*>)?)\s+(\w+)\s*\(([^)]*)\)/g,
    ],
    classPattern: /(?:public|private|protected)?\s*(?:abstract)?\s*class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?\s*\{/g,
    importPattern: /import\s+(?:static\s+)?([^;]+);/g,
    exportPattern: /(?:public)\s+(?:class|interface|enum)\s+(\w+)/g,
    singleLineComment: '//',
    blockCommentStart: '/*',
    blockCommentEnd: '*/',
    docCommentStart: '/**',
  },
  go: {
    functionPatterns: [
      /func\s+(?:\([^)]+\)\s+)?(\w+)\s*\(([^)]*)\)/g,
    ],
    classPattern: /type\s+(\w+)\s+struct\s*\{/g,
    importPattern: /import\s+(?:\(\s*)?["']([^"']+)["']/g,
    exportPattern: /func\s+(\w+)|type\s+(\w+)/g,
    singleLineComment: '//',
    blockCommentStart: '/*',
    blockCommentEnd: '*/',
    docCommentStart: '//',
  },
};

/**
 * Parse source code and extract structural information
 */
export function parseSourceCode(content: string, language: SupportedLanguage): ParseResult {
  const config = PARSER_CONFIGS[language];
  const lines = content.split('\n');

  if (!config) {
    // Fall back to generic parsing
    return parseGeneric(content, lines);
  }

  const result: ParseResult = {
    functions: [],
    classes: [],
    imports: [],
    exports: [],
    comments: [],
    errors: [],
  };

  try {
    // Parse comments first (needed for documentation detection)
    result.comments = parseComments(content, lines, config);

    // Parse imports
    result.imports = parseImports(content, lines, config);

    // Parse exports
    result.exports = parseExports(content, lines, config);

    // Parse functions
    result.functions = parseFunctions(content, lines, config, result.comments);

    // Parse classes
    result.classes = parseClasses(content, lines, config, result.comments);
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Parse error');
  }

  return result;
}

/**
 * Parse comments from source code
 */
function parseComments(
  content: string,
  lines: string[],
  config: ParserConfig
): { line: number; text: string; isBlock: boolean }[] {
  const comments: { line: number; text: string; isBlock: boolean }[] = [];

  // Parse single-line comments
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line !== undefined) {
      const trimmed = line.trim();
      if (trimmed.startsWith(config.singleLineComment)) {
        comments.push({
          line: i + 1,
          text: trimmed.slice(config.singleLineComment.length).trim(),
          isBlock: false,
        });
      }
    }
  }

  // Parse block comments
  const blockCommentRegex = new RegExp(
    `${escapeRegex(config.blockCommentStart)}([\\s\\S]*?)${escapeRegex(config.blockCommentEnd)}`,
    'g'
  );

  let match;
  while ((match = blockCommentRegex.exec(content)) !== null) {
    const startPos = match.index;
    const line = getLineNumber(content, startPos);
    const matchedText = match[1];
    comments.push({
      line,
      text: matchedText ? matchedText.trim() : '',
      isBlock: true,
    });
  }

  return comments;
}

/**
 * Parse imports from source code
 */
function parseImports(
  content: string,
  _lines: string[],
  config: ParserConfig
): ParsedImport[] {
  const imports: ParsedImport[] = [];
  const regex = new RegExp(config.importPattern.source, config.importPattern.flags);

  let match;
  while ((match = regex.exec(content)) !== null) {
    const line = getLineNumber(content, match.index);
    const namedImports = match[1];
    const defaultImport = match[2];
    const namespaceImport = match[3];
    const source = match[4] ?? match[1] ?? '';

    const specifiers: string[] = [];
    if (namedImports) {
      specifiers.push(
        ...namedImports
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s)
      );
    }
    if (defaultImport) {
      specifiers.push(defaultImport);
    }
    if (namespaceImport) {
      specifiers.push(namespaceImport);
    }

    imports.push({
      source,
      specifiers,
      line,
      isDefault: Boolean(defaultImport),
      isNamespace: Boolean(namespaceImport),
    });
  }

  return imports;
}

/**
 * Parse exports from source code
 */
function parseExports(
  content: string,
  _lines: string[],
  config: ParserConfig
): ParsedExport[] {
  const exports: ParsedExport[] = [];
  const regex = new RegExp(config.exportPattern.source, config.exportPattern.flags);

  let match;
  while ((match = regex.exec(content)) !== null) {
    const line = getLineNumber(content, match.index);
    const name = match[1] ?? match[2] ?? '';
    const isDefault = match[0]?.includes('default') ?? false;

    if (name) {
      exports.push({
        name,
        line,
        isDefault,
      });
    }
  }

  return exports;
}

/**
 * Parse functions from source code
 */
function parseFunctions(
  content: string,
  lines: string[],
  config: ParserConfig,
  comments: { line: number; text: string; isBlock: boolean }[]
): ParsedFunction[] {
  const functions: ParsedFunction[] = [];
  const seenFunctions = new Set<string>();

  for (const pattern of config.functionPatterns) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;

    while ((match = regex.exec(content)) !== null) {
      const name = match[1] ?? '';
      const paramsStr = match[2] ?? '';
      const startLine = getLineNumber(content, match.index);

      // Deduplicate
      const key = `${name}:${startLine}`;
      if (seenFunctions.has(key)) continue;
      seenFunctions.add(key);

      // Find end of function (simplified brace matching)
      const endLine = findFunctionEnd(content, match.index, lines);

      // Parse parameters
      const params = paramsStr
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p);

      // Check for type annotations
      const hasTypeAnnotations = params.some(
        (p) => p.includes(':') || p.includes('=')
      );

      // Check for documentation (comment on previous line)
      const hasDocumentation = comments.some(
        (c) => c.line >= startLine - 3 && c.line < startLine
      );

      // Extract body
      const bodyStartIndex = content.indexOf('{', match.index);
      const body =
        bodyStartIndex !== -1
          ? extractBlock(content, bodyStartIndex)
          : '';

      if (name) {
        functions.push({
          name,
          startLine,
          endLine,
          params,
          hasTypeAnnotations,
          hasDocumentation,
          body,
        });
      }
    }
  }

  return functions;
}

/**
 * Parse classes from source code
 */
function parseClasses(
  content: string,
  lines: string[],
  config: ParserConfig,
  comments: { line: number; text: string; isBlock: boolean }[]
): ParsedClass[] {
  const classes: ParsedClass[] = [];
  const regex = new RegExp(config.classPattern.source, config.classPattern.flags);

  let match;
  while ((match = regex.exec(content)) !== null) {
    const name = match[1] ?? '';
    const startLine = getLineNumber(content, match.index);
    const endLine = findFunctionEnd(content, match.index, lines);

    // Check for documentation
    const hasDocumentation = comments.some(
      (c) => c.line >= startLine - 3 && c.line < startLine
    );

    // Extract class body and find methods
    const bodyStartIndex = content.indexOf('{', match.index);
    const classBody = bodyStartIndex !== -1 ? extractBlock(content, bodyStartIndex) : '';

    // Parse methods within class
    const methods: ParsedFunction[] = [];
    if (classBody) {
      const methodResult = parseFunctions(classBody, classBody.split('\n'), config, []);
      methods.push(...methodResult);
    }

    if (name) {
      classes.push({
        name,
        startLine,
        endLine,
        methods,
        hasDocumentation,
      });
    }
  }

  return classes;
}

/**
 * Generic parser for unsupported languages
 */
function parseGeneric(content: string, _lines: string[]): ParseResult {
  const result: ParseResult = {
    functions: [],
    classes: [],
    imports: [],
    exports: [],
    comments: [],
    errors: [],
  };

  // Count basic patterns
  const functionMatches = content.match(/function\s+\w+/g) ?? [];
  const classMatches = content.match(/class\s+\w+/g) ?? [];

  // Create placeholder entries
  for (let i = 0; i < functionMatches.length; i++) {
    const matchText = functionMatches[i];
    const name = matchText?.replace('function ', '') ?? '';
    result.functions.push({
      name,
      startLine: 0,
      endLine: 0,
      params: [],
      hasTypeAnnotations: false,
      hasDocumentation: false,
      body: '',
    });
  }

  for (let i = 0; i < classMatches.length; i++) {
    const matchText = classMatches[i];
    const name = matchText?.replace('class ', '') ?? '';
    result.classes.push({
      name,
      startLine: 0,
      endLine: 0,
      methods: [],
      hasDocumentation: false,
    });
  }

  return result;
}

/**
 * Find the end line of a function/block
 */
function findFunctionEnd(
  content: string,
  startIndex: number,
  lines: string[]
): number {
  const startLine = getLineNumber(content, startIndex);
  let braceCount = 0;
  let foundFirstBrace = false;

  for (let i = startIndex; i < content.length; i++) {
    const char = content[i];
    if (char === '{') {
      braceCount++;
      foundFirstBrace = true;
    } else if (char === '}') {
      braceCount--;
      if (foundFirstBrace && braceCount === 0) {
        return getLineNumber(content, i);
      }
    }
  }

  // If no closing brace found, estimate based on indentation
  return Math.min(startLine + 50, lines.length);
}

/**
 * Extract a block of code (braces matched)
 */
function extractBlock(content: string, startIndex: number): string {
  let braceCount = 0;
  let foundFirstBrace = false;
  let endIndex = startIndex;

  for (let i = startIndex; i < content.length; i++) {
    const char = content[i];
    if (char === '{') {
      braceCount++;
      foundFirstBrace = true;
    } else if (char === '}') {
      braceCount--;
      if (foundFirstBrace && braceCount === 0) {
        endIndex = i + 1;
        break;
      }
    }
  }

  return content.slice(startIndex, endIndex);
}

/**
 * Get line number from character position
 */
function getLineNumber(content: string, position: number): number {
  const substring = content.slice(0, position);
  return (substring.match(/\n/g) ?? []).length + 1;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Calculate complexity metrics for a function
 */
export function calculateFunctionComplexity(
  func: ParsedFunction,
  filePath: string
): FunctionComplexity {
  const body = func.body;

  // Calculate cyclomatic complexity
  const cyclomaticComplexity = calculateCyclomaticComplexity(body);

  // Calculate cognitive complexity
  const cognitiveComplexity = calculateCognitiveComplexity(body);

  // Calculate nesting depth
  const nestingDepth = calculateNestingDepth(body);

  return {
    name: func.name,
    filePath,
    startLine: func.startLine,
    endLine: func.endLine,
    linesOfCode: func.endLine - func.startLine + 1,
    cyclomaticComplexity,
    cognitiveComplexity,
    nestingDepth,
    parameterCount: func.params.length,
  };
}

/**
 * Calculate cyclomatic complexity (McCabe)
 * V(G) = number of decision points + 1
 */
function calculateCyclomaticComplexity(body: string): number {
  let complexity = 1;

  // Decision points
  const patterns = [
    /\bif\b/g,
    /\belse\s+if\b/g,
    /\bwhile\b/g,
    /\bfor\b/g,
    /\bcase\b/g,
    /\bcatch\b/g,
    /\?\s*[^:]/g, // Ternary (avoiding type annotations)
    /&&/g,
    /\|\|/g,
    /\?\?/g, // Nullish coalescing
  ];

  for (const pattern of patterns) {
    const matches = body.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  }

  return complexity;
}

/**
 * Calculate cognitive complexity
 * Adds penalty for nesting and structural complexity
 */
function calculateCognitiveComplexity(body: string): number {
  let complexity = 0;
  let nestingLevel = 0;

  const lines = body.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Structural increments
    if (/\b(if|else\s+if|switch|for|while|catch)\b/.test(trimmed)) {
      complexity += 1 + nestingLevel;
    }

    // Nesting increments
    if (/\b(else|else\s+if)\b/.test(trimmed)) {
      complexity += 1;
    }

    // Binary logical operators in conditions
    const logicalOps = (trimmed.match(/&&|\|\|/g) ?? []).length;
    complexity += logicalOps;

    // Track nesting
    const opens = (line.match(/\{/g) ?? []).length;
    const closes = (line.match(/\}/g) ?? []).length;
    nestingLevel += opens - closes;
    nestingLevel = Math.max(0, nestingLevel);
  }

  return complexity;
}

/**
 * Calculate maximum nesting depth
 */
function calculateNestingDepth(body: string): number {
  let maxDepth = 0;
  let currentDepth = 0;

  for (const char of body) {
    if (char === '{') {
      currentDepth++;
      maxDepth = Math.max(maxDepth, currentDepth);
    } else if (char === '}') {
      currentDepth--;
    }
  }

  return maxDepth;
}
