/**
 * @package @forge/ai-readiness
 * @description Recommendation engine with effort estimation for AI-readiness assessment
 */

import type {
  RepositoryAnalysis,
} from '@forge/analysis';

import type {
  FullScoreBreakdown,
  ImprovementRecommendation,
  EffortEstimate,
  AssessmentDimension,
  Priority,
  EffortLevel,
  AssessmentThresholds,
  ToolingConfig,
  GitHubReadinessConfig,
} from './ai-readiness.types.js';

import { DEFAULT_ASSESSMENT_THRESHOLDS, DEFAULT_DIMENSION_WEIGHTS } from './ai-readiness.types.js';

/**
 * Recommendation template
 */
interface RecommendationTemplate {
  id: string;
  dimension: AssessmentDimension;
  title: string;
  descriptionTemplate: string;
  impact: Priority;
  effort: EffortLevel;
  estimatedImpact: number;
  baseHours: number;
  hoursPerItem: number;
  automationAvailable: boolean;
  actionSteps: string[];
  condition: (context: RecommendationContext) => boolean;
  getAffectedFiles: (context: RecommendationContext) => string[];
  getDescription: (context: RecommendationContext) => string;
}

/**
 * Context for recommendation generation
 */
interface RecommendationContext {
  analysis: RepositoryAnalysis;
  breakdown: FullScoreBreakdown;
  thresholds: AssessmentThresholds;
  tooling: ToolingConfig;
  githubConfig: GitHubReadinessConfig;
}

/**
 * Recommendation templates
 */
