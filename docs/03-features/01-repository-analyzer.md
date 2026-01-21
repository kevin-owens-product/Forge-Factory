# Feature: Repository Analyzer

**Feature ID:** FF-001
**Version:** 1.0
**Status:** Draft
**Owner:** Engineering Team

---

## Overview

The Repository Analyzer is the foundational feature that scans codebases and produces an AI-Readiness Score (0-100). It analyzes code structure, complexity, test coverage, documentation, and other metrics to determine how maintainable the codebase is for AI coding agents.

### User Story
> As a **development team lead**, I want to **analyze my repository's AI-readiness** so that I can **understand what improvements are needed for effective AI-assisted development**.

### Success Criteria
- ✓ Analysis completes in <5 minutes for 100K LOC
- ✓ AI-Readiness Score accuracy validated against manual assessments
- ✓ Actionable recommendations provided for each metric
- ✓ Support for JavaScript, TypeScript, Python, Java, Go (phase 1)

---

## Vertical Slice Architecture

### 1. Database Schema

```sql
-- Analysis runs table
CREATE TABLE analysis_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  commit_sha VARCHAR(40) NOT NULL,
  branch VARCHAR(255) DEFAULT 'main',
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  ai_readiness_score INTEGER CHECK (ai_readiness_score BETWEEN 0 AND 100),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_by UUID REFERENCES users(id),

  -- Denormalized metrics for quick access
  total_files INTEGER,
  total_lines INTEGER,
  average_complexity DECIMAL(5,2),
  test_coverage_percent DECIMAL(5,2),
  documentation_percent DECIMAL(5,2),

  CONSTRAINT valid_completion_time CHECK (
    (status = 'completed' AND completed_at IS NOT NULL) OR
    (status != 'completed')
  )
);

CREATE INDEX idx_analysis_runs_repository ON analysis_runs(repository_id, created_at DESC);
CREATE INDEX idx_analysis_runs_status ON analysis_runs(status) WHERE status IN ('pending', 'running');

-- Detailed metrics table
CREATE TABLE analysis_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_run_id UUID NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  metric_category VARCHAR(50) NOT NULL,
  metric_name VARCHAR(100) NOT NULL,
  metric_value DECIMAL(10,2) NOT NULL,
  metric_score INTEGER CHECK (metric_score BETWEEN 0 AND 100),
  weight DECIMAL(3,2) NOT NULL, -- Weight in overall score calculation

  UNIQUE(analysis_run_id, metric_category, metric_name)
);

CREATE INDEX idx_analysis_metrics_run ON analysis_metrics(analysis_run_id);

-- File-level analysis details
CREATE TABLE file_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_run_id UUID NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  language VARCHAR(50),
  lines_of_code INTEGER NOT NULL,
  cyclomatic_complexity INTEGER,
  cognitive_complexity INTEGER,
  max_nesting_depth INTEGER,
  num_functions INTEGER,
  num_classes INTEGER,
  has_tests BOOLEAN DEFAULT FALSE,
  test_coverage DECIMAL(5,2),
  has_documentation BOOLEAN DEFAULT FALSE,
  has_type_annotations BOOLEAN DEFAULT FALSE,
  issues JSONB DEFAULT '[]', -- Array of issues found

  UNIQUE(analysis_run_id, file_path)
);

CREATE INDEX idx_file_analyses_run ON file_analyses(analysis_run_id);
CREATE INDEX idx_file_analyses_complexity ON file_analyses(cyclomatic_complexity DESC);

-- Recommendations table
CREATE TABLE analysis_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_run_id UUID NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  priority VARCHAR(20) NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  category VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  file_paths TEXT[], -- Affected files
  estimated_effort VARCHAR(20), -- 'small', 'medium', 'large'
  impact_score INTEGER CHECK (impact_score BETWEEN 0 AND 100),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recommendations_run ON analysis_recommendations(analysis_run_id, priority);
```

### 2. API Endpoints

