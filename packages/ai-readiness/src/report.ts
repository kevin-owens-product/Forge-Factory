/**
 * @package @forge/ai-readiness
 * @description Report generation for AI-readiness assessment
 */

import type {
  AIReadinessAssessment,
  AssessmentReport,
  ReportSection,
  FullScoreBreakdown,
  ImprovementRecommendation,
  EffortEstimate,
  AssessmentDimension,
  ExportOptions,
} from './ai-readiness.types.js';

import { DIMENSION_INFO } from './ai-readiness.types.js';
import { getGradeDescription, getScoreLabel } from './scoring.js';

/**
 * Generate a comprehensive assessment report
 */
export function generateReport(assessment: AIReadinessAssessment): AssessmentReport {
  const sections: ReportSection[] = [
    generateExecutiveSummarySection(assessment),
    generateScoreBreakdownSection(assessment.breakdown),
    generateRecommendationsSection(assessment.recommendations),
    generateEffortEstimateSection(assessment.effortEstimate, assessment.overallScore),
    generateDetailsSection(assessment),
    generateToolingSection(assessment),
  ];

  return {
    title: 'AI-Readiness Assessment Report',
    generatedAt: assessment.assessedAt,
    repositoryPath: assessment.sourceAnalysis.repositoryPath,
    summary: generateExecutiveSummary(assessment),
    overallScore: assessment.overallScore,
    grade: assessment.grade,
    breakdown: assessment.breakdown,
    recommendations: assessment.recommendations,
    effortEstimate: assessment.effortEstimate,
    trends: assessment.trends,
    sections,
    formats: ['markdown', 'html', 'json'],
  };
}

/**
 * Generate executive summary text
 */
function generateExecutiveSummary(assessment: AIReadinessAssessment): string {
  const { overallScore, grade, breakdown, recommendations } = assessment;
  const gradeDesc = getGradeDescription(grade);

  const topIssues = recommendations
    .filter((r) => r.priority === 'HIGH')
    .slice(0, 3)
    .map((r) => r.title)
    .join(', ');

  const lowestDimensions = Object.entries(breakdown)
    .map(([key, value]) => ({ key: key as AssessmentDimension, value }))
    .sort((a, b) => a.value - b.value)
    .slice(0, 2)
    .map((d) => DIMENSION_INFO[d.key].name)
    .join(' and ');

  return `This codebase scored **${overallScore}/100** (Grade ${grade}). ${gradeDesc} ` +
    `The lowest scoring areas are ${lowestDimensions}. ` +
    (topIssues ? `Priority improvements: ${topIssues}.` : 'No critical issues found.');
}

/**
 * Generate executive summary section
 */
function generateExecutiveSummarySection(assessment: AIReadinessAssessment): ReportSection {
  const { overallScore, grade, sourceAnalysis } = assessment;

  const content = `
## Overview

| Metric | Value |
|--------|-------|
| **Overall Score** | ${overallScore}/100 |
| **Grade** | ${grade} |
| **Total Files** | ${sourceAnalysis.totalFiles} |
| **Total Lines** | ${sourceAnalysis.structural.totalLines.toLocaleString()} |
| **Primary Language** | ${sourceAnalysis.languageBreakdown[0]?.language || 'Unknown'} |

${getGradeDescription(grade)}

### Score Interpretation

${getScoreInterpretation(overallScore)}
`;

  return {
    id: 'executive-summary',
    title: 'Executive Summary',
    content: content.trim(),
  };
}

/**
 * Get score interpretation
 */
function getScoreInterpretation(score: number): string {
  if (score >= 90) {
    return 'Your codebase is highly optimized for AI coding agents. AI assistants like Claude Code, GitHub Copilot, and Cursor will work effectively with this code.';
  }
  if (score >= 80) {
    return 'Your codebase is well-suited for AI coding agents. Minor improvements could enhance AI effectiveness further.';
  }
  if (score >= 70) {
    return 'Your codebase has some AI-readiness challenges. Addressing the recommendations will improve AI agent effectiveness.';
  }
  if (score >= 60) {
    return 'Your codebase needs significant improvements before AI coding agents can work effectively. Focus on high-priority recommendations.';
  }
  return 'Your codebase has major structural and quality issues that will severely limit AI coding agent effectiveness. Substantial refactoring is recommended.';
}

