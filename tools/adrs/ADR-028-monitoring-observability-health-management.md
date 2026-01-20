# ADR-028: Monitoring, Observability & Health Management for Projects

## Status
Accepted

## Context

Managing hundreds of transformation projects requires comprehensive monitoring and observability to ensure system health, detect issues early, and provide actionable insights. Each project needs individual health tracking while maintaining platform-wide observability across the entire portfolio.

### Requirements

**Monitoring Requirements:**
- Real-time metrics for 1000+ projects
- Health status for each project
- Resource usage tracking
- Performance monitoring
- Error rate tracking
- Dependency health monitoring

**Observability Requirements:**
- Centralized logging for all projects
- Distributed tracing across services
- Custom metrics and dashboards
- Alerting and incident management
- Root cause analysis capabilities
- Audit logging for compliance

**Health Management Requirements:**
- Automated health checks
- Health scoring (0-100)
- Anomaly detection
- Predictive health analytics
- Automated remediation
- Health trend analysis

**Scale Requirements:**
- Support 1000+ projects
- Process 100K+ metrics/second
- Store 30 days of metrics
- 90 days of logs
- Sub-second query performance

### Current Challenges

1. **No Unified Observability:** Each project has siloed monitoring
2. **Alert Fatigue:** Too many false positives
3. **Slow Incident Response:** Difficult to identify root causes
4. **No Predictive Analysis:** React to issues vs. prevent them
5. **Manual Health Checks:** No automated health assessment
6. **Cost:** Expensive monitoring infrastructure

## Decision

We will implement a **Multi-Tier Observability Stack** combining metrics (Prometheus), logs (Loki), traces (Tempo), and a unified health scoring system with automated checks and intelligent alerting.

### Architecture

```
┌────────────────────────────────────────────────────────────┐
│                   Observability Stack                      │
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Prometheus  │  │     Loki     │  │    Tempo     │    │
│  │   (Metrics)  │  │    (Logs)    │  │   (Traces)   │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                  │                  │            │
│         └──────────────────┴──────────────────┘            │
│                            │                               │
│                            ▼                               │
│                   ┌─────────────────┐                      │
│                   │     Grafana     │                      │
│                   │  (Dashboards)   │                      │
│                   └─────────────────┘                      │
└────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────┐
│                  Health Management Layer                   │
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Health     │  │   Anomaly    │  │   Alert      │    │
│  │   Scoring    │  │  Detection   │  │  Manager     │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└────────────────────────────────────────────────────────────┘

Project Metrics Collection:

Project 1 ──►  Metrics  ──┐
Project 2 ──►  Logs     ──┤
Project 3 ──►  Traces   ──┼──► Observability Stack
Project ...──►  Events   ──┤
Project N ──►  Metrics  ──┘
```

### Metrics Collection

```yaml
# apps/infrastructure/monitoring/prometheus-config.yaml

global:
  scrape_interval: 15s
  evaluation_interval: 15s

# Scrape configurations per project namespace
scrape_configs:
  # Platform metrics
  - job_name: 'forge-platform'
    kubernetes_sd_configs:
      - role: pod
        namespaces:
          names:
            - forge-platform
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true

  # Project metrics (1000+ projects)
  - job_name: 'forge-projects'
    kubernetes_sd_configs:
      - role: pod
        namespaces:
          names:
            - project-*
    relabel_configs:
      - source_labels: [__meta_kubernetes_namespace]
        target_label: project_id
        regex: project-(.*)
      - source_labels: [__meta_kubernetes_pod_label_forge_io_organization_id]
        target_label: organization_id
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)

# Recording rules for efficient queries
rule_files:
  - /etc/prometheus/rules/*.yml
```