```typescript
// types/analysis.ts
export interface AnalysisRunRequest {
  repositoryId: string;
  commitSha?: string; // Optional, defaults to HEAD
  branch?: string;    // Optional, defaults to default branch
}

export interface AnalysisRunResponse {
  id: string;
  repositoryId: string;
  commitSha: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  aiReadinessScore?: number;
  startedAt: string;
  completedAt?: string;
  estimatedTimeRemaining?: number; // seconds
}

export interface AnalysisMetrics {
  modularity: MetricDetail;
  complexity: MetricDetail;
  typeAnnotations: MetricDetail;
  testCoverage: MetricDetail;
  documentation: MetricDetail;
  naming: MetricDetail;
  dependencies: MetricDetail;
}

export interface MetricDetail {
  score: number;      // 0-100
  weight: number;     // 0.0-1.0
  current: number;    // Current value
  target: number;     // Target value
  unit: string;       // e.g., '%', 'files', 'score'
  trend?: number[];   // Historical scores
}

export interface AnalysisRecommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  filePaths: string[];
  estimatedEffort: 'small' | 'medium' | 'large';
  impactScore: number;
}

export interface FileAnalysis {
  filePath: string;
  language: string;
  linesOfCode: number;
  complexity: {
    cyclomatic: number;
    cognitive: number;
    maxNestingDepth: number;
  };
  functions: {
    total: number;
    documented: number;
    tested: number;
  };
  issues: FileIssue[];
}

export interface FileIssue {
  type: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  line?: number;
  column?: number;
}
```

```typescript
// routes/analysis.ts
import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const CreateAnalysisSchema = z.object({
  repositoryId: z.string().uuid(),
  commitSha: z.string().regex(/^[a-f0-9]{40}$/).optional(),
  branch: z.string().optional(),
});

export async function analysisRoutes(fastify: FastifyInstance) {

  // Create new analysis run
  fastify.post<{
    Body: AnalysisRunRequest;
  }>('/api/v1/analysis/run', {
    schema: {
      body: CreateAnalysisSchema,
      response: {
        201: AnalysisRunResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.authorize(['repo:read'])],
  }, async (request, reply) => {
    const { repositoryId, commitSha, branch } = request.body;

    // Verify repository access
    const repository = await fastify.repositories.get(repositoryId);
    if (!repository) {
      return reply.code(404).send({ error: 'Repository not found' });
    }

    // Create analysis run
    const analysisRun = await fastify.db.analysisRun.create({
      data: {
        repositoryId,
        commitSha: commitSha || repository.defaultBranch,
        branch: branch || repository.defaultBranch,
        status: 'pending',
        createdBy: request.user.id,
      },
    });

    // Enqueue analysis job
    await fastify.queue.add('analysis', {
      analysisRunId: analysisRun.id,
      repositoryId,
      commitSha: analysisRun.commitSha,
    });

    return reply.code(201).send(analysisRun);
  });

  // Get analysis run status
  fastify.get<{
    Params: { id: string };
  }>('/api/v1/analysis/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;

    const analysisRun = await fastify.db.analysisRun.findUnique({
      where: { id },
      include: {
        repository: true,
      },
    });

    if (!analysisRun) {
      return reply.code(404).send({ error: 'Analysis run not found' });
    }

    // Calculate estimated time remaining
    let estimatedTimeRemaining: number | undefined;
    if (analysisRun.status === 'running') {
      const elapsed = Date.now() - analysisRun.startedAt.getTime();
      const avgDuration = await getAverageDuration(analysisRun.repository.size);
      estimatedTimeRemaining = Math.max(0, avgDuration - elapsed);
    }

    return {
      ...analysisRun,
      estimatedTimeRemaining,
    };
  });

  // Get analysis metrics
  fastify.get<{
    Params: { id: string };
  }>('/api/v1/analysis/:id/metrics', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;

    const metrics = await fastify.db.analysisMetric.findMany({
      where: { analysisRunId: id },
    });

    // Group by category
    const grouped: AnalysisMetrics = {
      modularity: extractMetric(metrics, 'modularity'),
      complexity: extractMetric(metrics, 'complexity'),
      typeAnnotations: extractMetric(metrics, 'type_annotations'),
      testCoverage: extractMetric(metrics, 'test_coverage'),
      documentation: extractMetric(metrics, 'documentation'),
      naming: extractMetric(metrics, 'naming'),
      dependencies: extractMetric(metrics, 'dependencies'),
    };

    return grouped;
  });

  // Get recommendations
  fastify.get<{
    Params: { id: string };
  }>('/api/v1/analysis/:id/recommendations', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;

    const recommendations = await fastify.db.analysisRecommendation.findMany({
      where: { analysisRunId: id },
      orderBy: [
        { priority: 'asc' }, // critical first
        { impactScore: 'desc' },
      ],
    });

    return recommendations;
  });

  // Get file-level details
  fastify.get<{
    Params: { id: string };
    Querystring: {
      sort?: 'complexity' | 'size' | 'issues';
      order?: 'asc' | 'desc';
      limit?: number;
      offset?: number;
    };
  }>('/api/v1/analysis/:id/files', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const { sort = 'complexity', order = 'desc', limit = 50, offset = 0 } = request.query;

    const orderByClause = sort === 'complexity'
      ? { cyclomaticComplexity: order }
      : sort === 'size'
      ? { linesOfCode: order }
      : { id: order };

    const files = await fastify.db.fileAnalysis.findMany({
      where: { analysisRunId: id },
      orderBy: orderByClause,
      take: limit,
      skip: offset,
    });

    const total = await fastify.db.fileAnalysis.count({
      where: { analysisRunId: id },
    });

    return {
      files,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + files.length < total,
      },
    };
  });

  // List analysis runs for a repository
  fastify.get<{
    Params: { repositoryId: string };
    Querystring: { limit?: number; offset?: number };
  }>('/api/v1/repositories/:repositoryId/analyses', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { repositoryId } = request.params;
    const { limit = 20, offset = 0 } = request.query;

    const analyses = await fastify.db.analysisRun.findMany({
      where: { repositoryId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await fastify.db.analysisRun.count({
      where: { repositoryId },
    });

    return {
      analyses,
      pagination: { total, limit, offset },
    };
  });
}
```

