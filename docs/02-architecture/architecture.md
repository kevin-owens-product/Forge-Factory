# Forge Factory: Technical Architecture

**Version:** 1.0
**Date:** 2026-01-19
**Status:** Draft

---

## Architecture Overview

Forge Factory is built as a cloud-native, microservices-based platform designed for scalability, reliability, and enterprise security. The architecture follows domain-driven design principles with clear boundaries between services.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Web App  │  │ VS Code  │  │   CLI    │  │   API    │       │
│  │ (React)  │  │Extension │  │   Tool   │  │ Clients  │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
                            ↓ HTTPS/WSS
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  API Gateway (Kong/AWS API Gateway)                       │  │
│  │  • Authentication/Authorization                           │  │
│  │  • Rate Limiting                                          │  │
│  │  • Request Routing                                        │  │
│  │  • Logging/Monitoring                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Application Services Layer                    │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐│
│  │ Repository │  │ Analysis   │  │Refactoring │  │   Test   ││
│  │  Service   │  │  Service   │  │  Service   │  │ Service  ││
│  └────────────┘  └────────────┘  └────────────┘  └──────────┘│
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐│
│  │    LLM     │  │Integration │  │  Security  │  │Analytics ││
│  │  Service   │  │  Service   │  │  Service   │  │ Service  ││
│  └────────────┘  └────────────┘  └────────────┘  └──────────┘│
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │PostgreSQL│  │  Redis   │  │  S3/Blob │  │  Vector  │       │
│  │  (RDS)   │  │  Cache   │  │ Storage  │  │   DB     │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                   External Integrations                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  GitHub  │  │  GitLab  │  │ Anthropic│  │  OpenAI  │       │
│  │    API   │  │   API    │  │  Claude  │  │    API   │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend
- **Framework:** Next.js 14 (React 18)
- **Language:** TypeScript 5.0+
- **UI Library:** shadcn/ui (Radix UI + Tailwind CSS)
- **State Management:** Zustand + React Query
- **Form Handling:** React Hook Form + Zod
- **Visualization:** Recharts, D3.js for complex graphs
- **Code Display:** Monaco Editor (VS Code engine)
- **Testing:** Vitest + React Testing Library + Playwright

**Rationale:** Next.js provides excellent developer experience with SSR/SSG, API routes, and automatic code splitting. TypeScript ensures type safety. shadcn/ui provides accessible, customizable components.

### Backend Services
- **Framework:** Node.js 20 LTS with Fastify
- **Language:** TypeScript 5.0+
- **Alternative:** Go for performance-critical services (refactoring engine)
- **API Standard:** REST + GraphQL (Apollo Server) + gRPC for inter-service
- **Validation:** Zod schemas
- **Testing:** Vitest + Supertest

**Rationale:** Node.js/TypeScript provides unified language across stack, excellent async I/O for API calls, and large ecosystem. Go for CPU-intensive code analysis and transformation tasks.

### Data Storage

#### Primary Database: PostgreSQL 15+
**Purpose:** Primary data store for all structured data