```yaml
# apps/infrastructure/monitoring/prometheus-rules.yaml

groups:
  - name: project_health
    interval: 30s
    rules:
      # Aggregate metrics per project
      - record: project:cpu_usage:rate5m
        expr: |
          sum(rate(container_cpu_usage_seconds_total{namespace=~"project-.*"}[5m]))
          by (namespace)

      - record: project:memory_usage:bytes
        expr: |
          sum(container_memory_usage_bytes{namespace=~"project-.*"})
          by (namespace)

      - record: project:http_requests:rate1m
        expr: |
          sum(rate(http_requests_total{namespace=~"project-.*"}[1m]))
          by (namespace)

      - record: project:http_errors:rate1m
        expr: |
          sum(rate(http_requests_total{namespace=~"project-.*",status=~"5.."}[1m]))
          by (namespace)

      - record: project:error_rate:ratio
        expr: |
          project:http_errors:rate1m / project:http_requests:rate1m

      - record: project:response_time:p95
        expr: |
          histogram_quantile(0.95,
            sum(rate(http_request_duration_seconds_bucket{namespace=~"project-.*"}[5m]))
            by (namespace, le)
          )

      # Health score calculation
      - record: project:health_score
        expr: |
          (
            (1 - project:error_rate:ratio) * 0.4 +
            (1 - min(project:cpu_usage:rate5m / project:cpu_quota, 1)) * 0.2 +
            (1 - min(project:memory_usage:bytes / project:memory_quota, 1)) * 0.2 +
            (max(0, 1 - project:response_time:p95 / 5)) * 0.2
          ) * 100

  - name: project_alerts
    interval: 30s
    rules:
      - alert: ProjectHighErrorRate
        expr: project:error_rate:ratio > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate in {{ $labels.namespace }}"
          description: "Error rate is {{ $value | humanizePercentage }}"

      - alert: ProjectCriticalErrorRate
        expr: project:error_rate:ratio > 0.20
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Critical error rate in {{ $labels.namespace }}"
          description: "Error rate is {{ $value | humanizePercentage }}"

      - alert: ProjectResourceExhaustion
        expr: |
          project:cpu_usage:rate5m / project:cpu_quota > 0.9 or
          project:memory_usage:bytes / project:memory_quota > 0.9
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Resource exhaustion in {{ $labels.namespace }}"

      - alert: ProjectHealthDegraded
        expr: project:health_score < 70
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Project health degraded: {{ $labels.namespace }}"
          description: "Health score is {{ $value }}"

      - alert: ProjectHealthCritical
        expr: project:health_score < 50
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Project health critical: {{ $labels.namespace }}"
          description: "Health score is {{ $value }}"
```

### Health Check System

