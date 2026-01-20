# ADR-006: Dashboard Architecture and Analytics

## Status
Accepted

## Context
Forge Factory needs comprehensive dashboards for multiple user personas:
1. **Developer Dashboard**: Code analysis, tasks, workflows, agent status
2. **Team Lead Dashboard**: Team metrics, project health, velocity
3. **Admin Dashboard**: System health, tenant usage, billing metrics
4. **Executive Dashboard**: High-level business metrics, trends, ROI

Requirements:
- Real-time updates for critical metrics
- Fast load times (< 2s initial, < 500ms updates)
- Interactive visualizations with drill-down
- Customizable widgets and layouts
- Export capabilities (PDF, CSV)
- Mobile-responsive
- Historical data and trends
- Predictive analytics (future)

## Decision
We will build a **modular, widget-based dashboard system** using **Recharts** for visualizations, with **real-time updates via Socket.io** and **server-side aggregation** for performance.

### Dashboard Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  Dashboard System Architecture                │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Presentation Layer (React Components)                 │ │
│  │  - Dashboard Shell (layout, toolbar)                   │ │
│  │  - Widget Container (drag-and-drop, resize)            │ │
│  │  - Chart Components (line, bar, pie, etc.)             │ │
│  └────────────────────────────────────────────────────────┘ │
│                         ↓                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Data Layer (TanStack Query + Socket.io)              │ │
│  │  - Query hooks (useDashboardMetrics)                   │ │
│  │  - Real-time subscriptions                             │ │
│  │  - Cache invalidation strategies                       │ │
│  └────────────────────────────────────────────────────────┘ │
│                         ↓                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  API Layer (NestJS + Redis)                           │ │
│  │  - Metrics aggregation endpoints                       │ │
│  │  - Real-time event streaming                           │ │
│  │  - Query optimization with caching                     │ │
│  └────────────────────────────────────────────────────────┘ │
│                         ↓                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Storage Layer (PostgreSQL + Redis)                   │ │
│  │  - Time-series data (metrics_events table)            │ │
│  │  - Pre-aggregated metrics (hourly, daily)             │ │
│  │  - Redis cache for hot data                            │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

## Implementation

### 1. Dashboard Data Model

```typescript
// packages/shared-types/dashboard.ts
export interface DashboardConfig {
  id: string;
  tenantId: string;
  userId: string;
  name: string;
  type: 'developer' | 'team_lead' | 'admin' | 'executive' | 'custom';
  layout: DashboardLayout;
  widgets: Widget[];
  refreshInterval: number; // seconds
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardLayout {
  columns: number;
  gap: number;
  items: LayoutItem[];
}

export interface LayoutItem {
  widgetId: string;
  x: number;
  y: number;
  w: number; // width in grid units
  h: number; // height in grid units
  minW?: number;
  minH?: number;
}

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  config: WidgetConfig;
  dataSource: DataSource;
  refreshInterval?: number;
}

export type WidgetType =
  | 'metric-card'
  | 'line-chart'
  | 'bar-chart'
  | 'pie-chart'
  | 'area-chart'
  | 'table'
  | 'list'
  | 'heatmap'
  | 'gauge'
  | 'timeline'
  | 'leaderboard'
  | 'activity-feed';

export interface DataSource {
  type: 'api' | 'websocket' | 'calculated';
  endpoint?: string;
  queryParams?: Record<string, any>;
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
  groupBy?: string;
  timeRange?: TimeRange;
}

export interface TimeRange {
  type: 'relative' | 'absolute';
  relative?: {
    value: number;
    unit: 'hour' | 'day' | 'week' | 'month' | 'year';
  };
  absolute?: {
    start: Date;
    end: Date;
  };
}
```

### 2. Dashboard Shell Component

```tsx
// apps/portal/app/(dashboard)/page.tsx
'use client';

import { useState } from 'react';
import { DashboardGrid } from '@/components/dashboard/dashboard-grid';
import { DashboardToolbar } from '@/components/dashboard/dashboard-toolbar';
import { useDashboardConfig } from '@/hooks/use-dashboard';
import { useRealTimeMetrics } from '@/hooks/use-real-time-metrics';

export default function DashboardPage() {
  const { data: config, isLoading } = useDashboardConfig();
  const [timeRange, setTimeRange] = useState<TimeRange>({
    type: 'relative',
    relative: { value: 7, unit: 'day' },
  });
  const [isEditMode, setIsEditMode] = useState(false);

  // Subscribe to real-time updates
  useRealTimeMetrics({
    widgets: config?.widgets ?? [],
    timeRange,
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="flex flex-col h-full">
      <DashboardToolbar
        config={config}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        isEditMode={isEditMode}
        onEditModeChange={setIsEditMode}
      />
      <DashboardGrid
        layout={config.layout}
        widgets={config.widgets}
        isEditMode={isEditMode}
        timeRange={timeRange}
      />
    </div>
  );
}
```