const RECOMMENDATION_TEMPLATES: RecommendationTemplate[] = [
  // Structural Quality Recommendations
  {
    id: 'split-large-files',
    dimension: 'structuralQuality',
    title: 'Split Large Files',
    descriptionTemplate: 'Break files over {threshold} LOC into smaller modules',
    impact: 'HIGH',
    effort: 'HIGH',
    estimatedImpact: 15,
    baseHours: 4,
    hoursPerItem: 2,
    automationAvailable: true,
    actionSteps: [
      'Identify cohesive blocks of code within large files',
      'Extract related functions into new modules',
      'Update import statements across the codebase',
      'Run tests to ensure functionality is preserved',
    ],
    condition: (ctx) => ctx.analysis.structural.filesOver500LOC > 0,
    getAffectedFiles: (ctx) =>
      ctx.analysis.complexity.functions
        .filter((f) => f.linesOfCode > ctx.thresholds.largeFile)
        .map((f) => f.filePath)
        .filter((v, i, a) => a.indexOf(v) === i),
    getDescription: (ctx) =>
      `${ctx.analysis.structural.filesOver500LOC} files exceed ${ctx.thresholds.largeFile} lines. Large files are harder for AI to process within context limits.`,
  },
  {
    id: 'reduce-file-size',
    dimension: 'structuralQuality',
    title: 'Reduce Average File Size',
    descriptionTemplate: 'Aim for files under 300 lines for optimal AI comprehension',
    impact: 'MEDIUM',
    effort: 'MEDIUM',
    estimatedImpact: 10,
    baseHours: 8,
    hoursPerItem: 0,
    automationAvailable: false,
    actionSteps: [
      'Review files larger than 300 LOC',
      'Identify opportunities to split by responsibility',
      'Create new modules for distinct concerns',
      'Refactor imports to use new module structure',
    ],
    condition: (ctx) => ctx.analysis.structural.averageFileSize > 300,
    getAffectedFiles: () => [],
    getDescription: (ctx) =>
      `Average file size is ${Math.round(ctx.analysis.structural.averageFileSize)} lines. Aim for under 300 lines for better AI comprehension.`,
  },

  // Complexity Management Recommendations
  {
    id: 'reduce-function-complexity',
    dimension: 'complexityManagement',
    title: 'Reduce Function Complexity',
    descriptionTemplate: 'Simplify functions with cyclomatic complexity over {threshold}',
    impact: 'HIGH',
    effort: 'MEDIUM',
    estimatedImpact: 20,
    baseHours: 2,
    hoursPerItem: 1.5,
    automationAvailable: true,
    actionSteps: [
      'Identify functions with complexity over 10',
      'Extract conditional logic into helper functions',
      'Use early returns to reduce nesting',
      'Consider using strategy pattern for complex switches',
      'Add unit tests for refactored code',
    ],
    condition: (ctx) => ctx.analysis.complexity.functionsOverComplexity10 > 0,
    getAffectedFiles: (ctx) =>
      ctx.analysis.complexity.functions
        .filter((f) => f.cyclomaticComplexity > ctx.thresholds.highComplexity)
        .sort((a, b) => b.cyclomaticComplexity - a.cyclomaticComplexity)
        .slice(0, 10)
        .map((f) => `${f.filePath}:${f.startLine}`),
    getDescription: (ctx) =>
      `${ctx.analysis.complexity.functionsOverComplexity10} functions have high cyclomatic complexity. Simplify branching and conditions.`,
  },
  {
    id: 'reduce-nesting-depth',
    dimension: 'complexityManagement',
    title: 'Reduce Nesting Depth',
    descriptionTemplate: 'Flatten deeply nested code (>{threshold} levels)',
    impact: 'MEDIUM',
    effort: 'LOW',
    estimatedImpact: 15,
    baseHours: 1,
    hoursPerItem: 0.5,
    automationAvailable: false,
    actionSteps: [
      'Identify deeply nested functions',
      'Use early returns for guard clauses',
      'Extract nested blocks into helper functions',
      'Consider using async/await instead of nested callbacks',
    ],
    condition: (ctx) => ctx.analysis.complexity.functionsWithDeepNesting > 0,
    getAffectedFiles: (ctx) =>
      ctx.analysis.complexity.functions
        .filter((f) => f.nestingDepth > ctx.thresholds.deepNesting)
        .slice(0, 10)
        .map((f) => `${f.filePath}:${f.startLine}`),
    getDescription: (ctx) =>
      `${ctx.analysis.complexity.functionsWithDeepNesting} functions have deep nesting (>${ctx.thresholds.deepNesting} levels). Use early returns and extract helpers.`,
  },
  {
    id: 'reduce-parameter-count',
    dimension: 'complexityManagement',
    title: 'Reduce Function Parameters',
    descriptionTemplate: 'Refactor functions with more than {threshold} parameters',
    impact: 'LOW',
    effort: 'LOW',
    estimatedImpact: 5,
    baseHours: 1,
    hoursPerItem: 0.5,
    automationAvailable: false,
    actionSteps: [
      'Identify functions with many parameters',
      'Group related parameters into objects',
      'Use builder pattern for complex constructors',
      'Consider using options objects',
    ],
    condition: (ctx) => ctx.analysis.complexity.functionsWithManyParameters > 3,
    getAffectedFiles: (ctx) =>
      ctx.analysis.complexity.functions
        .filter((f) => f.parameterCount > ctx.thresholds.longParameterList)
        .slice(0, 10)
        .map((f) => `${f.filePath}:${f.startLine}`),
    getDescription: (ctx) =>
      `${ctx.analysis.complexity.functionsWithManyParameters} functions have many parameters (>${ctx.thresholds.longParameterList}). Consider using options objects.`,
  },

  // Documentation Coverage Recommendations
  {
    id: 'add-documentation',
    dimension: 'documentationCoverage',
    title: 'Add Function Documentation',
    descriptionTemplate: 'Document public APIs and complex functions',
    impact: 'MEDIUM',
    effort: 'MEDIUM',
    estimatedImpact: 15,
    baseHours: 2,
    hoursPerItem: 0.1,
    automationAvailable: true,
    actionSteps: [
      'Identify undocumented public functions',
      'Add JSDoc/docstrings explaining purpose',
      'Document parameters and return values',
      'Include examples for complex functions',
      'Run documentation generator to verify',
    ],
    condition: (ctx) => ctx.analysis.quality.functionsMissingDocumentation > 10,
    getAffectedFiles: () => [],
    getDescription: (ctx) =>
      `${ctx.analysis.quality.functionsMissingDocumentation} functions lack documentation. Document public APIs for AI understanding.`,
  },
  {
    id: 'add-readme',
    dimension: 'documentationCoverage',
    title: 'Add README.md',
    descriptionTemplate: 'Create a comprehensive README file',
    impact: 'MEDIUM',
    effort: 'LOW',
    estimatedImpact: 10,
    baseHours: 2,
    hoursPerItem: 0,
    automationAvailable: true,
    actionSteps: [
      'Create README.md in project root',
      'Add project description and purpose',
      'Include installation instructions',
      'Add usage examples',
      'Document configuration options',
    ],
    condition: (ctx) => !ctx.githubConfig.hasReadme,
    getAffectedFiles: () => ['README.md'],
    getDescription: () => 'Missing README.md. Add project documentation for AI and human understanding.',
  },

  // Test Coverage Recommendations
  {
    id: 'improve-test-coverage',
    dimension: 'testCoverage',
    title: 'Improve Test Coverage',
    descriptionTemplate: 'Add unit tests to reach {threshold}% coverage',
    impact: 'HIGH',
    effort: 'HIGH',
    estimatedImpact: 10,
    baseHours: 10,
    hoursPerItem: 0.5,
    automationAvailable: true,
    actionSteps: [
      'Identify untested functions',
      'Write unit tests for critical paths',
      'Add edge case tests',
      'Consider using AI to generate test scaffolds',
      'Run coverage report to track progress',
    ],
    condition: (ctx) => (ctx.analysis.quality.testCoverage ?? 0) < 60,
    getAffectedFiles: () => [],
    getDescription: (ctx) =>
      `Test coverage is ${ctx.analysis.quality.testCoverage ?? 'unknown'}%. More tests help AI verify transformations.`,
  },

  // Type Annotations Recommendations
  {
    id: 'add-type-annotations',
    dimension: 'typeAnnotations',
    title: 'Add Type Annotations',
    descriptionTemplate: 'Add explicit types to improve AI comprehension',
    impact: 'MEDIUM',
    effort: 'MEDIUM',
    estimatedImpact: 10,
    baseHours: 4,
    hoursPerItem: 0.05,
    automationAvailable: true,
    actionSteps: [
      'Enable strict type checking',
      'Add return type annotations to functions',
      'Add parameter type annotations',
      'Replace any/unknown with specific types',
      'Use type inference where appropriate',
    ],
    condition: (ctx) => ctx.breakdown.typeAnnotations < 70,
    getAffectedFiles: () => [],
    getDescription: (ctx) =>
      `Type coverage is ${Math.round(ctx.breakdown.typeAnnotations)}%. Add explicit types to help AI understand data flow.`,
  },

  // Tooling Support Recommendations
  {
    id: 'add-linter',
    dimension: 'toolingSupport',
    title: 'Configure Linter',
    descriptionTemplate: 'Add ESLint/Pylint for code quality',
    impact: 'MEDIUM',
    effort: 'LOW',
    estimatedImpact: 5,
    baseHours: 2,
    hoursPerItem: 0,
    automationAvailable: true,
    actionSteps: [
      'Install linter package (ESLint, Pylint, etc.)',
      'Create configuration file',
      'Configure rules for your project',
      'Add lint script to package.json',
      'Fix initial linting errors',
    ],
    condition: (ctx) => !ctx.tooling.hasEslint && !ctx.tooling.hasPylint && !ctx.tooling.hasRubocop,
    getAffectedFiles: () => [],
    getDescription: () => 'No linter configured. Add code quality checks to maintain consistency.',
  },
  {
    id: 'add-formatter',
    dimension: 'toolingSupport',
    title: 'Configure Formatter',
    descriptionTemplate: 'Add Prettier/Black for consistent formatting',
    impact: 'LOW',
    effort: 'LOW',
    estimatedImpact: 3,
    baseHours: 1,
    hoursPerItem: 0,
    automationAvailable: true,
    actionSteps: [
      'Install formatter (Prettier, Black, etc.)',
      'Create configuration file',
      'Add format script to package.json',
      'Configure editor integration',
      'Run initial format on codebase',
    ],
    condition: (ctx) => !ctx.tooling.hasPrettier && !ctx.tooling.hasBlack && !ctx.tooling.hasGofmt,
    getAffectedFiles: () => [],
    getDescription: () => 'No formatter configured. Add consistent formatting for better code readability.',
  },
  {
    id: 'add-pre-commit',
    dimension: 'toolingSupport',
    title: 'Add Pre-commit Hooks',
    descriptionTemplate: 'Configure hooks to run linting before commits',
    impact: 'LOW',
    effort: 'LOW',
    estimatedImpact: 2,
    baseHours: 1,
    hoursPerItem: 0,
    automationAvailable: true,
    actionSteps: [
      'Install husky or pre-commit',
      'Configure hooks for linting and testing',
      'Add commit message validation',
      'Test hook execution',
    ],
    condition: (ctx) => !ctx.tooling.hasPreCommitHooks && !ctx.tooling.hasHusky,
    getAffectedFiles: () => [],
    getDescription: () => 'No pre-commit hooks configured. Add automated checks before commits.',
  },

  // GitHub Readiness Recommendations
  {
    id: 'add-claude-md',
    dimension: 'githubReadiness',
    title: 'Add CLAUDE.md',
    descriptionTemplate: 'Create AI assistant configuration file',
    impact: 'HIGH',
    effort: 'LOW',
    estimatedImpact: 8,
    baseHours: 1,
    hoursPerItem: 0,
    automationAvailable: true,
    actionSteps: [
      'Create CLAUDE.md in project root',
      'Document project conventions',
      'Add code generation guidelines',
      'Include security considerations',
      'Document testing requirements',
    ],
    condition: (ctx) => !ctx.githubConfig.hasClaudeMd && !ctx.githubConfig.hasCursorRules,
    getAffectedFiles: () => ['CLAUDE.md'],
    getDescription: () =>
      'No AI assistant configuration (CLAUDE.md or .cursorrules). Add instructions for AI coding agents.',
  },
  {
    id: 'add-ci-cd',
    dimension: 'githubReadiness',
    title: 'Configure CI/CD',
    descriptionTemplate: 'Set up GitHub Actions for automated testing',
    impact: 'HIGH',
    effort: 'MEDIUM',
    estimatedImpact: 7,
    baseHours: 4,
    hoursPerItem: 0,
    automationAvailable: true,
    actionSteps: [
      'Create .github/workflows directory',
      'Add CI workflow for testing',
      'Configure build and deploy steps',
      'Add status checks for PRs',
      'Test workflow execution',
    ],
    condition: (ctx) => !ctx.githubConfig.hasGitHubActions && !ctx.githubConfig.hasCircleCI,
    getAffectedFiles: () => ['.github/workflows/ci.yml'],
    getDescription: () => 'No CI/CD configuration detected. Add automated testing and deployment.',
  },
  {
    id: 'add-pr-template',
    dimension: 'githubReadiness',
    title: 'Add PR Template',
    descriptionTemplate: 'Create pull request template',
    impact: 'LOW',
    effort: 'LOW',
    estimatedImpact: 2,
    baseHours: 0.5,
    hoursPerItem: 0,
    automationAvailable: true,
    actionSteps: [
      'Create .github/PULL_REQUEST_TEMPLATE.md',
      'Add sections for description, testing, checklist',
      'Include AI-specific review guidance',
    ],
    condition: (ctx) => !ctx.githubConfig.hasPrTemplate,
    getAffectedFiles: () => ['.github/PULL_REQUEST_TEMPLATE.md'],
    getDescription: () => 'No PR template. Add structured guidelines for code reviews.',
  },
  {
    id: 'add-contributing',
    dimension: 'githubReadiness',
    title: 'Add CONTRIBUTING.md',
    descriptionTemplate: 'Create contribution guidelines',
    impact: 'LOW',
    effort: 'LOW',
    estimatedImpact: 2,
    baseHours: 1,
    hoursPerItem: 0,
    automationAvailable: true,
    actionSteps: [
      'Create CONTRIBUTING.md in project root',
      'Document development setup',
      'Add coding standards',
      'Include PR process guidelines',
    ],
    condition: (ctx) => !ctx.githubConfig.hasContributing,
    getAffectedFiles: () => ['CONTRIBUTING.md'],
    getDescription: () => 'No contribution guidelines. Add documentation for contributors.',
  },

  // Anti-pattern specific recommendations
  {
    id: 'address-todos',
    dimension: 'documentationCoverage',
    title: 'Address TODO Comments',
    descriptionTemplate: 'Resolve or remove TODO/FIXME comments',
    impact: 'LOW',
    effort: 'MEDIUM',
    estimatedImpact: 3,
    baseHours: 1,
    hoursPerItem: 0.25,
    automationAvailable: false,
    actionSteps: [
      'Search for TODO/FIXME comments',
      'Prioritize by importance',
      'Create issues for deferred items',
      'Resolve or remove comments',
    ],
    condition: (ctx) => ctx.analysis.antiPatterns.filter((p) => p.id === 'todo-comment').length > 10,
    getAffectedFiles: (ctx) =>
      ctx.analysis.antiPatterns
        .filter((p) => p.id === 'todo-comment')
        .slice(0, 10)
        .map((p) => `${p.filePath}:${p.line}`),
    getDescription: (ctx) => {
      const count = ctx.analysis.antiPatterns.filter((p) => p.id === 'todo-comment').length;
      return `${count} TODO/FIXME comments indicate unfinished work. Address before AI transformation.`;
    },
  },
  {
    id: 'remove-console-logs',
    dimension: 'documentationCoverage',
    title: 'Remove Debug Statements',
    descriptionTemplate: 'Replace console.log with proper logging',
    impact: 'LOW',
    effort: 'LOW',
    estimatedImpact: 2,
    baseHours: 0.5,
    hoursPerItem: 0.05,
    automationAvailable: true,
    actionSteps: [
      'Search for console.log/print statements',
      'Replace with proper logging framework',
      'Configure log levels appropriately',
      'Remove debug-only statements',
    ],
    condition: (ctx) => ctx.analysis.antiPatterns.filter((p) => p.id === 'console-log').length > 5,
    getAffectedFiles: (ctx) =>
      ctx.analysis.antiPatterns
        .filter((p) => p.id === 'console-log')
        .slice(0, 10)
        .map((p) => `${p.filePath}:${p.line}`),
    getDescription: (ctx) => {
      const count = ctx.analysis.antiPatterns.filter((p) => p.id === 'console-log').length;
      return `${count} console statements found. Replace with proper logging.`;
    },
  },
];