```typescript
// apps/core/src/lib/services/health-management/

interface HealthCheck {
  name: string;
  description: string;
  category: HealthCategory;
  weight: number; // 0-1 (contribution to overall score)
  execute: (project: TransformationProject) => Promise<HealthCheckResult>;
}

enum HealthCategory {
  PERFORMANCE = 'performance',
  RELIABILITY = 'reliability',
  SECURITY = 'security',
  DEPENDENCIES = 'dependencies',
  INFRASTRUCTURE = 'infrastructure',
  COMPLIANCE = 'compliance',
}

interface HealthCheckResult {
  passed: boolean;
  score: number; // 0-100
  message: string;
  metadata?: Record<string, any>;
  severity?: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  recommendations?: string[];
}

class ProjectHealthManager {
  private checks: HealthCheck[] = [
    // Performance checks
    {
      name: 'API Response Time',
      description: 'Check API p95 response time < 1s',
      category: HealthCategory.PERFORMANCE,
      weight: 0.15,
      execute: async (project) => {
        const p95 = await this.metrics.query(
          `project:response_time:p95{namespace="project-${project.id}"}`
        );
        const passed = p95 < 1.0;
        const score = Math.max(0, 100 - (p95 / 1.0) * 50);

        return {
          passed,
          score,
          message: `P95 response time: ${p95.toFixed(2)}s`,
          severity: p95 > 2 ? 'CRITICAL' : p95 > 1 ? 'WARNING' : 'INFO',
        };
      },
    },

    {
      name: 'Error Rate',
      description: 'Check error rate < 1%',
      category: HealthCategory.RELIABILITY,
      weight: 0.25,
      execute: async (project) => {
        const errorRate = await this.metrics.query(
          `project:error_rate:ratio{namespace="project-${project.id}"}`
        );
        const passed = errorRate < 0.01;
        const score = Math.max(0, 100 - errorRate * 10000);

        return {
          passed,
          score,
          message: `Error rate: ${(errorRate * 100).toFixed(2)}%`,
          severity: errorRate > 0.05 ? 'CRITICAL' : errorRate > 0.01 ? 'WARNING' : 'INFO',
        };
      },
    },

    {
      name: 'Resource Usage',
      description: 'Check CPU/Memory < 80% of quota',
      category: HealthCategory.INFRASTRUCTURE,
      weight: 0.10,
      execute: async (project) => {
        const cpuUsage = await this.metrics.query(
          `project:cpu_usage:rate5m{namespace="project-${project.id}"} / project:cpu_quota`
        );
        const memUsage = await this.metrics.query(
          `project:memory_usage:bytes{namespace="project-${project.id}"} / project:memory_quota`
        );

        const maxUsage = Math.max(cpuUsage, memUsage);
        const passed = maxUsage < 0.80;
        const score = Math.max(0, 100 - maxUsage * 100);

        return {
          passed,
          score,
          message: `CPU: ${(cpuUsage * 100).toFixed(1)}%, Memory: ${(memUsage * 100).toFixed(1)}%`,
          severity: maxUsage > 0.95 ? 'CRITICAL' : maxUsage > 0.80 ? 'WARNING' : 'INFO',
          recommendations:
            maxUsage > 0.80
              ? ['Consider increasing resource quota or optimizing resource usage']
              : undefined,
        };
      },
    },

    {
      name: 'Security Vulnerabilities',
      description: 'Check for critical vulnerabilities',
      category: HealthCategory.SECURITY,
      weight: 0.20,
      execute: async (project) => {
        const vulnerabilities = await db.securityVulnerability.count({
          where: {
            dependency: {
              projectId: project.id,
            },
            severity: VulnerabilitySeverity.CRITICAL,
            status: VulnerabilityStatus.OPEN,
          },
        });

        const passed = vulnerabilities === 0;
        const score = Math.max(0, 100 - vulnerabilities * 20);

        return {
          passed,
          score,
          message: `${vulnerabilities} critical vulnerabilities`,
          severity: vulnerabilities > 0 ? 'CRITICAL' : 'INFO',
          recommendations:
            vulnerabilities > 0
              ? ['Update dependencies with critical vulnerabilities immediately']
              : undefined,
        };
      },
    },

    {
      name: 'Deployment Success Rate',
      description: 'Check deployment success > 95%',
      category: HealthCategory.RELIABILITY,
      weight: 0.10,
      execute: async (project) => {
        const deployments = await db.deployment.findMany({
          where: {
            projectId: project.id,
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            },
          },
        });

        const total = deployments.length;
        const successful = deployments.filter((d) => d.status === 'SUCCESS').length;
        const successRate = total > 0 ? successful / total : 1;

        const passed = successRate > 0.95;
        const score = successRate * 100;

        return {
          passed,
          score,
          message: `${successful}/${total} deployments successful (${(successRate * 100).toFixed(1)}%)`,
          severity: successRate < 0.80 ? 'CRITICAL' : successRate < 0.95 ? 'WARNING' : 'INFO',
        };
      },
    },

    {
      name: 'Database Health',
      description: 'Check database connection pool and query performance',
      category: HealthCategory.INFRASTRUCTURE,
      weight: 0.10,
      execute: async (project) => {
        const dbMetrics = await this.getDbMetrics(project.id);

        const poolUtilization = dbMetrics.activeConnections / dbMetrics.maxConnections;
        const avgQueryTime = dbMetrics.avgQueryTime;

        const passed = poolUtilization < 0.80 && avgQueryTime < 100; // 100ms
        const score = Math.min(
          100 - poolUtilization * 50,
          100 - (avgQueryTime / 100) * 50
        );

        return {
          passed,
          score,
          message: `Pool: ${(poolUtilization * 100).toFixed(1)}%, Avg query: ${avgQueryTime.toFixed(0)}ms`,
          severity:
            poolUtilization > 0.90 || avgQueryTime > 500 ? 'CRITICAL' : passed ? 'INFO' : 'WARNING',
        };
      },
    },

    {
      name: 'External Dependencies',
      description: 'Check health of external API dependencies',
      category: HealthCategory.DEPENDENCIES,
      weight: 0.10,
      execute: async (project) => {
        // Check configured external dependencies
        const dependencies = project.config.externalDependencies || [];

        const results = await Promise.all(
          dependencies.map((dep) => this.checkExternalDependency(dep))
        );

        const healthyCount = results.filter((r) => r.healthy).length;
        const healthRate = dependencies.length > 0 ? healthyCount / dependencies.length : 1;

        const passed = healthRate > 0.90;
        const score = healthRate * 100;

        return {
          passed,
          score,
          message: `${healthyCount}/${dependencies.length} dependencies healthy`,
          severity: healthRate < 0.70 ? 'CRITICAL' : passed ? 'INFO' : 'WARNING',
        };
      },
    },
  ];

  async assessHealth(projectId: string): Promise<ProjectHealthReport> {
    const project = await db.transformationProject.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Run all health checks in parallel
    const results = await Promise.allSettled(
      this.checks.map((check) => this.runCheck(check, project))
    );

    const checkResults: Record<string, HealthCheckResult> = {};
    let totalScore = 0;
    let totalWeight = 0;

    for (let i = 0; i < results.length; i++) {
      const check = this.checks[i];
      const result = results[i];

      if (result.status === 'fulfilled') {
        checkResults[check.name] = result.value;
        totalScore += result.value.score * check.weight;
        totalWeight += check.weight;
      } else {
        // Check failed to execute
        checkResults[check.name] = {
          passed: false,
          score: 0,
          message: `Check failed: ${result.reason}`,
          severity: 'ERROR',
        };
      }
    }

    const overallScore = Math.round(totalScore / totalWeight);
    const status = this.getHealthStatus(overallScore);

    const report: ProjectHealthReport = {
      projectId,
      score: overallScore,
      status,
      checks: checkResults,
      timestamp: new Date(),
      recommendations: this.generateRecommendations(checkResults),
    };

    // Store health check result
    await db.projectHealthCheck.create({
      data: {
        projectId,
        status,
        score: overallScore,
        checks: checkResults,
        metrics: {}, // Additional metrics
        createdAt: new Date(),
      },
    });

    // Update project status if health is critical
    if (status === HealthStatus.CRITICAL && project.status === ProjectStatus.ACTIVE) {
      await this.handleCriticalHealth(project, report);
    }

    return report;
  }

  private async runCheck(
    check: HealthCheck,
    project: TransformationProject
  ): Promise<HealthCheckResult> {
    try {
      return await check.execute(project);
    } catch (error) {
      return {
        passed: false,
        score: 0,
        message: `Check execution failed: ${error.message}`,
        severity: 'ERROR',
      };
    }
  }

  private getHealthStatus(score: number): HealthStatus {
    if (score >= 80) return HealthStatus.HEALTHY;
    if (score >= 60) return HealthStatus.DEGRADED;
    if (score >= 40) return HealthStatus.UNHEALTHY;
    return HealthStatus.CRITICAL;
  }

  private generateRecommendations(
    checkResults: Record<string, HealthCheckResult>
  ): string[] {
    const recommendations: string[] = [];

    for (const [checkName, result] of Object.entries(checkResults)) {
      if (result.recommendations) {
        recommendations.push(...result.recommendations);
      }

      // Add generic recommendations based on severity
      if (result.severity === 'CRITICAL' && !result.passed) {
        recommendations.push(`[URGENT] Address ${checkName}: ${result.message}`);
      }
    }

    return [...new Set(recommendations)]; // Deduplicate
  }

  private async handleCriticalHealth(
    project: TransformationProject,
    report: ProjectHealthReport
  ): Promise<void> {
    // Send alert to project owner
    await sendAlert({
      to: project.ownerId,
      severity: 'CRITICAL',
      type: 'PROJECT_HEALTH_CRITICAL',
      data: {
        projectId: project.id,
        projectName: project.name,
        healthScore: report.score,
        recommendations: report.recommendations,
      },
    });

    // Auto-suspend if health remains critical for 1 hour
    const previousChecks = await db.projectHealthCheck.findMany({
      where: {
        projectId: project.id,
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 4, // 4 checks (every 15 minutes)
    });

    const allCritical = previousChecks.every((c) => c.status === HealthStatus.CRITICAL);

    if (allCritical && previousChecks.length >= 4) {
      await this.autoSuspendProject(project, 'Critical health for 1 hour');
    }
  }

  async runHealthChecksForAllProjects(): Promise<void> {
    const activeProjects = await db.transformationProject.findMany({
      where: {
        status: {
          in: [ProjectStatus.ACTIVE, ProjectStatus.MAINTENANCE],
        },
      },
    });

    // Run in batches to avoid overwhelming the system
    const batchSize = 50;
    for (let i = 0; i < activeProjects.length; i += batchSize) {
      const batch = activeProjects.slice(i, i + batchSize);

      await Promise.allSettled(
        batch.map((project) => this.assessHealth(project.id))
      );

      // Wait 10 seconds between batches
      if (i + batchSize < activeProjects.length) {
        await sleep(10000);
      }
    }
  }
}

interface ProjectHealthReport {
  projectId: string;
  score: number;
  status: HealthStatus;
  checks: Record<string, HealthCheckResult>;
  timestamp: Date;
  recommendations: string[];
}
```