### 3. Widget System

#### Base Widget Component

```tsx
// packages/ui/components/dashboard/widget.tsx
'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MoreVertical, RefreshCw } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Widget as WidgetType } from '@forge/shared-types';

interface WidgetProps {
  widget: WidgetType;
  timeRange: TimeRange;
  onRefresh?: () => void;
  onConfigure?: () => void;
  onRemove?: () => void;
  children: React.ReactNode;
}

export function Widget({
  widget,
  timeRange,
  onRefresh,
  onConfigure,
  onRemove,
  children,
}: WidgetProps) {
  return (
    <Card className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">{widget.title}</h3>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              className="h-8 w-8"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onConfigure && (
                <DropdownMenuItem onClick={onConfigure}>
                  Configure
                </DropdownMenuItem>
              )}
              <DropdownMenuItem>Export Data</DropdownMenuItem>
              {onRemove && (
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={onRemove}
                >
                  Remove
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="flex-1 p-4 overflow-auto">{children}</div>
    </Card>
  );
}
```

#### Metric Card Widget

```tsx
// packages/ui/components/dashboard/widgets/metric-card-widget.tsx
'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Widget } from '../widget';
import { Skeleton } from '@/components/ui/skeleton';

interface MetricCardWidgetProps {
  widget: WidgetType;
  timeRange: TimeRange;
}

export function MetricCardWidget({ widget, timeRange }: MetricCardWidgetProps) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['widget', widget.id, timeRange],
    queryFn: () => fetchWidgetData(widget.dataSource, timeRange),
    refetchInterval: widget.refreshInterval ? widget.refreshInterval * 1000 : false,
  });

  const renderContent = () => {
    if (isLoading) {
      return <Skeleton className="h-24" />;
    }

    const trend = data.change > 0 ? 'up' : 'down';
    const TrendIcon = trend === 'up' ? TrendingUp : TrendingDown;
    const trendColor = trend === 'up' ? 'text-success' : 'text-destructive';

    return (
      <div className="flex flex-col">
        <div className="text-3xl font-bold">{formatNumber(data.value)}</div>
        <div className="flex items-center gap-2 mt-2">
          <TrendIcon className={`h-4 w-4 ${trendColor}`} />
          <span className={`text-sm ${trendColor}`}>
            {Math.abs(data.change)}%
          </span>
          <span className="text-sm text-muted-foreground">vs last period</span>
        </div>
      </div>
    );
  };

  return (
    <Widget widget={widget} timeRange={timeRange} onRefresh={() => refetch()}>
      {renderContent()}
    </Widget>
  );
}
```

#### Line Chart Widget

```tsx
// packages/ui/components/dashboard/widgets/line-chart-widget.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Widget } from '../widget';
import { Skeleton } from '@/components/ui/skeleton';

interface LineChartWidgetProps {
  widget: WidgetType;
  timeRange: TimeRange;
}

export function LineChartWidget({ widget, timeRange }: LineChartWidgetProps) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['widget', widget.id, timeRange],
    queryFn: () => fetchWidgetData(widget.dataSource, timeRange),
    refetchInterval: widget.refreshInterval ? widget.refreshInterval * 1000 : false,
  });

  const renderContent = () => {
    if (isLoading) {
      return <Skeleton className="h-64" />;
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(value) => formatDate(value)}
          />
          <YAxis />
          <Tooltip
            labelFormatter={(value) => formatDate(value)}
            formatter={(value: number) => formatNumber(value)}
          />
          <Legend />
          {widget.config.series.map((series, index) => (
            <Line
              key={series.key}
              type="monotone"
              dataKey={series.key}
              stroke={series.color}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  };

  return (
    <Widget widget={widget} timeRange={timeRange} onRefresh={() => refetch()}>
      {renderContent()}
    </Widget>
  );
}
```

### 4. Dashboard Grid with Drag & Drop

