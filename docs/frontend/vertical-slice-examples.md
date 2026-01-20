# Vertical Slice UI Examples

**Version:** 1.0
**Date:** 2026-01-19
**Status:** Draft

---

## Overview

This document provides complete vertical slice implementations for each major feature, showing the full stack from UI components through to API integration.

---

## Feature 1: Repository Analyzer UI

### Page Structure

```
app/(app)/repositories/[id]/analysis/page.tsx      (Server Component)
  ↓
components/features/analysis/analysis-view.tsx    (Client Component)
  ├── components/features/analysis/ai-readiness-score.tsx
  ├── components/features/analysis/metrics-chart.tsx
  ├── components/features/analysis/recommendations-list.tsx
  └── components/features/analysis/file-heatmap.tsx
```

### Implementation

```typescript
/**
 * @prompt-id forge-v4.1:feature:analysis:page:001
 */

// app/(app)/repositories/[id]/analysis/page.tsx
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getRepository, getLatestAnalysis } from '@/lib/api/repositories';
import { AnalysisView } from '@/components/features/analysis/analysis-view';
import { AnalysisViewSkeleton } from '@/components/features/analysis/analysis-view-skeleton';

export default async function AnalysisPage({
  params,
}: {
  params: { id: string };
}) {
  const repository = await getRepository(params.id);

  if (!repository) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{repository.name}</h1>
          <p className="text-muted-foreground">Repository Analysis</p>
        </div>
      </div>

      <Suspense fallback={<AnalysisViewSkeleton />}>
        <AnalysisContent repositoryId={params.id} />
      </Suspense>
    </div>
  );
}

async function AnalysisContent({ repositoryId }: { repositoryId: string }) {
  const analysis = await getLatestAnalysis(repositoryId);

  if (!analysis) {
    return <NoAnalysisState repositoryId={repositoryId} />;
  }

  return <AnalysisView analysis={analysis} />;
}

/**
 * @prompt-id forge-v4.1:feature:analysis:view:001
 */

// components/features/analysis/analysis-view.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AIReadinessScore } from './ai-readiness-score';
import { MetricsChart } from './metrics-chart';
import { RecommendationsList } from './recommendations-list';
import { FileHeatmap } from './file-heatmap';
import { TrendChart } from './trend-chart';
import type { AnalysisRun } from '@/types/api';

interface AnalysisViewProps {
  analysis: AnalysisRun;
}

export function AnalysisView({ analysis }: AnalysisViewProps) {
  return (
    <div className="space-y-6">
      {/* AI-Readiness Score Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>AI-Readiness Score</CardTitle>
          </CardHeader>
          <CardContent>
            <AIReadinessScore score={analysis.aiReadinessScore} size="lg" />
            <p className="text-sm text-muted-foreground mt-4">
              Last analyzed {formatDistanceToNow(analysis.completedAt)} ago
            </p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Metrics Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <MetricsChart metrics={analysis.metrics} />
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="recommendations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="files">File Analysis</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="recommendations" className="space-y-4">
          <RecommendationsList analysisId={analysis.id} />
        </TabsContent>

        <TabsContent value="files" className="space-y-4">
          <FileHeatmap analysisId={analysis.id} />
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI-Readiness Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <TrendChart repositoryId={analysis.repositoryId} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * @prompt-id forge-v4.1:feature:analysis:recommendations:001
 */

// components/features/analysis/recommendations-list.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, AlertTriangle, Info, Sparkles } from 'lucide-react';
import { api } from '@/lib/api/client';

interface RecommendationsListProps {
  analysisId: string;
}

export function RecommendationsList({ analysisId }: RecommendationsListProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['recommendations', analysisId],
    queryFn: () => api.get(`v1/analysis/${analysisId}/recommendations`).json(),
  });

  if (isLoading) {
    return <RecommendationsSkeleton />;
  }

  if (!data?.recommendations?.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center min-h-[300px] space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-green-600" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold">Excellent work! 🎉</h3>
            <p className="text-muted-foreground">
              No recommendations. Your codebase is highly AI-ready.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {data.recommendations.map((rec) => (
        <RecommendationCard key={rec.id} recommendation={rec} />
      ))}
    </div>
  );
}

function RecommendationCard({ recommendation }) {
  const priorityConfig = {
    critical: {
      icon: AlertCircle,
      color: 'text-red-600',
      bg: 'bg-red-50',
      badge: 'error',
    },
    high: {
      icon: AlertTriangle,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      badge: 'warning',
    },
    medium: {
      icon: Info,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
      badge: 'warning',
    },
    low: {
      icon: Info,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      badge: 'info',
    },
  };

  const config = priorityConfig[recommendation.priority];
  const Icon = config.icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className={`p-2 rounded-lg ${config.bg}`}>
              <Icon className={`w-5 h-5 ${config.color}`} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <CardTitle className="text-lg">{recommendation.title}</CardTitle>
                <Badge variant={config.badge}>{recommendation.priority}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {recommendation.description}
              </p>
            </div>
          </div>
          <Badge variant="outline">{recommendation.estimatedEffort}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Affected Files:</p>
            <div className="flex flex-wrap gap-2">
              {recommendation.filePaths.slice(0, 5).map((path) => (
                <Badge key={path} variant="secondary" className="font-mono text-xs">
                  {path}
                </Badge>
              ))}
              {recommendation.filePaths.length > 5 && (
                <Badge variant="secondary">
                  +{recommendation.filePaths.length - 5} more
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button>Apply Refactoring</Button>
            <Button variant="outline">Learn More</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Feature 2: CLAUDE.md Generator UI

```typescript
/**
 * @prompt-id forge-v4.1:feature:claude-md:dialog:001
 */