### 3. Analysis Engine (Go Service)

```go
// analyzer/engine.go
package analyzer

import (
    "context"
    "fmt"
    "sync"
)

type AnalysisEngine struct {
    parsers map[string]LanguageParser
    db      *Database
    storage ObjectStorage
}

type AnalysisResult struct {
    AIReadinessScore   int
    Metrics            []Metric
    FileAnalyses       []FileAnalysis
    Recommendations    []Recommendation
}

func (e *AnalysisEngine) Analyze(ctx context.Context, analysisRunID, repoPath string) (*AnalysisResult, error) {
    // 1. Discover all source files
    files, err := e.discoverSourceFiles(repoPath)
    if err != nil {
        return nil, fmt.Errorf("discovering files: %w", err)
    }

    // 2. Parse files in parallel
    fileResults := e.parseFiles(ctx, files)

    // 3. Calculate metrics
    metrics := e.calculateMetrics(fileResults)

    // 4. Compute AI-readiness score
    score := e.computeAIReadinessScore(metrics)

    // 5. Generate recommendations
    recommendations := e.generateRecommendations(metrics, fileResults)

    result := &AnalysisResult{
        AIReadinessScore: score,
        Metrics:          metrics,
        FileAnalyses:     fileResults,
        Recommendations:  recommendations,
    }

    // 6. Store results
    if err := e.storeResults(analysisRunID, result); err != nil {
        return nil, fmt.Errorf("storing results: %w", err)
    }

    return result, nil
}

func (e *AnalysisEngine) parseFiles(ctx context.Context, files []string) []FileAnalysis {
    results := make([]FileAnalysis, len(files))
    var wg sync.WaitGroup

    // Use worker pool to limit concurrency
    semaphore := make(chan struct{}, 10)

    for i, file := range files {
        wg.Add(1)
        go func(idx int, path string) {
            defer wg.Done()
            semaphore <- struct{}{}
            defer func() { <-semaphore }()

            results[idx] = e.analyzeFile(ctx, path)
        }(i, file)
    }

    wg.Wait()
    return results
}

func (e *AnalysisEngine) analyzeFile(ctx context.Context, path string) FileAnalysis {
    // Detect language
    lang := detectLanguage(path)
    parser := e.parsers[lang]

    if parser == nil {
        return FileAnalysis{
            FilePath: path,
            Language: lang,
            Issues:   []Issue{{Type: "info", Message: "Unsupported language"}},
        }
    }

    // Parse file with tree-sitter
    ast, err := parser.Parse(path)
    if err != nil {
        return FileAnalysis{
            FilePath: path,
            Language: lang,
            Issues:   []Issue{{Type: "error", Message: err.Error()}},
        }
    }

    // Calculate metrics
    return FileAnalysis{
        FilePath:    path,
        Language:    lang,
        LinesOfCode: ast.LineCount(),
        Complexity: ComplexityMetrics{
            Cyclomatic:      calculateCyclomaticComplexity(ast),
            Cognitive:       calculateCognitiveComplexity(ast),
            MaxNestingDepth: calculateMaxNesting(ast),
        },
        Functions: FunctionMetrics{
            Total:       countFunctions(ast),
            Documented:  countDocumentedFunctions(ast),
            Tested:      0, // Will be calculated later by matching test files
        },
        HasTypeAnnotations: checkTypeAnnotations(ast, lang),
        Issues:             detectIssues(ast),
    }
}

func (e *AnalysisEngine) calculateMetrics(files []FileAnalysis) []Metric {
    metrics := []Metric{}

    // Modularity Score
    largeFiles := 0
    for _, f := range files {
        if f.LinesOfCode > 500 {
            largeFiles++
        }
    }
    modularityScore := max(0, 100-int(float64(largeFiles)/float64(len(files))*100))
    metrics = append(metrics, Metric{
        Category: "modularity",
        Name:     "file_size",
        Value:    float64(largeFiles),
        Score:    modularityScore,
        Weight:   0.20,
    })

    // Complexity Score
    totalComplexity := 0
    for _, f := range files {
        totalComplexity += f.Complexity.Cyclomatic
    }
    avgComplexity := float64(totalComplexity) / float64(len(files))
    complexityScore := max(0, 100-int(avgComplexity*2)) // Higher complexity = lower score
    metrics = append(metrics, Metric{
        Category: "complexity",
        Name:     "average_cyclomatic",
        Value:    avgComplexity,
        Score:    complexityScore,
        Weight:   0.15,
    })

    // Type Annotation Score
    annotatedFiles := 0
    for _, f := range files {
        if f.HasTypeAnnotations {
            annotatedFiles++
        }
    }
    typeScore := int(float64(annotatedFiles) / float64(len(files)) * 100)
    metrics = append(metrics, Metric{
        Category: "type_annotations",
        Name:     "coverage",
        Value:    float64(typeScore),
        Score:    typeScore,
        Weight:   0.15,
    })

    // Test Coverage Score (simplified - would integrate with coverage tools)
    // For now, check if test files exist
    testFiles := 0
    for _, f := range files {
        if isTestFile(f.FilePath) {
            testFiles++
        }
    }
    testScore := min(100, int(float64(testFiles)/float64(len(files))*200))
    metrics = append(metrics, Metric{
        Category: "test_coverage",
        Name:     "test_files",
        Value:    float64(testScore),
        Score:    testScore,
        Weight:   0.20,
    })

    // Documentation Score
    documentedFunctions := 0
    totalFunctions := 0
    for _, f := range files {
        documentedFunctions += f.Functions.Documented
        totalFunctions += f.Functions.Total
    }
    docScore := 0
    if totalFunctions > 0 {
        docScore = int(float64(documentedFunctions) / float64(totalFunctions) * 100)
    }
    metrics = append(metrics, Metric{
        Category: "documentation",
        Name:     "function_docs",
        Value:    float64(docScore),
        Score:    docScore,
        Weight:   0.15,
    })

    // Naming Score (check for clear naming conventions)
    goodNames := 0
    for _, f := range files {
        if hasGoodNaming(f) {
            goodNames++
        }
    }
    namingScore := int(float64(goodNames) / float64(len(files)) * 100)
    metrics = append(metrics, Metric{
        Category: "naming",
        Name:     "clarity",
        Value:    float64(namingScore),
        Score:    namingScore,
        Weight:   0.10,
    })

    // Dependency Score (detect circular dependencies)
    circularDeps := detectCircularDependencies(files)
    depScore := max(0, 100-len(circularDeps)*10)
    metrics = append(metrics, Metric{
        Category: "dependencies",
        Name:     "circular_dependencies",
        Value:    float64(len(circularDeps)),
        Score:    depScore,
        Weight:   0.05,
    })

    return metrics
}

func (e *AnalysisEngine) computeAIReadinessScore(metrics []Metric) int {
    totalScore := 0.0
    totalWeight := 0.0

    for _, m := range metrics {
        totalScore += float64(m.Score) * m.Weight
        totalWeight += m.Weight
    }

    if totalWeight == 0 {
        return 0
    }

    return int(totalScore / totalWeight)
}

func (e *AnalysisEngine) generateRecommendations(metrics []Metric, files []FileAnalysis) []Recommendation {
    recommendations := []Recommendation{}

    // Recommendation for large files
    largeFiles := []string{}
    for _, f := range files {
        if f.LinesOfCode > 500 {
            largeFiles = append(largeFiles, f.FilePath)
        }
    }
    if len(largeFiles) > 0 {
        recommendations = append(recommendations, Recommendation{
            Priority:    "high",
            Category:    "modularity",
            Title:       fmt.Sprintf("Split %d large files", len(largeFiles)),
            Description: "Files over 500 lines are harder for AI agents to understand. Consider splitting them into smaller modules.",
            FilePaths:   largeFiles,
            EstimatedEffort: estimateEffort(len(largeFiles)),
            ImpactScore: 80,
        })
    }

    // Recommendation for complex functions
    complexFiles := []string{}
    for _, f := range files {
        if f.Complexity.Cyclomatic > 10 {
            complexFiles = append(complexFiles, f.FilePath)
        }
    }
    if len(complexFiles) > 0 {
        recommendations = append(recommendations, Recommendation{
            Priority:    "high",
            Category:    "complexity",
            Title:       fmt.Sprintf("Reduce complexity in %d files", len(complexFiles)),
            Description: "High cyclomatic complexity makes code difficult for AI agents to reason about.",
            FilePaths:   complexFiles,
            EstimatedEffort: estimateEffort(len(complexFiles)),
            ImpactScore: 75,
        })
    }

    // More recommendations...

    return recommendations
}
```