**Schema Design:**
```sql
-- Organizations (multi-tenant)
organizations (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  plan_tier text NOT NULL, -- free, team, business, enterprise
  created_at timestamptz NOT NULL,
  settings jsonb DEFAULT '{}'
)

-- Users
users (
  id uuid PRIMARY KEY,
  email text UNIQUE NOT NULL,
  name text,
  avatar_url text,
  created_at timestamptz NOT NULL
)

-- Organization membership
organization_members (
  organization_id uuid REFERENCES organizations(id),
  user_id uuid REFERENCES users(id),
  role text NOT NULL, -- owner, admin, member, viewer
  PRIMARY KEY (organization_id, user_id)
)

-- Repositories
repositories (
  id uuid PRIMARY KEY,
  organization_id uuid REFERENCES organizations(id),
  name text NOT NULL,
  provider text NOT NULL, -- github, gitlab, bitbucket, azure
  external_id text NOT NULL,
  clone_url text NOT NULL,
  default_branch text NOT NULL,
  ai_readiness_score integer, -- 0-100
  last_analyzed_at timestamptz,
  settings jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL,
  UNIQUE(organization_id, provider, external_id)
)

-- Analysis runs
analysis_runs (
  id uuid PRIMARY KEY,
  repository_id uuid REFERENCES repositories(id),
  commit_sha text NOT NULL,
  status text NOT NULL, -- pending, running, completed, failed
  ai_readiness_score integer,
  metrics jsonb, -- complexity, coverage, documentation, etc.
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  error_message text
)

-- Refactoring jobs
refactoring_jobs (
  id uuid PRIMARY KEY,
  repository_id uuid REFERENCES repositories(id),
  analysis_run_id uuid REFERENCES analysis_runs(id),
  type text NOT NULL, -- file_split, type_annotation, test_generation, etc.
  status text NOT NULL, -- pending, running, completed, failed, rolled_back
  affected_files text[], -- array of file paths
  branch_name text,
  pull_request_url text,
  metrics jsonb, -- lines changed, files affected, etc.
  created_at timestamptz NOT NULL,
  completed_at timestamptz
)

-- Audit logs
audit_logs (
  id uuid PRIMARY KEY,
  organization_id uuid REFERENCES organizations(id),
  user_id uuid REFERENCES users(id),
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  metadata jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL
)

-- Usage tracking
usage_metrics (
  id uuid PRIMARY KEY,
  organization_id uuid REFERENCES organizations(id),
  repository_id uuid REFERENCES repositories(id),
  metric_type text NOT NULL, -- loc_transformed, api_calls, llm_tokens
  value bigint NOT NULL,
  timestamp timestamptz NOT NULL,
  metadata jsonb
)
```

**Indexing Strategy:**
- B-tree indexes on foreign keys
- GIN indexes on JSONB columns for metadata queries
- Partial indexes for active/recent records
- Composite indexes for common query patterns

#### Cache: Redis 7+
**Purpose:**
- Session management
- Rate limiting
- Real-time analytics aggregation
- Job queue (BullMQ)
- WebSocket session state

**Data Structures:**
```
# Session cache
session:{user_id} -> JSON (TTL: 24h)

# Rate limiting
ratelimit:{org_id}:{endpoint} -> Counter (TTL: 1min)

# Real-time metrics
metrics:{org_id}:realtime -> Hash

# Job queues
bull:analysis:waiting -> List
bull:refactoring:active -> List
```

#### Object Storage: S3 / Azure Blob Storage
**Purpose:**
- Repository clones (temporary)
- Analysis results (long-term)
- Generated artifacts (CLAUDE.md, documentation)
- Backup files before refactoring
- Audit trail artifacts

**Bucket Structure:**
```
forge-factory-prod/
  repositories/
    {org_id}/
      {repo_id}/
        clones/
          {commit_sha}.tar.gz
        analyses/
          {analysis_id}/
            results.json
            metrics.json
        refactorings/
          {job_id}/
            before/
            after/
            diff.patch
```

**Lifecycle Policies:**
- Repository clones: Delete after 7 days
- Analysis results: Retain 90 days, then archive to Glacier
- Refactoring backups: Retain 30 days

#### Vector Database: Pinecone / Weaviate
**Purpose:**
- Semantic code search
- Similar code pattern matching
- Documentation retrieval for RAG
- Code example recommendations

**Schema:**
```typescript
interface CodeEmbedding {
  id: string;
  vector: number[]; // 1536 dimensions (OpenAI ada-002)
  metadata: {
    repository_id: string;
    file_path: string;
    function_name?: string;
    language: string;
    code_snippet: string;
    documentation?: string;
    embedding_model: string;
    created_at: string;
  };
}
```

### Message Queue & Event Bus
- **Technology:** Apache Kafka / AWS EventBridge
- **Purpose:** Asynchronous processing, event-driven architecture

**Key Topics/Events:**
```
repository.connected
repository.analyzed
refactoring.requested
refactoring.completed
test.generated
documentation.generated
integration.webhook_received
```

### Infrastructure