```tsx
// apps/portal/components/dashboard/dashboard-grid.tsx
'use client';

import { Responsive, WidthProvider } from 'react-grid-layout';
import { WidgetRenderer } from './widget-renderer';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DashboardGridProps {
  layout: DashboardLayout;
  widgets: Widget[];
  isEditMode: boolean;
  timeRange: TimeRange;
}

export function DashboardGrid({
  layout,
  widgets,
  isEditMode,
  timeRange,
}: DashboardGridProps) {
  const handleLayoutChange = (newLayout: Layout[]) => {
    if (!isEditMode) return;
    // Save layout to backend
    saveDashboardLayout(newLayout);
  };

  return (
    <ResponsiveGridLayout
      className="layout"
      layouts={{ lg: layout.items }}
      breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
      cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
      rowHeight={80}
      isDraggable={isEditMode}
      isResizable={isEditMode}
      onLayoutChange={handleLayoutChange}
    >
      {widgets.map((widget) => (
        <div key={widget.id}>
          <WidgetRenderer widget={widget} timeRange={timeRange} />
        </div>
      ))}
    </ResponsiveGridLayout>
  );
}
```

### 5. Real-time Metrics Hook

```typescript
// hooks/use-real-time-metrics.ts
'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { initializeSocket } from '@/lib/socket';
import { Widget, TimeRange } from '@forge/shared-types';

export function useRealTimeMetrics({
  widgets,
  timeRange,
}: {
  widgets: Widget[];
  timeRange: TimeRange;
}) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = initializeSocket();

    // Subscribe to metric updates for each widget
    widgets.forEach((widget) => {
      if (widget.dataSource.type === 'websocket') {
        socket.on(`metrics:${widget.id}`, (data) => {
          queryClient.setQueryData(['widget', widget.id, timeRange], data);
        });
      }
    });

    // Subscribe to system-wide metric updates
    socket.on('metrics:update', ({ widgetId, data }) => {
      const widget = widgets.find((w) => w.id === widgetId);
      if (widget) {
        queryClient.setQueryData(['widget', widgetId, timeRange], data);
      }
    });

    return () => {
      widgets.forEach((widget) => {
        socket.off(`metrics:${widget.id}`);
      });
      socket.off('metrics:update');
    };
  }, [widgets, timeRange, queryClient]);
}
```

### 6. Backend Metrics API

```typescript
// apps/api/src/modules/analytics/analytics.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { TenantGuard } from '@/guards/tenant.guard';
import { AnalyticsService } from './analytics.service';
import { TimeRangeDto, MetricQueryDto } from './dto';

@Controller('analytics')
@UseGuards(TenantGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('metrics/tasks')
  async getTaskMetrics(
    @Query() timeRange: TimeRangeDto,
    @TenantId() tenantId: string,
  ) {
    return this.analyticsService.getTaskMetrics(tenantId, timeRange);
  }

  @Get('metrics/workflows')
  async getWorkflowMetrics(
    @Query() timeRange: TimeRangeDto,
    @TenantId() tenantId: string,
  ) {
    return this.analyticsService.getWorkflowMetrics(tenantId, timeRange);
  }

  @Get('metrics/agents')
  async getAgentMetrics(
    @Query() timeRange: TimeRangeDto,
    @TenantId() tenantId: string,
  ) {
    return this.analyticsService.getAgentMetrics(tenantId, timeRange);
  }

  @Get('metrics/custom')
  async getCustomMetric(
    @Query() query: MetricQueryDto,
    @TenantId() tenantId: string,
  ) {
    return this.analyticsService.executeCustomQuery(tenantId, query);
  }
}
```

```typescript
// apps/api/src/modules/analytics/analytics.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@forge/prisma';
import { RedisService } from '@/services/redis.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getTaskMetrics(tenantId: string, timeRange: TimeRangeDto) {
    const cacheKey = `metrics:tasks:${tenantId}:${JSON.stringify(timeRange)}`;

    // Check cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Query aggregated metrics
    const metrics = await this.prisma.$queryRaw`
      SELECT
        DATE_TRUNC('day', created_at) as date,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_duration
      FROM tasks
      WHERE tenant_id = ${tenantId}
        AND created_at >= ${timeRange.start}
        AND created_at <= ${timeRange.end}
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date ASC
    `;

    // Cache for 5 minutes
    await this.redis.setex(cacheKey, 300, JSON.stringify(metrics));

    return metrics;
  }
}
```