### 4. UI Components (React)

```typescript
// components/AnalysisRunButton.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { PlayIcon } from 'lucide-react';

interface AnalysisRunButtonProps {
  repositoryId: string;
  onAnalysisStarted?: (analysisId: string) => void;
}

export function AnalysisRunButton({ repositoryId, onAnalysisStarted }: AnalysisRunButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleRunAnalysis = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/v1/analysis/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repositoryId }),
      });

      if (!response.ok) {
        throw new Error('Failed to start analysis');
      }

      const data = await response.json();

      toast({
        title: 'Analysis started',
        description: 'Your repository is being analyzed...',
      });

      onAnalysisStarted?.(data.id);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start analysis',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleRunAnalysis}
      disabled={isLoading}
    >
      <PlayIcon className="mr-2 h-4 w-4" />
      {isLoading ? 'Starting...' : 'Run Analysis'}
    </Button>
  );
}

// components/AIReadinessScore.tsx
import { Progress } from '@/components/ui/progress';

interface AIReadinessScoreProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

export function AIReadinessScore({ score, size = 'md' }: AIReadinessScoreProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Work';
  };

  const sizes = {
    sm: { text: 'text-2xl', label: 'text-sm' },
    md: { text: 'text-4xl', label: 'text-base' },
    lg: { text: 'text-6xl', label: 'text-lg' },
  };

  return (
    <div className="flex flex-col items-center">
      <div className={`${sizes[size].text} font-bold ${getScoreColor(score)}`}>
        {score}
      </div>
      <div className={`${sizes[size].label} text-muted-foreground`}>
        {getScoreLabel(score)}
      </div>
      <Progress value={score} className="w-full mt-2" />
    </div>
  );
}

// components/AnalysisMetricsChart.tsx
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';

interface MetricsChartProps {
  metrics: AnalysisMetrics;
}

export function AnalysisMetricsChart({ metrics }: MetricsChartProps) {
  const data = [
    { metric: 'Modularity', score: metrics.modularity.score },
    { metric: 'Complexity', score: metrics.complexity.score },
    { metric: 'Types', score: metrics.typeAnnotations.score },
    { metric: 'Tests', score: metrics.testCoverage.score },
    { metric: 'Docs', score: metrics.documentation.score },
    { metric: 'Naming', score: metrics.naming.score },
  ];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey="metric" />
        <Radar
          name="AI-Readiness"
          dataKey="score"
          stroke="#8884d8"
          fill="#8884d8"
          fillOpacity={0.6}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// app/repositories/[id]/analysis/page.tsx
export default function AnalysisPage({ params }: { params: { id: string } }) {
  const { data: analysis } = useAnalysisRun(params.id);
  const { data: metrics } = useAnalysisMetrics(params.id);
  const { data: recommendations } = useRecommendations(params.id);

  if (!analysis) return <LoadingSpinner />;

  return (
    <div className="container mx-auto py-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>AI-Readiness Score</CardTitle>
          </CardHeader>
          <CardContent>
            <AIReadinessScore score={analysis.aiReadinessScore} size="lg" />
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Metrics Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <AnalysisMetricsChart metrics={metrics} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <RecommendationsList recommendations={recommendations} />
        </CardContent>
      </Card>
    </div>
  );
}
```