#### Deployment Platform
- **Cloud Provider:** AWS (primary), Azure (secondary for enterprise)
- **Container Orchestration:** Kubernetes (EKS)
- **Container Registry:** ECR
- **Infrastructure as Code:** Terraform
- **CI/CD:** GitHub Actions

#### Kubernetes Architecture
```yaml
Namespaces:
  - forge-factory-prod
  - forge-factory-staging
  - forge-factory-dev

Workloads:
  - api-gateway (Deployment, 3 replicas)
  - repository-service (Deployment, 5 replicas)
  - analysis-service (Deployment, 10 replicas, HPA)
  - refactoring-service (Deployment, 5 replicas, HPA)
  - llm-service (Deployment, 3 replicas)
  - worker-analysis (Job, parallel processing)
  - worker-refactoring (Job, parallel processing)

Services:
  - Internal: ClusterIP for service-to-service
  - External: LoadBalancer for API Gateway

Ingress:
  - NGINX Ingress Controller
  - TLS with cert-manager (Let's Encrypt)

Storage:
  - PersistentVolumeClaims for temporary workspace
  - EFS for shared storage across pods
```

#### Observability Stack
- **Metrics:** Prometheus + Grafana
- **Logging:** ELK Stack (Elasticsearch, Logstash, Kibana)
- **Tracing:** Jaeger / OpenTelemetry
- **Error Tracking:** Sentry
- **Uptime Monitoring:** Pingdom / UptimeRobot
- **APM:** Datadog / New Relic

**Key Metrics:**
- API response times (p50, p95, p99)
- Error rates by service
- Queue depths (analysis, refactoring)
- LLM API latency and costs
- Database query performance
- Cache hit rates
- Active WebSocket connections
- Repository clone times
- Refactoring job success rates

---

## Service Architecture

### 1. Repository Service
**Responsibilities:**
- Connect and authenticate with source control providers
- Clone repositories securely
- Manage repository metadata
- Webhook handling
- Branch and commit management

**APIs:**
```typescript
POST   /api/v1/repositories/connect
GET    /api/v1/repositories
GET    /api/v1/repositories/:id
PUT    /api/v1/repositories/:id
DELETE /api/v1/repositories/:id
POST   /api/v1/repositories/:id/sync
POST   /api/v1/repositories/:id/webhook
```

**Technology:**
- Node.js with Fastify
- Octokit (GitHub), @gitbeaker/node (GitLab)
- Git operations via simple-git or isomorphic-git
- Webhook signature verification

**Data Flow:**
```
1. User initiates repository connection
2. OAuth flow with provider (GitHub/GitLab)
3. Repository metadata stored in PostgreSQL
4. Webhook registered with provider
5. Initial clone to S3
6. repository.connected event published to Kafka
```

### 2. Analysis Service
**Responsibilities:**
- Codebase structure analysis
- Complexity metrics calculation
- Test coverage analysis
- Documentation coverage assessment
- AI-readiness scoring
- Anti-pattern detection

**APIs:**
```typescript
POST   /api/v1/analysis/run
GET    /api/v1/analysis/:id
GET    /api/v1/analysis/:id/metrics
GET    /api/v1/repositories/:id/analyses
GET    /api/v1/repositories/:id/ai-readiness
```

**Technology:**
- Go for performance (CPU-intensive)
- Language parsers: tree-sitter (multi-language)
- Static analysis: golangci-lint, ESLint parser, pylint
- Complexity: cyclomatic complexity, cognitive complexity
- Coverage: Istanbul (JS), coverage.py (Python)

**Analysis Pipeline:**
```
1. Receive repository clone from S3
2. Parse all source files with tree-sitter
3. Build AST and dependency graph
4. Calculate metrics:
   - File sizes and line counts
   - Function complexity
   - Nesting depth
   - Type annotation coverage
   - Documentation coverage
   - Test coverage
   - Duplicate code detection
5. Compute AI-readiness score (weighted algorithm)
6. Store results in PostgreSQL + S3
7. Publish repository.analyzed event
```