/**
 * Generate improvement recommendations based on assessment
 */
export function generateRecommendations(
  analysis: RepositoryAnalysis,
  breakdown: FullScoreBreakdown,
  tooling: ToolingConfig,
  githubConfig: GitHubReadinessConfig,
  thresholds: AssessmentThresholds = DEFAULT_ASSESSMENT_THRESHOLDS
): ImprovementRecommendation[] {
  const context: RecommendationContext = {
    analysis,
    breakdown,
    thresholds,
    tooling,
    githubConfig,
  };

  const recommendations: ImprovementRecommendation[] = [];

  // Evaluate each template
  for (const template of RECOMMENDATION_TEMPLATES) {
    if (template.condition(context)) {
      const affectedFiles = template.getAffectedFiles(context);
      const description = template.getDescription(context);

      // Calculate estimated hours based on affected items
      const itemCount = affectedFiles.length || 1;
      const estimatedHours = template.baseHours + template.hoursPerItem * itemCount;

      recommendations.push({
        id: template.id,
        priority: template.impact,
        impact: template.impact,
        effort: template.effort,
        title: template.title,
        description,
        dimension: template.dimension,
        estimatedImpact: template.estimatedImpact,
        estimatedHours: Math.round(estimatedHours * 10) / 10,
        automationAvailable: template.automationAvailable,
        affectedFiles,
        actionSteps: template.actionSteps,
      });
    }
  }

  // Sort by priority and impact
  return sortRecommendations(recommendations);
}