### 5. Tests

```typescript
// tests/analysis.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp } from './helpers';
import { createMockRepository } from './fixtures';

describe('Analysis API', () => {
  let app;
  let authToken;
  let repository;

  beforeAll(async () => {
    app = await createTestApp();
    authToken = await app.createTestUser();
    repository = await createMockRepository(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/analysis/run', () => {
    it('should create new analysis run', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/analysis/run',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {
          repositoryId: repository.id,
        },
      });

      expect(response.statusCode).toBe(201);
      const data = response.json();
      expect(data.id).toBeDefined();
      expect(data.status).toBe('pending');
      expect(data.repositoryId).toBe(repository.id);
    });

    it('should reject invalid repository', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/analysis/run',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {
          repositoryId: 'invalid-id',
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/analysis/:id', () => {
    it('should return analysis run status', async () => {
      const analysisRun = await app.createAnalysisRun(repository.id);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/analysis/${analysisRun.id}`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.id).toBe(analysisRun.id);
      expect(data.status).toBeDefined();
    });
  });
});

// tests/analyzer.test.go
package analyzer_test

import (
    "testing"
    "github.com/stretchr/testify/assert"
    "forge-factory/analyzer"
)

func TestAnalyzeFile(t *testing.T) {
    engine := analyzer.NewAnalysisEngine()

    t.Run("analyzes JavaScript file", func(t *testing.T) {
        result := engine.AnalyzeFile("testdata/sample.js")

        assert.Equal(t, "javascript", result.Language)
        assert.Greater(t, result.LinesOfCode, 0)
        assert.NotNil(t, result.Complexity)
    })

    t.Run("detects high complexity", func(t *testing.T) {
        result := engine.AnalyzeFile("testdata/complex.js")

        assert.Greater(t, result.Complexity.Cyclomatic, 10)
        assert.Contains(t, result.Issues, "high_complexity")
    })
}