**AI-Readiness Scoring Algorithm:**
```
Score = (
  0.20 * ModularityScore +      // Files <500 LOC, clear boundaries
  0.15 * ComplexityScore +       // Low cyclomatic complexity
  0.15 * TypeAnnotationScore +   // Type hints present
  0.20 * TestCoverageScore +     // 80%+ coverage
  0.15 * DocumentationScore +    // Functions documented
  0.10 * NamingScore +           // Clear naming conventions
  0.05 * DependencyScore         // Minimal circular dependencies
) * 100
```

### 3. Refactoring Service
**Responsibilities:**
- Execute code transformations
- Manage refactoring jobs
- Create pull requests
- Rollback on failure
- Human-in-the-loop approvals

**APIs:**
```typescript
POST   /api/v1/refactoring/jobs
GET    /api/v1/refactoring/jobs/:id
POST   /api/v1/refactoring/jobs/:id/approve
POST   /api/v1/refactoring/jobs/:id/reject
POST   /api/v1/refactoring/jobs/:id/rollback
GET    /api/v1/repositories/:id/refactorings
```

**Technology:**
- Go for AST manipulation
- jscodeshift (JavaScript/TypeScript)
- rope (Python refactoring library)
- Language-specific refactoring tools
- Git operations for branching and PRs

**Refactoring Pipeline:**
```
1. Receive refactoring job request
2. Create feature branch: forge-factory/{job-id}
3. Checkout branch in isolated workspace
4. Backup original files to S3
5. Execute transformations:
   - Parse files with AST parser
   - Apply transformations
   - Format code (Prettier, Black)
   - Lint code
6. Run tests (if present)
7. If tests pass:
   - Commit changes
   - Push to remote
   - Create pull request
8. If tests fail:
   - Rollback changes
   - Mark job as failed
9. Store results in PostgreSQL
10. Publish refactoring.completed event
```

**Transformation Types:**
```typescript
enum TransformationType {
  FILE_SPLIT = 'file_split',              // Break large files
  FUNCTION_EXTRACTION = 'function_extract', // Extract complex functions
  TYPE_ANNOTATION = 'type_annotation',    // Add type hints
  VARIABLE_RENAME = 'variable_rename',    // Improve naming
  DEAD_CODE_REMOVAL = 'dead_code_removal',
  COMPLEXITY_REDUCTION = 'complexity_reduction',
  INTERFACE_EXTRACTION = 'interface_extraction',
  DEPENDENCY_INJECTION = 'dependency_injection',
}
```

### 4. Test Service
**Responsibilities:**
- Generate unit tests
- Generate integration tests
- Execute test suites
- Calculate coverage
- Test quality assessment

**APIs:**
```typescript
POST   /api/v1/tests/generate
POST   /api/v1/tests/execute
GET    /api/v1/tests/:id
GET    /api/v1/repositories/:id/coverage
```

**Technology:**
- Node.js for orchestration
- Language-specific test runners
- Coverage tools: nyc, coverage.py, etc.
- LLM integration for test generation

**Test Generation Pipeline:**
```
1. Receive test generation request
2. Analyze function/module to test
3. Generate test prompts for LLM:
   - Function signature
   - Documentation
   - Usage examples
   - Edge cases to consider
4. Call LLM to generate test code
5. Parse and validate generated tests
6. Execute generated tests
7. If tests pass:
   - Create PR with tests
8. If tests fail:
   - Refine prompt
   - Regenerate (up to 3 attempts)
9. Store results
```

### 5. LLM Service
**Responsibilities:**
- Route requests to appropriate LLM provider
- Manage API keys and rate limits
- Cost tracking and optimization
- Context window management
- Response caching
- Prompt template management

**APIs:**
```typescript
POST   /api/v1/llm/completion
POST   /api/v1/llm/chat
POST   /api/v1/llm/embedding
GET    /api/v1/llm/usage
GET    /api/v1/llm/providers
```

**Technology:**
- Node.js with Fastify
- Anthropic SDK
- OpenAI SDK
- Custom adapter for self-hosted models
- Redis for response caching