// components/features/claude-md/claude-md-dialog.tsx
'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, FileText, Loader2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';

interface ClaudeMdDialogProps {
  repositoryId: string;
}

export function ClaudeMdDialog({ repositoryId }: ClaudeMdDialogProps) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState({
    maxLines: 200,
    tone: 'concise' as 'concise' | 'detailed' | 'friendly',
    includeExamples: true,
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      api.post('v1/claude-md/generate', {
        json: { repositoryId, settings },
      }).json(),
    onSuccess: (data) => {
      toast.success('CLAUDE.md generation started', {
        description: 'We\'ll notify you when it\'s ready',
      });
      setOpen(false);
    },
    onError: () => {
      toast.error('Failed to start generation');
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Sparkles className="mr-2 h-4 w-4" />
          Generate CLAUDE.md
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Generate CLAUDE.md</DialogTitle>
          <DialogDescription>
            Create an AI agent constitution file for your repository
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>Maximum Lines</Label>
            <Select
              value={settings.maxLines.toString()}
              onValueChange={(value) =>
                setSettings({ ...settings, maxLines: parseInt(value) })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="150">150 lines</SelectItem>
                <SelectItem value="200">200 lines (recommended)</SelectItem>
                <SelectItem value="300">300 lines</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tone</Label>
            <Select
              value={settings.tone}
              onValueChange={(value: any) => setSettings({ ...settings, tone: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="concise">Concise</SelectItem>
                <SelectItem value="detailed">Detailed</SelectItem>
                <SelectItem value="friendly">Friendly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="examples" className="flex flex-col space-y-1">
              <span>Include Examples</span>
              <span className="font-normal text-sm text-muted-foreground">
                Add code examples where helpful
              </span>
            </Label>
            <Switch
              id="examples"
              checked={settings.includeExamples}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, includeExamples: checked })
              }
            />
          </div>
        </div>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Generate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * @prompt-id forge-v4.1:feature:claude-md:preview:001
 */

// components/features/claude-md/claude-md-preview.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Download, Edit } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { toast } from 'sonner';

interface ClaudeMdPreviewProps {
  content: string;
  onEdit?: () => void;
}

export function ClaudeMdPreview({ content, onEdit }: ClaudeMdPreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'CLAUDE.md';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded CLAUDE.md');
  };

  const lineCount = content.split('\n').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle>CLAUDE.md</CardTitle>
            <p className="text-sm text-muted-foreground">
              {lineCount} lines
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              <Copy className="h-4 w-4 mr-2" />
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            {onEdit && (
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="preview">
          <TabsList>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="source">Source</TabsTrigger>
          </TabsList>
          <TabsContent value="preview" className="mt-4">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <SyntaxHighlighter language={match[1]} PreTag="div">
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          </TabsContent>
          <TabsContent value="source" className="mt-4">
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
              <code>{content}</code>
            </pre>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
```

---

## Feature 3: Repository List with Filters

```typescript
/**
 * @prompt-id forge-v4.1:feature:repositories:list:001
 */

// app/(app)/repositories/page.tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search } from 'lucide-react';
import { RepositoryCard } from '@/components/features/repository/repository-card';
import { RepositoryCardSkeleton } from '@/components/features/repository/repository-card-skeleton';
import { EmptyState } from '@/components/layouts/empty-state';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { api } from '@/lib/api/client';

export default function RepositoriesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('updated');

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['repositories', { search: debouncedSearch, status, sortBy }],
    queryFn: () =>
      api.get('v1/repositories', {
        searchParams: {
          search: debouncedSearch,
          status: status !== 'all' ? status : undefined,
          sortBy,
        },
      }).json(),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Repositories</h1>
          <p className="text-muted-foreground">
            Manage and analyze your repositories
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Connect Repository
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search repositories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">Recently Updated</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="score">AI-Readiness Score</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Repository List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <RepositoryCardSkeleton key={i} />
          ))}
        </div>
      ) : data?.repositories?.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.repositories.map((repo) => (
            <RepositoryCard key={repo.id} repository={repo} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<FolderIcon className="w-12 h-12 text-muted-foreground" />}
          title="No repositories found"
          description="Try adjusting your filters or connect a new repository"
        />
      )}
    </div>
  );
}
```

---

## Complete Component Testing Example

```typescript
/**
 * @prompt-id forge-v4.1:test:repository-card:001
 */