### Anomaly Detection

```typescript
// apps/core/src/lib/services/anomaly-detection/

class AnomalyDetectionService {
  async detectAnomalies(projectId: string): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    // Get historical metrics (last 7 days)
    const historical = await this.getHistoricalMetrics(projectId, 7);

    // Detect traffic anomalies
    const trafficAnomaly = this.detectTrafficAnomaly(historical.traffic);
    if (trafficAnomaly) anomalies.push(trafficAnomaly);

    // Detect error rate anomalies
    const errorAnomaly = this.detectErrorRateAnomaly(historical.errorRate);
    if (errorAnomaly) anomalies.push(errorAnomaly);

    // Detect resource usage anomalies
    const resourceAnomaly = this.detectResourceAnomaly(historical.resources);
    if (resourceAnomaly) anomalies.push(resourceAnomaly);

    return anomalies;
  }

  private detectTrafficAnomaly(traffic: TimeSeriesData[]): Anomaly | null {
    // Use statistical methods (e.g., standard deviation)
    const mean = this.calculateMean(traffic.map((d) => d.value));
    const stdDev = this.calculateStdDev(traffic.map((d) => d.value));

    const current = traffic[traffic.length - 1].value;

    // Anomaly if current value is >3 standard deviations from mean
    if (Math.abs(current - mean) > 3 * stdDev) {
      return {
        type: 'TRAFFIC',
        severity: current > mean ? 'WARNING' : 'CRITICAL',
        message: `Traffic ${current > mean ? 'spike' : 'drop'} detected`,
        currentValue: current,
        expectedRange: { min: mean - 2 * stdDev, max: mean + 2 * stdDev },
        detectedAt: new Date(),
      };
    }

    return null;
  }
}

interface Anomaly {
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  currentValue: number;
  expectedRange: { min: number; max: number };
  detectedAt: Date;
}
```