/**
 * Generate score breakdown section
 */
function generateScoreBreakdownSection(breakdown: FullScoreBreakdown): ReportSection {
  const dimensions: Array<{ key: AssessmentDimension; score: number }> = [
    { key: 'structuralQuality', score: breakdown.structuralQuality },
    { key: 'complexityManagement', score: breakdown.complexityManagement },
    { key: 'documentationCoverage', score: breakdown.documentationCoverage },
    { key: 'testCoverage', score: breakdown.testCoverage },
    { key: 'typeAnnotations', score: breakdown.typeAnnotations },
    { key: 'namingClarity', score: breakdown.namingClarity },
    { key: 'architecturalClarity', score: breakdown.architecturalClarity },
    { key: 'toolingSupport', score: breakdown.toolingSupport },
    { key: 'githubReadiness', score: breakdown.githubReadiness },
  ];

  const rows = dimensions
    .map((d) => {
      const info = DIMENSION_INFO[d.key];
      const label = getScoreLabel(d.score);
      const bar = generateProgressBar(d.score);
      return `| ${info.name} | ${d.score} | ${bar} | ${label} | ${Math.round(info.weight * 100)}% |`;
    })
    .join('\n');

  const content = `
## Score Breakdown

| Dimension | Score | Progress | Status | Weight |
|-----------|-------|----------|--------|--------|
${rows}

### Dimension Categories

**Quantitative (70%)**: Objective measurements from code analysis
- Structural Quality, Complexity Management, Documentation Coverage, Test Coverage, Type Annotations

**Qualitative (20%)**: Semantic assessment of code quality
- Naming Clarity, Architectural Clarity

**Practical (10%)**: Real-world usability factors
- Tooling Support, GitHub Readiness
`;

  return {
    id: 'score-breakdown',
    title: 'Score Breakdown',
    content: content.trim(),
  };
}

/**
 * Generate a text-based progress bar
 */