// components/features/repository/__tests__/repository-card.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RepositoryCard } from '../repository-card';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('RepositoryCard', () => {
  const mockRepository = {
    id: '123',
    name: 'test-repo',
    owner: 'john-doe',
    aiReadinessScore: 75,
    status: 'active',
    lastAnalyzedAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date('2024-01-01').toISOString(),
  };

  it('renders repository information', () => {
    render(<RepositoryCard repository={mockRepository} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('test-repo')).toBeInTheDocument();
    expect(screen.getByText('john-doe')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();
  });

  it('shows correct status badge', () => {
    render(<RepositoryCard repository={mockRepository} />, {
      wrapper: createWrapper(),
    });

    const badge = screen.getByText('active');
    expect(badge).toHaveClass('bg-green-500');
  });

  it('navigates to repository page on click', async () => {
    const user = userEvent.setup();
    const mockRouter = vi.fn();

    render(<RepositoryCard repository={mockRepository} onNavigate={mockRouter} />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole('article'));

    expect(mockRouter).toHaveBeenCalledWith(`/repositories/${mockRepository.id}`);
  });

  it('applies correct color class based on score', () => {
    const { rerender } = render(
      <RepositoryCard repository={{ ...mockRepository, aiReadinessScore: 85 }} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('85')).toHaveClass('text-green-600');

    rerender(
      <RepositoryCard repository={{ ...mockRepository, aiReadinessScore: 45 }} />
    );

    expect(screen.getByText('45')).toHaveClass('text-red-600');
  });
});
```

---

**Status:** Living document - add more vertical slice examples as features are implemented