## Consequences

### Positive

1. **Comprehensive Visibility:** Full observability across all projects
2. **Early Detection:** Identify issues before they become critical
3. **Automated Response:** Auto-remediation reduces manual intervention
4. **Predictive Analytics:** Anomaly detection prevents issues
5. **Cost Optimization:** Identify resource waste
6. **Compliance:** Audit logging for regulatory requirements
7. **Scalability:** Efficient monitoring for 1000+ projects

### Negative

1. **Infrastructure Cost:** Monitoring stack adds cost
2. **Storage Requirements:** Metrics/logs consume significant storage
3. **Alert Fatigue:** Risk of too many alerts
4. **Complexity:** Multi-tier stack requires expertise
5. **Performance Overhead:** Metrics collection adds load

### Mitigations

1. **Retention Policies:** Limit storage with tiered retention
2. **Intelligent Alerting:** Machine learning to reduce false positives
3. **Efficient Sampling:** Sample metrics for less critical projects
4. **Shared Infrastructure:** Monitoring stack shared across projects
5. **Automated Cleanup:** Remove old metrics/logs automatically

## Alternatives Considered

### Alternative 1: Third-Party SaaS (Datadog/New Relic)

**Rejected Because:**
- Extremely expensive at scale (1000+ projects)
- Vendor lock-in
- Data residency concerns
- Limited customization

### Alternative 2: No Centralized Monitoring

**Rejected Because:**
- Cannot manage hundreds of projects
- No visibility into health
- Slow incident response
- No compliance

## References

- [Prometheus](https://prometheus.io/)
- [Grafana Loki](https://grafana.com/oss/loki/)
- [Grafana Tempo](https://grafana.com/oss/tempo/)
- [Google SRE Book - Monitoring](https://sre.google/sre-book/monitoring-distributed-systems/)

## Review Date

2026-04-20 (3 months)