**Provider Selection Strategy:**
```typescript
interface ProviderConfig {
  provider: 'anthropic' | 'openai' | 'self-hosted';
  model: string;
  maxTokens: number;
  costPer1MInputTokens: number;
  costPer1MOutputTokens: number;
  contextWindow: number;
}

// Route by task type
const ROUTING_RULES = {
  code_analysis: 'anthropic:claude-sonnet-4.5', // Best for code understanding
  test_generation: 'openai:gpt-5',              // Fast, good for repetitive tasks
  documentation: 'anthropic:claude-sonnet-4.5', // Better explanations
  refactoring: 'anthropic:claude-sonnet-4.5',   // Complex transformations
  simple_completion: 'openai:gpt-5',            // Cost optimization
};
```

**Cost Optimization:**
```typescript
// Cache identical requests
const cacheKey = hash({ prompt, model, params });
const cached = await redis.get(`llm:cache:${cacheKey}`);
if (cached) return cached;

// Use cheaper models for simple tasks
if (taskComplexity < COMPLEXITY_THRESHOLD) {
  provider = CHEAPER_PROVIDER;
}

// Batch similar requests
if (similarRequests.length > BATCH_THRESHOLD) {
  return batchProcess(similarRequests);
}
```

### 6. Integration Service
**Responsibilities:**
- Manage connections to external systems
- OAuth flows
- Webhook processing
- API rate limiting
- Retry logic

**APIs:**
```typescript
POST   /api/v1/integrations/github/connect
POST   /api/v1/integrations/gitlab/connect
POST   /api/v1/integrations/jira/connect
DELETE /api/v1/integrations/:id
GET    /api/v1/integrations
POST   /api/v1/webhooks/:provider
```

**Integrations:**
```typescript
interface Integration {
  id: string;
  organizationId: string;
  provider: 'github' | 'gitlab' | 'bitbucket' | 'azure' | 'jira' | 'slack';
  credentials: {
    type: 'oauth' | 'api_key' | 'app_installation';
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: Date;
    apiKey?: string;
  };
  webhookSecret?: string;
  settings: Record<string, unknown>;
}
```

### 7. Security Service
**Responsibilities:**
- Secret scanning
- Vulnerability detection
- OWASP Top 10 checking
- SQL injection detection
- Compliance scanning
- Audit logging

**APIs:**
```typescript
POST   /api/v1/security/scan
GET    /api/v1/security/scans/:id
GET    /api/v1/security/vulnerabilities
GET    /api/v1/audit-logs
```

**Technology:**
- Semgrep for static analysis
- Snyk API integration
- TruffleHog for secret detection
- Custom rules for AI-specific issues

**Security Scanning Pipeline:**
```
1. Receive scan request
2. Clone repository to isolated environment
3. Run parallel scans:
   - Secret detection (TruffleHog)
   - Vulnerability scanning (Snyk)
   - SAST (Semgrep with custom rules)
   - Dependency analysis
4. Aggregate findings
5. Score by severity: Critical, High, Medium, Low
6. Store results in PostgreSQL
7. Create Jira tickets for critical issues (if integrated)
8. Send notifications to Slack/Teams
```

### 8. Analytics Service
**Responsibilities:**
- Aggregate usage metrics
- Calculate KPIs
- Generate reports
- Real-time dashboards
- Export data

**APIs:**
```typescript
GET    /api/v1/analytics/dashboard
GET    /api/v1/analytics/repositories/:id
GET    /api/v1/analytics/usage
GET    /api/v1/analytics/trends
POST   /api/v1/analytics/export
```

**Technology:**
- Node.js for API
- TimescaleDB for time-series metrics
- Materialized views for fast aggregation
- WebSockets for real-time updates

**Key Metrics:**
```typescript
interface RepositoryMetrics {
  aiReadinessScore: number;
  aiReadinessTrend: number[]; // Last 30 days
  locTransformed: number;
  testCoverageImprovement: number;
  documentationCoverageImprovement: number;
  refactoringJobsCompleted: number;
  refactoringJobsFailed: number;
  averageJobDuration: number;
  costPerTransformation: number;
}

interface OrganizationMetrics {
  totalRepositories: number;
  activeRepositories: number;
  totalLocTransformed: number;
  averageAiReadinessScore: number;
  monthlyActiveUsers: number;
  usageVsQuota: number;
  estimatedMonthlyCost: number;
  roi: number; // Based on time saved
}
```