/**
 * Sort recommendations by priority, impact, and effort
 */
function sortRecommendations(recommendations: ImprovementRecommendation[]): ImprovementRecommendation[] {
  const priorityWeight: Record<Priority, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  const effortWeight: Record<EffortLevel, number> = { LOW: 3, MEDIUM: 2, HIGH: 1 };

  return recommendations.sort((a, b) => {
    const scoreA =
      priorityWeight[a.priority] * 2 +
      priorityWeight[a.impact] * 2 +
      effortWeight[a.effort];
    const scoreB =
      priorityWeight[b.priority] * 2 +
      priorityWeight[b.impact] * 2 +
      effortWeight[b.effort];

    return scoreB - scoreA;
  });
}

/**
 * Calculate effort estimate to reach target score
 */
export function calculateEffortEstimate(
  currentScore: number,
  _breakdown: FullScoreBreakdown,
  recommendations: ImprovementRecommendation[],
  _targetScore: number = 80
): EffortEstimate {
  const byDimension: Record<AssessmentDimension, number> = {
    structuralQuality: 0,
    complexityManagement: 0,
    documentationCoverage: 0,
    testCoverage: 0,
    typeAnnotations: 0,
    namingClarity: 0,
    architecturalClarity: 0,
    toolingSupport: 0,
    githubReadiness: 0,
  };

  const byPriority = {
    high: 0,
    medium: 0,
    low: 0,
  };

  let totalHours = 0;
  let potentialImprovement = 0;

  // Calculate hours needed per dimension
  for (const rec of recommendations) {
    byDimension[rec.dimension] += rec.estimatedHours;
    totalHours += rec.estimatedHours;

    potentialImprovement += rec.estimatedImpact * DEFAULT_DIMENSION_WEIGHTS[rec.dimension];

    if (rec.priority === 'HIGH') {
      byPriority.high += rec.estimatedHours;
    } else if (rec.priority === 'MEDIUM') {
      byPriority.medium += rec.estimatedHours;
    } else {
      byPriority.low += rec.estimatedHours;
    }
  }

  // Cap potential improvement at target
  const expectedScore = Math.min(currentScore + potentialImprovement, 100);

  return {
    totalHours: Math.round(totalHours * 10) / 10,
    byDimension,
    targetScore: Math.round(expectedScore),
    byPriority,
  };
}