### 7. Pre-Aggregated Metrics (Background Job)

```typescript
// apps/api/src/jobs/metrics-aggregation.job.ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@forge/prisma';

@Injectable()
export class MetricsAggregationJob {
  constructor(private readonly prisma: PrismaService) {}

  // Run every hour
  @Cron(CronExpression.EVERY_HOUR)
  async aggregateHourlyMetrics() {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Aggregate task metrics
    await this.prisma.$executeRaw`
      INSERT INTO metrics_hourly (tenant_id, metric_type, period, data)
      SELECT
        tenant_id,
        'tasks' as metric_type,
        DATE_TRUNC('hour', created_at) as period,
        jsonb_build_object(
          'total', COUNT(*),
          'completed', COUNT(*) FILTER (WHERE status = 'completed'),
          'failed', COUNT(*) FILTER (WHERE status = 'failed')
        ) as data
      FROM tasks
      WHERE created_at >= ${hourAgo}
      GROUP BY tenant_id, DATE_TRUNC('hour', created_at)
      ON CONFLICT (tenant_id, metric_type, period)
      DO UPDATE SET data = EXCLUDED.data
    `;
  }

  // Run daily at midnight
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async aggregateDailyMetrics() {
    // Similar aggregation for daily metrics
  }
}
```

## Dashboard Templates

### Developer Dashboard
- Tasks overview (todo, in progress, completed)
- Recent repository analysis results
- Active workflows
- Agent status and history
- Code quality trends
- Recent activity feed

### Team Lead Dashboard
- Team velocity and throughput
- Sprint progress and burndown
- Code review metrics
- Blockers and bottlenecks
- Team member performance
- Project health indicators

### Admin Dashboard
- System health (CPU, memory, errors)
- Tenant usage and activity
- API rate limits and quotas
- Billing and revenue metrics
- User growth and churn
- Support ticket metrics

### Executive Dashboard
- Business KPIs (MRR, ARR, growth rate)
- Customer acquisition and retention
- Product adoption metrics
- ROI and cost efficiency
- Market trends and benchmarks

## Performance Optimization

### Caching Strategy
- **Redis Cache**: 5-minute TTL for aggregated metrics
- **Browser Cache**: TanStack Query with 1-minute stale time
- **Pre-aggregation**: Hourly and daily rollups
- **CDN**: Static assets and chart images

### Query Optimization
- **Indexed Columns**: timestamp, tenant_id, status
- **Materialized Views**: Complex aggregations
- **Partitioning**: Time-series data by month
- **Read Replicas**: Route analytics queries to replica

### Rendering Optimization
- **Lazy Loading**: Render visible widgets first
- **Virtualization**: Virtual scrolling for large datasets
- **Debouncing**: Batch real-time updates
- **Web Workers**: Heavy calculations off main thread

## Consequences

### Positive
- **Real-time Insights**: Live updates for critical metrics
- **Customizable**: Users can configure their own dashboards
- **Performant**: Fast load times with caching and pre-aggregation
- **Scalable**: Handles large datasets with pagination and aggregation
- **Accessible**: Keyboard navigation, screen reader support

### Negative
- **Complexity**: Widget system adds architectural complexity
- **Cost**: Real-time updates consume server resources
- **Data Consistency**: Cache invalidation can be tricky

### Mitigations
- **Documentation**: Clear guide for creating new widgets
- **Throttling**: Rate limit real-time updates
- **Cache Strategy**: Well-defined TTLs and invalidation rules

## Alternatives Considered

### 1. Pre-built Analytics Platform (Mixpanel, Amplitude)
**Rejected**: Expensive, data leaves our control, limited customization.

### 2. Business Intelligence Tool (Tableau, Looker)
**Rejected**: Overkill for our needs, not developer-friendly, high cost.

### 3. Custom D3.js Visualizations
**Rejected**: Too time-consuming, Recharts is sufficient and well-maintained.

### 4. Server-Side Rendering for All Charts
**Rejected**: Poor interactivity, increases server load.

## References
- [Recharts Documentation](https://recharts.org/)
- [React Grid Layout](https://github.com/react-grid-layout/react-grid-layout)
- [TanStack Query Caching](https://tanstack.com/query/latest/docs/react/guides/caching)
- [PostgreSQL Time-Series Data](https://www.timescale.com/blog/time-series-data-postgresql-10-vs-timescaledb-816ee808bac5/)

## Review Date
2024-05-16 (3 months)