---

## Security Architecture

### Authentication & Authorization

#### Authentication
- **Identity Provider:** Auth0 / Clerk
- **Protocols:** OAuth 2.0, SAML 2.0 (enterprise)
- **MFA:** TOTP, SMS, WebAuthn

**Flow:**
```
1. User initiates login
2. Redirect to identity provider
3. User authenticates (email/password + MFA)
4. Receive JWT token
5. Store in httpOnly cookie
6. Refresh token rotation every 1 hour
```

#### Authorization
- **Model:** Role-Based Access Control (RBAC)
- **Enforcement:** Middleware in API Gateway

**Roles:**
```typescript
enum Role {
  OWNER = 'owner',         // Full access, billing
  ADMIN = 'admin',         // All except billing
  MEMBER = 'member',       // Read/write repositories
  VIEWER = 'viewer',       // Read-only access
}

enum Permission {
  REPO_READ = 'repo:read',
  REPO_WRITE = 'repo:write',
  REPO_DELETE = 'repo:delete',
  REFACTOR_CREATE = 'refactor:create',
  REFACTOR_APPROVE = 'refactor:approve',
  SETTINGS_READ = 'settings:read',
  SETTINGS_WRITE = 'settings:write',
  BILLING_READ = 'billing:read',
  BILLING_WRITE = 'billing:write',
}

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.OWNER]: ['*'], // All permissions
  [Role.ADMIN]: [
    'repo:*',
    'refactor:*',
    'settings:*',
    'billing:read',
  ],
  [Role.MEMBER]: [
    'repo:read',
    'repo:write',
    'refactor:create',
    'settings:read',
  ],
  [Role.VIEWER]: [
    'repo:read',
    'settings:read',
  ],
};
```

### Data Encryption

#### At Rest
- **Database:** AWS RDS encryption (AES-256)
- **Object Storage:** S3 encryption (SSE-S3 or SSE-KMS)
- **CMEK:** Customer-managed keys via AWS KMS (enterprise tier)

#### In Transit
- **TLS 1.3** for all external connections
- **mTLS** for service-to-service communication
- **Certificate Management:** cert-manager with Let's Encrypt

### Secrets Management
- **Technology:** AWS Secrets Manager / HashiCorp Vault
- **Rotation:** Automatic rotation every 90 days
- **Access:** IAM roles for services, no hardcoded credentials

**Secrets Structure:**
```
/forge-factory/prod/database/connection-string
/forge-factory/prod/github/app-private-key
/forge-factory/prod/anthropic/api-key
/forge-factory/prod/openai/api-key
/forge-factory/prod/jwt/signing-key
```

### Network Security
- **VPC:** Private subnets for services, public subnet for load balancer
- **Security Groups:** Principle of least privilege
- **WAF:** AWS WAF with OWASP rules
- **DDoS Protection:** AWS Shield Standard (or Advanced for enterprise)

**Network Architecture:**
```
Internet
   ↓
CloudFront (CDN)
   ↓
Application Load Balancer (Public Subnet)
   ↓
API Gateway (Private Subnet)
   ↓
Services (Private Subnet)
   ↓
RDS/ElastiCache (Private Subnet, different AZ)
```

### Compliance

#### SOC 2 Type II Requirements
- Access controls and monitoring
- Change management procedures
- Incident response plan
- Business continuity and disaster recovery
- Vendor management
- Risk assessment program
- Security awareness training

#### ISO 27001 Requirements
- Information security management system (ISMS)
- Asset management
- Access control policies
- Cryptography controls
- Physical security
- Incident management
- Business continuity

#### Data Residency
- **US:** AWS us-east-1 (primary), us-west-2 (DR)
- **EU:** AWS eu-west-1 (Frankfurt) for GDPR compliance
- **Asia:** AWS ap-southeast-1 (Singapore) for APAC customers