function generateProgressBar(score: number): string {
  const filled = Math.round(score / 10);
  const empty = 10 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Generate recommendations section
 */
function generateRecommendationsSection(recommendations: ImprovementRecommendation[]): ReportSection {
  if (recommendations.length === 0) {
    return {
      id: 'recommendations',
      title: 'Recommendations',
      content: 'No recommendations - your codebase is already well-optimized for AI coding agents!',
    };
  }

  const highPriority = recommendations.filter((r) => r.priority === 'HIGH');
  const mediumPriority = recommendations.filter((r) => r.priority === 'MEDIUM');
  const lowPriority = recommendations.filter((r) => r.priority === 'LOW');

  let content = '## Recommendations\n\n';

  if (highPriority.length > 0) {
    content += '### High Priority\n\n';
    content += formatRecommendations(highPriority);
  }

  if (mediumPriority.length > 0) {
    content += '\n### Medium Priority\n\n';
    content += formatRecommendations(mediumPriority);
  }

  if (lowPriority.length > 0) {
    content += '\n### Low Priority\n\n';
    content += formatRecommendations(lowPriority);
  }

  return {
    id: 'recommendations',
    title: 'Recommendations',
    content: content.trim(),
  };
}

/**
 * Format recommendation list
 */
function formatRecommendations(recommendations: ImprovementRecommendation[]): string {
  return recommendations
    .map((r, index) => {
      const automationBadge = r.automationAvailable ? ' 🤖 *Automation available*' : '';
      let text = `**${index + 1}. ${r.title}**${automationBadge}\n\n`;
      text += `${r.description}\n\n`;
      text += `- **Impact**: ${r.impact} | **Effort**: ${r.effort}\n`;
      text += `- **Estimated Hours**: ${r.estimatedHours}h\n`;
      text += `- **Potential Score Improvement**: +${r.estimatedImpact} points\n`;

      if (r.affectedFiles.length > 0) {
        const files = r.affectedFiles.slice(0, 5).join(', ');
        const more = r.affectedFiles.length > 5 ? ` (+${r.affectedFiles.length - 5} more)` : '';
        text += `- **Affected Files**: ${files}${more}\n`;
      }

      if (r.actionSteps && r.actionSteps.length > 0) {
        text += '\n**Action Steps**:\n';
        r.actionSteps.forEach((step, i) => {
          text += `${i + 1}. ${step}\n`;
        });
      }

      return text;
    })
    .join('\n---\n\n');
}

/**
 * Generate effort estimate section
 */
function generateEffortEstimateSection(
  effort: EffortEstimate,
  currentScore: number
): ReportSection {
  const content = `
## Effort Estimate

### Summary

| Metric | Value |
|--------|-------|
| **Current Score** | ${currentScore}/100 |
| **Target Score** | ${effort.targetScore}/100 |
| **Total Estimated Hours** | ${effort.totalHours}h |

### Hours by Priority

| Priority | Hours |
|----------|-------|
| High | ${effort.byPriority.high}h |
| Medium | ${effort.byPriority.medium}h |
| Low | ${effort.byPriority.low}h |

### Hours by Dimension

| Dimension | Hours |
|-----------|-------|
| Structural Quality | ${effort.byDimension.structuralQuality}h |
| Complexity Management | ${effort.byDimension.complexityManagement}h |
| Documentation Coverage | ${effort.byDimension.documentationCoverage}h |
| Test Coverage | ${effort.byDimension.testCoverage}h |
| Type Annotations | ${effort.byDimension.typeAnnotations}h |
| Naming Clarity | ${effort.byDimension.namingClarity}h |
| Architectural Clarity | ${effort.byDimension.architecturalClarity}h |
| Tooling Support | ${effort.byDimension.toolingSupport}h |
| GitHub Readiness | ${effort.byDimension.githubReadiness}h |

### Timeline Estimates

- **Aggressive (40h/week)**: ${Math.ceil(effort.totalHours / 40)} weeks
- **Normal (20h/week)**: ${Math.ceil(effort.totalHours / 20)} weeks
- **Part-time (10h/week)**: ${Math.ceil(effort.totalHours / 10)} weeks
`;

  return {
    id: 'effort-estimate',
    title: 'Effort Estimate',
    content: content.trim(),
  };
}

/**
 * Generate details section
 */
function generateDetailsSection(assessment: AIReadinessAssessment): ReportSection {
  const { details, sourceAnalysis } = assessment;

  let content = '## Detailed Findings\n\n';

  // Large files
  if (details.largeFiles.length > 0) {
    content += '### Large Files (>500 LOC)\n\n';
    content += '| File | Lines | Issues |\n';
    content += '|------|-------|--------|\n';
    details.largeFiles.slice(0, 10).forEach((f) => {
      content += `| ${f.path} | ${f.linesOfCode} | ${f.issuesCount} |\n`;
    });
    if (details.largeFiles.length > 10) {
      content += `\n*...and ${details.largeFiles.length - 10} more large files*\n`;
    }
    content += '\n';
  }

  // Complex functions
  if (details.complexFunctions.length > 0) {
    content += '### Complex Functions (Complexity >10)\n\n';
    content += '| Function | File | Complexity | LOC |\n';
    content += '|----------|------|------------|-----|\n';
    details.complexFunctions.slice(0, 10).forEach((f) => {
      content += `| ${f.name} | ${f.filePath}:${f.startLine} | ${f.cyclomaticComplexity} | ${f.linesOfCode} |\n`;
    });
    if (details.complexFunctions.length > 10) {
      content += `\n*...and ${details.complexFunctions.length - 10} more complex functions*\n`;
    }
    content += '\n';
  }

  // Anti-patterns summary
  const antiPatternCategories = Object.entries(details.antiPatternsByCategory);
  if (antiPatternCategories.length > 0) {
    content += '### Anti-Patterns by Category\n\n';
    content += '| Category | Count |\n';
    content += '|----------|-------|\n';
    antiPatternCategories.forEach(([category, patterns]) => {
      content += `| ${category} | ${patterns.length} |\n`;
    });
    content += '\n';
  }

  // Language breakdown
  content += '### Language Breakdown\n\n';
  content += '| Language | Files | LOC | Percentage |\n';
  content += '|----------|-------|-----|------------|\n';
  sourceAnalysis.languageBreakdown.forEach((lang) => {
    content += `| ${lang.language} | ${lang.fileCount} | ${lang.linesOfCode.toLocaleString()} | ${lang.percentage.toFixed(1)}% |\n`;
  });

  return {
    id: 'details',
    title: 'Detailed Findings',
    content: content.trim(),
  };
}

/**
 * Generate tooling section
 */
function generateToolingSection(assessment: AIReadinessAssessment): ReportSection {
  const { tooling, githubReadiness: github } = assessment;

  const checkmark = (value: boolean) => (value ? '✅' : '❌');

  const content = `
## Tooling & Configuration

### Development Tools

| Tool | Status |
|------|--------|
| ESLint | ${checkmark(tooling.hasEslint)} |
| Prettier | ${checkmark(tooling.hasPrettier)} |
| Pylint | ${checkmark(tooling.hasPylint)} |
| Black | ${checkmark(tooling.hasBlack)} |
| RuboCop | ${checkmark(tooling.hasRubocop)} |
| GoFmt | ${checkmark(tooling.hasGofmt)} |

### Package Management

| Tool | Status |
|------|--------|
| Package Manager | ${checkmark(tooling.hasPackageManager)} ${tooling.packageManager || ''} |
| Build Tool | ${checkmark(tooling.hasBuildTool)} ${tooling.buildTool || ''} |
| Pre-commit Hooks | ${checkmark(tooling.hasPreCommitHooks)} |
| Husky | ${checkmark(tooling.hasHusky)} |

### GitHub Readiness

| Configuration | Status |
|---------------|--------|
| CLAUDE.md | ${checkmark(github.hasClaudeMd)} |
| .cursorrules | ${checkmark(github.hasCursorRules)} |
| GitHub Actions | ${checkmark(github.hasGitHubActions)} |
| CircleCI | ${checkmark(github.hasCircleCI)} |
| Jenkins | ${checkmark(github.hasJenkins)} |
| PR Template | ${checkmark(github.hasPrTemplate)} |
| Issue Templates | ${checkmark(github.hasIssueTemplates)} |
| CONTRIBUTING.md | ${checkmark(github.hasContributing)} |
| README.md | ${checkmark(github.hasReadme)} |
| CODEOWNERS | ${checkmark(github.hasCodeowners)} |
| ADRs | ${checkmark(github.hasADRs)} |
`;

  return {
    id: 'tooling',
    title: 'Tooling & Configuration',
    content: content.trim(),
  };
}

/**
 * Export report to Markdown format
 */
export function exportToMarkdown(report: AssessmentReport): string {
  let markdown = `# ${report.title}\n\n`;
  markdown += `**Generated**: ${report.generatedAt.toISOString()}\n\n`;
  markdown += `**Repository**: ${report.repositoryPath}\n\n`;
  markdown += `---\n\n`;
  markdown += `## Summary\n\n${report.summary}\n\n`;

  for (const section of report.sections) {
    markdown += section.content + '\n\n';

    if (section.subSections) {
      for (const subSection of section.subSections) {
        markdown += subSection.content + '\n\n';
      }
    }
  }

  return markdown;
}

/**
 * Export report to JSON format
 */
export function exportToJson(report: AssessmentReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Export report to HTML format
 */
export function exportToHtml(report: AssessmentReport): string {
  const markdown = exportToMarkdown(report);

  // Simple markdown to HTML conversion
  let html = markdown
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  // Wrap in basic HTML structure
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${report.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f4f4f4; }
    code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
    h1, h2, h3 { color: #333; }
  </style>
</head>
<body>
<p>${html}</p>
</body>
</html>`;
}

/**
 * Export report to CSV format (recommendations only)
 */
export function exportToCsv(recommendations: ImprovementRecommendation[]): string {
  const headers = [
    'ID',
    'Title',
    'Priority',
    'Impact',
    'Effort',
    'Dimension',
    'Estimated Impact',
    'Estimated Hours',
    'Automation Available',
    'Description',
  ];

  const rows = recommendations.map((r) => [
    r.id,
    `"${r.title}"`,
    r.priority,
    r.impact,
    r.effort,
    r.dimension,
    r.estimatedImpact,
    r.estimatedHours,
    r.automationAvailable,
    `"${r.description.replace(/"/g, '""')}"`,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Export report based on options
 */
export function exportReport(
  assessment: AIReadinessAssessment,
  options: ExportOptions
): string {
  const report = generateReport(assessment);

  switch (options.format) {
    case 'markdown':
      return exportToMarkdown(report);
    case 'html':
      return exportToHtml(report);
    case 'json':
      return exportToJson(report);
    case 'csv':
      return exportToCsv(assessment.recommendations);
    default:
      return exportToMarkdown(report);
  }
}