func TestComputeAIReadinessScore(t *testing.T) {
    engine := analyzer.NewAnalysisEngine()

    metrics := []analyzer.Metric{
        {Category: "modularity", Score: 90, Weight: 0.20},
        {Category: "complexity", Score: 80, Weight: 0.15},
        {Category: "test_coverage", Score: 70, Weight: 0.20},
    }

    score := engine.ComputeAIReadinessScore(metrics)

    // Weighted average: (90*0.2 + 80*0.15 + 70*0.2) / 0.55
    expectedScore := int((18 + 12 + 14) / 0.55)
    assert.Equal(t, expectedScore, score)
}
```

---

## Implementation Plan

### Phase 1: Core Analysis (Weeks 1-3)
- ✓ Database schema and migrations
- ✓ Basic API endpoints
- ✓ File discovery and language detection
- ✓ Tree-sitter parsers for JS/TS
- ✓ Complexity calculation
- ✓ Basic AI-readiness score

### Phase 2: Extended Metrics (Weeks 4-5)
- ✓ Test coverage integration
- ✓ Documentation coverage analysis
- ✓ Type annotation checking
- ✓ Dependency graph analysis
- ✓ All metric categories

### Phase 3: UI & Visualizations (Week 6)
- ✓ Analysis run page
- ✓ Metrics dashboard
- ✓ Recommendations list
- ✓ File-level drill-down

### Phase 4: Additional Languages (Weeks 7-8)
- ✓ Python support
- ✓ Java support
- ✓ Go support
- ✓ Language-specific rules

### Phase 5: Polish & Performance (Week 9)
- ✓ Caching strategy
- ✓ Performance optimization
- ✓ Error handling
- ✓ Documentation

---

## Success Metrics

- **Performance:** <5 min for 100K LOC
- **Accuracy:** AI-readiness score correlates with manual assessment (R² > 0.8)
- **Completeness:** 80%+ test coverage
- **Usability:** Users understand recommendations without documentation

---

## Open Questions

1. Should we store ASTs for future re-analysis, or always parse fresh?
2. What's the right balance between speed and thoroughness?
3. How to handle monorepos with multiple languages?
4. Should we integrate with existing coverage tools (Codecov, Coveralls)?

---

**Status:** Ready for implementation