---

## Scalability & Performance

### Horizontal Scaling
- **Stateless Services:** All application services are stateless
- **Kubernetes HPA:** Auto-scale based on CPU/memory/custom metrics
- **Load Balancing:** Round-robin with health checks

**Scaling Policies:**
```yaml
analysis-service:
  minReplicas: 5
  maxReplicas: 50
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

refactoring-service:
  minReplicas: 3
  maxReplicas: 30
  targetCPUUtilizationPercentage: 70
```

### Database Scaling
- **Read Replicas:** 3 read replicas for query distribution
- **Connection Pooling:** PgBouncer (max 1000 connections)
- **Partitioning:** Partition audit_logs and usage_metrics by month
- **Archival:** Move old data to S3 with Glacier lifecycle

### Caching Strategy
```typescript
// Multi-layer caching
1. Browser cache (static assets): 1 year
2. CDN cache (CloudFront): 1 hour
3. Application cache (Redis):
   - User sessions: 24 hours
   - Analysis results: 1 hour
   - LLM responses: 7 days
4. Database query cache: 5 minutes
```

### Performance Targets
- **API Response Time:** p95 < 200ms (simple queries), p95 < 2s (complex operations)
- **Repository Analysis:** < 5 minutes for 100K LOC
- **Refactoring Job:** < 10 minutes for typical refactoring
- **Dashboard Load:** < 1 second (first contentful paint)
- **WebSocket Latency:** < 100ms
- **Uptime SLA:** 99.9% (Business), 99.95% (Enterprise)

---

## Disaster Recovery & Business Continuity

### Backup Strategy
- **Database:** Automated daily backups with 30-day retention, PITR enabled
- **S3:** Cross-region replication to DR region
- **Configuration:** Infrastructure as Code in git

### Disaster Recovery
- **RTO (Recovery Time Objective):** 4 hours
- **RPO (Recovery Point Objective):** 1 hour
- **DR Region:** Warm standby in us-west-2 (if primary is us-east-1)

**DR Runbook:**
```
1. Detect outage (automated monitoring)
2. Trigger incident response
3. Assess impact and cause
4. If regional failure:
   - Update DNS to point to DR region
   - Promote read replica to primary
   - Scale up DR services
   - Verify functionality
5. Communicate status to customers
6. Post-incident review
```

---

## Development & Deployment

### CI/CD Pipeline
```yaml
# .github/workflows/ci.yml
on: [push, pull_request]

jobs:
  test:
    - Checkout code
    - Setup Node.js/Go
    - Install dependencies
    - Run linters (ESLint, golangci-lint)
    - Run type checking (tsc)
    - Run unit tests
    - Run integration tests
    - Check test coverage (>80%)
    - Security scan (Semgrep, Snyk)
    - Build Docker images
    - Push to ECR

  deploy-staging:
    if: branch == 'main'
    - Update Kubernetes manifests
    - Apply to staging cluster
    - Run smoke tests
    - Run E2E tests (Playwright)

  deploy-production:
    if: tag matches 'v*'
    - Require manual approval
    - Blue-green deployment to production
    - Run smoke tests
    - Monitor metrics for 30 minutes
    - If errors, automatic rollback
```

### Environment Strategy
- **Development:** Local (Docker Compose), feature branches
- **Staging:** Mirrors production, deployed on every merge to main
- **Production:** Deployed on git tags with manual approval

### Monitoring & Alerting
```yaml
Alerts:
  - name: HighErrorRate
    condition: error_rate > 1%
    severity: critical
    notify: [pagerduty, slack]

  - name: SlowAPIResponse
    condition: p95_latency > 2s
    severity: warning
    notify: [slack]

  - name: HighDatabaseCPU
    condition: db_cpu > 80%
    severity: warning
    notify: [slack, email]

  - name: FailedRefactoringJobs
    condition: failed_jobs > 10/hour
    severity: warning
    notify: [slack]

  - name: LowDiskSpace
    condition: disk_usage > 85%
    severity: warning
    notify: [slack, email]
```