/**
 * Get high priority recommendations only
 */
export function getHighPriorityRecommendations(
  recommendations: ImprovementRecommendation[]
): ImprovementRecommendation[] {
  return recommendations.filter((r) => r.priority === 'HIGH');
}

/**
 * Get recommendations for a specific dimension
 */
export function getRecommendationsForDimension(
  recommendations: ImprovementRecommendation[],
  dimension: AssessmentDimension
): ImprovementRecommendation[] {
  return recommendations.filter((r) => r.dimension === dimension);
}

/**
 * Get quick wins (low effort, high/medium impact)
 */
export function getQuickWins(
  recommendations: ImprovementRecommendation[]
): ImprovementRecommendation[] {
  return recommendations.filter(
    (r) => r.effort === 'LOW' && (r.impact === 'HIGH' || r.impact === 'MEDIUM')
  );
}

/**
 * Calculate total estimated hours
 */
export function getTotalEstimatedHours(
  recommendations: ImprovementRecommendation[]
): number {
  return recommendations.reduce((sum, r) => sum + r.estimatedHours, 0);
}

/**
 * Get recommendations with automation available
 */
export function getAutomatableRecommendations(
  recommendations: ImprovementRecommendation[]
): ImprovementRecommendation[] {
  return recommendations.filter((r) => r.automationAvailable);
}

/**
 * Calculate potential score improvement from recommendations
 */
export function calculatePotentialImprovement(
  recommendations: ImprovementRecommendation[]
): number {
  let totalImprovement = 0;

  for (const rec of recommendations) {
    totalImprovement += rec.estimatedImpact * DEFAULT_DIMENSION_WEIGHTS[rec.dimension];
  }

  return Math.min(Math.round(totalImprovement), 40); // Cap at 40 points
}