---

## API Design Principles

### RESTful Conventions
```
GET    /api/v1/resources       - List resources
GET    /api/v1/resources/:id   - Get single resource
POST   /api/v1/resources       - Create resource
PUT    /api/v1/resources/:id   - Update resource (full)
PATCH  /api/v1/resources/:id   - Update resource (partial)
DELETE /api/v1/resources/:id   - Delete resource
```

### Versioning
- **URL-based:** `/api/v1/`, `/api/v2/`
- **Breaking changes:** New version
- **Deprecation:** 6-month notice period

### Error Handling
```typescript
interface ErrorResponse {
  error: {
    code: string;           // Machine-readable error code
    message: string;        // Human-readable message
    details?: unknown;      // Additional context
    requestId: string;      // For support/debugging
  };
}

// Example
{
  "error": {
    "code": "REPOSITORY_NOT_FOUND",
    "message": "Repository with ID abc-123 not found",
    "details": {
      "repositoryId": "abc-123"
    },
    "requestId": "req_xyz789"
  }
}
```

### Rate Limiting
```typescript
// Tier-based limits
const RATE_LIMITS = {
  free: {
    requestsPerMinute: 60,
    requestsPerHour: 1000,
  },
  team: {
    requestsPerMinute: 300,
    requestsPerHour: 10000,
  },
  business: {
    requestsPerMinute: 1000,
    requestsPerHour: 50000,
  },
  enterprise: {
    requestsPerMinute: 5000,
    requestsPerHour: 200000,
  },
};

// Response headers
{
  "X-RateLimit-Limit": "60",
  "X-RateLimit-Remaining": "45",
  "X-RateLimit-Reset": "1642636800"
}
```

---

## Cost Optimization

### Infrastructure Costs (Estimated for 1000 repositories)
```
AWS EKS (Kubernetes):           $150/month
EC2 Instances (t3.large x10):   $800/month
RDS PostgreSQL (db.r5.xlarge):  $400/month
ElastiCache Redis (cache.r5.large): $150/month
S3 Storage (10TB):              $230/month
Data Transfer:                  $300/month
CloudFront CDN:                 $100/month
Observability (Datadog):        $500/month

Total Infrastructure:           $2,630/month

LLM API Costs (estimated):
Anthropic Claude:               $2,000/month
OpenAI GPT-5:                   $1,000/month

Total LLM Costs:                $3,000/month

Grand Total:                    $5,630/month
```

### Cost per Repository
- **Infrastructure:** $2.63/repo/month
- **LLM:** $3.00/repo/month (highly variable)
- **Total:** ~$5.63/repo/month

**Break-even Analysis:**
- Team tier ($39/seat, assume 5 seats per repo): $195/repo/month
- Gross margin: $195 - $5.63 = $189.37 (97% margin before overhead)
- Including overhead, target 50-60% gross margin

---

## Appendix: Technology Evaluation

### Why Next.js over alternatives?
- **vs. Create React App:** Better performance (SSR/SSG), built-in routing
- **vs. Remix:** More mature ecosystem, better TypeScript support
- **vs. SvelteKit:** Larger talent pool, more enterprise adoption

### Why PostgreSQL over alternatives?
- **vs. MongoDB:** Strong ACID guarantees, complex queries, JSON support (JSONB)
- **vs. MySQL:** Better JSON support, advanced features (CTEs, window functions)
- **vs. DynamoDB:** More flexible querying, lower costs for our access patterns

### Why Fastify over Express?
- **Performance:** 2-3x faster than Express
- **TypeScript:** First-class TypeScript support
- **Schema validation:** Built-in with Ajv
- **Plugin ecosystem:** Rich and growing

### Why Kubernetes over alternatives?
- **vs. ECS:** More portable, richer ecosystem, better for hybrid cloud
- **vs. Lambda:** Need for stateful services, better cost at scale
- **vs. VM-based:** Better resource utilization, easier scaling

---

**Document Status:** Living document, updated with architectural decisions. All major changes require architecture review and approval.
