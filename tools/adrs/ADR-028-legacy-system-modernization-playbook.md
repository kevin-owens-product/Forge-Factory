# ADR-028: Legacy System Modernization Playbook

## Status
Proposed

## Context

Over **70% of Fortune 5000 companies** run software systems that are **more than 20 years old**, built before cloud-native, mobile-first, and security-by-design architectures existed. These legacy systems represent **$100B+ annually** in maintenance costs, block innovation, and create significant technical and security risks.

### The Legacy Crisis

**Market Reality** (2026):
- **85% of enterprises** have critical applications >10 years old
- **$50B annual market** for legacy modernization services
- **Airbnb case study**: LLM-driven migration completed 3,500 React files in 6 weeks vs 1.5 years manually
- **Goldman Sachs**: Auto-coding improved developer proficiency by 20%
- **AWS Transform**: Promises 5x faster modernization, 70% lower Windows licensing costs

### Common Legacy Challenges

**Technical Debt**:
- Monolithic architectures (single deployable unit)
- Outdated languages (COBOL, Java 8, Python 2, .NET Framework)
- Missing test coverage (<20% typical)
- Poor documentation
- Hardcoded configurations
- Security vulnerabilities (unpatched CVEs)
- Performance bottlenecks

**Business Impact**:
- **30% of dev time** spent on tech debt (vs features)
- **3-6 month** feature delivery cycles (vs weeks for modern stacks)
- **10x higher** maintenance costs than modern systems
- **Talent shortage**: Difficult to hire for legacy technologies
- **Compliance risk**: Old systems can't meet modern compliance (GDPR, SOC 2)

### Industry-Specific Legacy Patterns

**Financial Services** (Banks, Insurance):
- COBOL mainframes (40+ years old)
- Java 8 applications (EOL approaching)
- Complex regulatory requirements
- Zero downtime requirements
- Multi-year transformation timelines

**Healthcare**:
- .NET Framework monoliths
- Legacy EMR/EHR integrations
- HIPAA compliance mandates
- Patient data migration risks
- Vendor lock-in challenges

**Government**:
- 30-40 year old systems
- Multiple technology stacks
- Budget constraints
- Risk-averse culture
- Legacy procurement processes

**Enterprise SaaS**:
- 10-15 year old Rails/Django monoliths
- Technical debt from rapid growth
- Performance at scale challenges
- Multi-tenancy complexity
- Feature velocity constraints

### Modernization Strategies

Based on industry research (Gartner, Forrester, AWS):

1. **Rehost (Lift & Shift)**: Move to cloud as-is (fastest, lowest risk, minimal value)
2. **Replatform**: Minor optimizations during migration (moderate risk/value)
3. **Refactor/Re-architect**: Restructure for cloud-native (high risk, high value)
4. **Rebuild**: Rewrite from scratch (highest risk, highest value, expensive)
5. **Replace**: Buy vs build (SaaS replacement)
6. **Retain**: Do nothing (for systems nearing retirement)

### ROI Data Points

**Industry Benchmarks**:
- **Payback period**: 6-18 months typical, 6-12 months with PaaS
- **Cost reduction**: 40-60% lower operational costs post-modernization
- **Developer productivity**: 20-50% improvement
- **Feature velocity**: 3-5x faster delivery
- **Incident reduction**: 50-80% fewer production incidents

**AWS Transform Data**:
- **5x faster**: Modernization timeline reduction
- **70% cost savings**: Windows licensing
- **30% tech debt**: Typical team burden (addressable)

## Decision

Implement **comprehensive Legacy System Modernization Playbook** supporting multiple modernization strategies, AI-powered code transformation, automated testing, and risk-minimized execution with enterprise change management.

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│           Legacy System Modernization Playbook                   │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Discovery → Assessment → Strategy → Execution → Validation      │
│  ┌─────────┐  ┌──────────┐  ┌────────┐  ┌─────────┐  ┌────────┐ │
│  │ Analyze │  │ Evaluate │  │ Plan   │  │ Execute │  │ Verify │ │
│  │ Current │─►│ Options  │─►│ Modern │─►│ Trans-  │─►│ & Val- │ │
│  │ State   │  │ & Risks  │  │ -ization│  │ form    │  │ idate  │ │
│  └─────────┘  └──────────┘  └────────┘  └─────────┘  └────────┘ │
│       │             │            │           │            │        │
│       └─────────────┴────────────┴───────────┴────────────┘        │
│                            ▼                                        │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                  Discovery & Analysis                       │   │
│  │                                                              │   │
│  │  1. System Inventory:                                       │   │
│  │     - Map all applications, services, databases             │   │
│  │     - Identify dependencies (application dependency map)    │   │
│  │     - Current technology stack analysis                     │   │
│  │     - Hosting/infrastructure inventory                      │   │
│  │                                                              │   │
│  │  2. Code Analysis:                                          │   │
│  │     - Lines of code, complexity metrics                     │   │
│  │     - Technical debt quantification (SonarQube)             │   │
│  │     - Security vulnerabilities (Snyk, Semgrep)              │   │
│  │     - Test coverage assessment                              │   │
│  │     - Documentation completeness                            │   │
│  │                                                              │   │
│  │  3. Business Context:                                       │   │
│  │     - Criticality assessment (revenue impact)               │   │
│  │     - User base and usage patterns                          │   │
│  │     - Compliance requirements                               │   │
│  │     - Integration points (upstream/downstream)              │   │
│  │     - SLA requirements                                      │   │
│  │                                                              │   │
│  │  Output: Legacy System Profile                              │   │
│  └────────────────────────────────────────────────────────────┘   │
│                            ▼                                        │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │              Strategy Selection Matrix                       │   │
│  │                                                              │   │
│  │  Criteria-based decision framework:                         │   │
│  │                                                              │   │
│  │  ┌──────────────┬──────────┬──────────┬──────────────────┐  │   │
│  │  │ Criteria     │ Rehost   │ Refactor │ Rebuild          │  │   │
│  │  ├──────────────┼──────────┼──────────┼──────────────────┤  │   │
│  │  │ Timeline     │ 1-3 mo   │ 3-12 mo  │ 12-36 mo         │  │   │
│  │  │ Risk         │ Low      │ Medium   │ High             │  │   │
│  │  │ Cost         │ $        │ $$       │ $$$              │  │   │
│  │  │ Value        │ Low      │ High     │ Highest          │  │   │
│  │  │ Downtime     │ Hours    │ Days     │ Weeks (parallel) │  │   │
│  │  │ Best For     │ Quick    │ Modern-  │ Complete         │  │   │
│  │  │              │ Wins     │ ization  │ Transformation   │  │   │
│  │  └──────────────┴──────────┴──────────┴──────────────────┘  │   │
│  │                                                              │   │
│  │  Recommendation Engine:                                     │   │
│  │  - If criticality=HIGH & budget=LOW → Rehost first          │   │
│  │  - If tech_debt>60 & timeline>6mo → Refactor                │   │
│  │  - If architecture mismatch → Rebuild                       │   │
│  │  - If business model shift → Replace (buy SaaS)             │   │
│  └────────────────────────────────────────────────────────────┘   │
│                            ▼                                        │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │              Modernization Execution Patterns               │   │
│  │                                                              │   │
│  │  Pattern 1: Language/Framework Migration                    │   │
│  │  ┌────────────────────────────────────────────────────┐     │   │
│  │  │ Java 8 → Java 21:                                   │     │   │
│  │  │ - Update language level (var, records, switch expr) │     │   │
│  │  │ - Migrate deprecated APIs (Date → LocalDateTime)   │     │   │
│  │  │ - Update dependencies (Spring Boot 2 → 3)          │     │   │
│  │  │ - Security: Patch CVEs in old libraries            │     │   │
│  │  │ - Performance: Enable new GC (ZGC, Shenandoah)     │     │   │
│  │  │ - Testing: Verify all unit/integration tests pass  │     │   │
│  │  └────────────────────────────────────────────────────┘     │   │
│  │                                                              │   │
│  │  Pattern 2: Monolith → Cloud-Native                         │   │
│  │  ┌────────────────────────────────────────────────────┐     │   │
│  │  │ Phase 1: Externalize Configuration                 │     │   │
│  │  │   - Move hardcoded values to env vars/config files │     │   │
│  │  │   - Add feature flags for gradual rollout          │     │   │
│  │  │                                                     │     │   │
│  │  │ Phase 2: Add Observability                         │     │   │
│  │  │   - Structured logging (JSON)                      │     │   │
│  │  │   - Metrics (Prometheus)                           │     │   │
│  │  │   - Distributed tracing (OpenTelemetry)            │     │   │
│  │  │   - Health checks (/health, /ready)                │     │   │
│  │  │                                                     │     │   │
│  │  │ Phase 3: Containerization                          │     │   │
│  │  │   - Create Dockerfile (multi-stage build)          │     │   │
│  │  │   - Add docker-compose for local dev               │     │   │
│  │  │   - Kubernetes manifests (deployment, service)     │     │   │
│  │  │                                                     │     │   │
│  │  │ Phase 4: Data Layer Modernization                  │     │   │
│  │  │   - Extract data access layer                      │     │   │
│  │  │   - Implement repository pattern                   │     │   │
│  │  │   - Add caching (Redis)                            │     │   │
│  │  │   - Database connection pooling                    │     │   │
│  │  └────────────────────────────────────────────────────┘     │   │
│  │                                                              │   │
│  │  Pattern 3: Security Hardening                              │   │
│  │  ┌────────────────────────────────────────────────────┐     │   │
│  │  │ - Input validation (prevent injection)             │     │   │
│  │  │ - Authentication/Authorization (OAuth 2.0, JWT)    │     │   │
│  │  │ - Secrets management (rotate hardcoded secrets)    │     │   │
│  │  │ - Encryption at rest & in transit (TLS 1.3)        │     │   │
│  │  │ - CSRF/XSS protection                              │     │   │
│  │  │ - Security headers (CSP, HSTS, etc.)               │     │   │
│  │  │ - Dependency vulnerability fixes                   │     │   │
│  │  │ - Rate limiting & DDoS protection                  │     │   │
│  │  └────────────────────────────────────────────────────┘     │   │
│  │                                                              │   │
│  │  Pattern 4: Test Coverage Improvement                       │   │
│  │  ┌────────────────────────────────────────────────────┐     │   │
│  │  │ Goal: 80%+ test coverage                           │     │   │
│  │  │ - Generate unit tests (AI-powered)                 │     │   │
│  │  │ - Add integration tests (API contract tests)       │     │   │
│  │  │ - E2E tests (critical user flows)                  │     │   │
│  │  │ - Performance tests (load, stress)                 │     │   │
│  │  │ - Security tests (OWASP Top 10)                    │     │   │
│  │  └────────────────────────────────────────────────────┘     │   │
│  └────────────────────────────────────────────────────────────┘   │
│                            ▼                                        │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                  Risk Mitigation Strategies                 │   │
│  │                                                              │   │
│  │  1. Strangler Fig Pattern:                                  │   │
│  │     - Run legacy & modern systems in parallel               │   │
│  │     - Route traffic gradually (0% → 5% → 25% → 100%)        │   │
│  │     - Monitor metrics at each stage                         │   │
│  │     - Instant rollback if issues detected                   │   │
│  │                                                              │   │
│  │  2. Feature Flags:                                          │   │
│  │     - All new code behind feature flags                     │   │
│  │     - Enable for 5% of users first                          │   │
│  │     - A/B test legacy vs modern                             │   │
│  │     - Kill switch for instant disable                       │   │
│  │                                                              │   │
│  │  3. Shadow Testing:                                         │   │
│  │     - Duplicate production traffic to modern system         │   │
│  │     - Compare outputs (legacy vs modern)                    │   │
│  │     - Identify discrepancies before cutover                 │   │
│  │     - Build confidence in new system                        │   │
│  │                                                              │   │
│  │  4. Automated Rollback:                                     │   │
│  │     - Monitor error rates, latency, throughput              │   │
│  │     - Auto-rollback if metrics degrade >10%                 │   │
│  │     - One-click manual rollback (ADR-024)                   │   │
│  │     - Preserve Git history for forensics                    │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

## Data Model

```typescript
/**
 * @prompt-id forge-v4.1:legacy-modernization:data-model:001
 * @generated-at 2026-01-20T00:00:00Z
 * @model claude-sonnet-4-5
 */

// Legacy system inventory
model LegacySystem {
  id                    String   @id @default(cuid())
  organizationId        String
  organization          Organization @relation(fields: [organizationId], references: [id])

  // System metadata
  name                  String           // "Customer Portal"
  description           String?
  businessCriticality   Criticality      // CRITICAL, HIGH, MEDIUM, LOW

  // Technology stack
  primaryLanguage       String           // "Java", "C#", ".NET Framework"
  languageVersion       String           // "8", "4.7.2"
  framework             String?          // "Spring Boot", "ASP.NET"
  frameworkVersion      String?
  databases             Json             // ["PostgreSQL 9.6", "MongoDB 3.6"]

  // Code metrics
  linesOfCode           Int
  fileCount             Int
  complexity            Float            // Cyclomatic complexity
  technicalDebtRatio    Float            // 0-1 (0=no debt, 1=100% debt)
  testCoverage          Float            // 0-100

  // Dependencies
  dependencyCount       Int
  outdatedDependencies  Int
  vulnerabilities       Int              // Known CVEs

  // Business context
  userCount             Int?
  transactionVolume     Int?             // Per day
  revenue Impact        Int?             // Annual revenue (cents)
  uptime SLA            Float?           // 99.9%

  // Current state
  hosting               HostingType      // ON_PREMISE, CLOUD, HYBRID
  deploymentFrequency   DeployFreq       // DAILY, WEEKLY, MONTHLY, QUARTERLY
  meanTimeToRecover     Int?             // Minutes
  incidentRate          Float?           // Per month

  // Modernization
  modernizationProgram  ModernizationProgram?
  recommendedStrategy   ModernizationStrategy?
  estimatedEffort       Int?             // Person-months
  estimatedCost         Int?             // Cents

  // Metadata
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([organizationId])
  @@index([businessCriticality])
  @@index([primaryLanguage])
}

enum Criticality {
  CRITICAL              // Revenue-critical, cannot fail
  HIGH                  // Important but has workarounds
  MEDIUM                // Standard business application
  LOW                   // Nice to have, low usage
}

enum HostingType {
  ON_PREMISE            // Data center
  CLOUD                 // AWS/Azure/GCP
  HYBRID                // Mix of on-prem and cloud
  COLO                  // Colocation
}

enum DeployFreq {
  MULTIPLE_DAILY        // CI/CD
  DAILY
  WEEKLY
  MONTHLY
  QUARTERLY
  ANNUALLY
}

// Modernization program for a legacy system
model ModernizationProgram {
  id                    String   @id @default(cuid())
  legacySystemId        String   @unique
  legacySystem          LegacySystem @relation(fields: [legacySystemId], references: [id])

  organizationId        String
  organization          Organization @relation(fields: [organizationId], references: [id])

  // Strategy
  strategy              ModernizationStrategy
  approach              ApproachType     // BIG_BANG, INCREMENTAL, STRANGLER_FIG

  // Timeline
  startDate             DateTime
  targetEndDate         DateTime
  actualEndDate         DateTime?

  // Status
  status                ProgramStatus
  progressPercentage    Int @default(0)

  // Phases
  phases                ModernizationPhase[]

  // Risk management
  riskLevel             RiskLevel        // LOW, MEDIUM, HIGH, CRITICAL
  riskMitigations       Json             // Risk mitigation strategies
  rollbackPlan          Json             // How to rollback if needed

  // Metrics
  baselineMetrics       Json
  currentMetrics        Json?
  targetMetrics         Json

  // ROI
  estimatedCost         Int              // Cents
  actualCost            Int @default(0)
  estimatedROI          Float
  actualROI             Float?

  // Governance
  programManager        String
  manager               User @relation(fields: [programManager], references: [id])

  // Metadata
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([organizationId])
  @@index([status])
  @@index([strategy])
}

enum ModernizationStrategy {
  REHOST                // Lift & shift to cloud
  REPLATFORM            // Minor optimizations
  REFACTOR              // Significant re-architecting
  REBUILD               // Complete rewrite
  REPLACE               // Buy SaaS alternative
  RETAIN                // Do nothing (for now)
}

enum ApproachType {
  BIG_BANG              // Replace all at once
  INCREMENTAL           // Module by module
  STRANGLER_FIG         // Run parallel, gradual cutover
  PARALLEL_RUN          // Both systems indefinitely
}

enum RiskLevel {
  LOW                   // Low impact if fails
  MEDIUM                // Moderate impact
  HIGH                  // Significant impact
  CRITICAL              // Business-critical risk
}

// Modernization phases
model ModernizationPhase {
  id                    String   @id @default(cuid())
  programId             String
  program               ModernizationProgram @relation(fields: [programId], references: [id])

  name                  String
  description           String
  order                 Int

  phaseType             PhaseType        // DISCOVERY, PLANNING, EXECUTION, VALIDATION

  status                PhaseStatus
  startDate             DateTime
  endDate               DateTime

  // Transformations
  transformations       ModernizationTransformation[]

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([programId])
  @@unique([programId, order])
}

enum PhaseType {
  DISCOVERY             // Analyze current state
  PLANNING              // Design target state
  EXECUTION             // Apply transformations
  VALIDATION            // Test and verify
  CUTOVER               // Go live
  STABILIZATION         // Post-launch monitoring
}

// Individual transformation
model ModernizationTransformation {
  id                    String   @id @default(cuid())
  phaseId               String
  phase                 ModernizationPhase @relation(fields: [phaseId], references: [id])

  name                  String
  transformationType    TransformationType

  // Scope
  targetFiles           Json             // Which files to transform
  estimatedImpact       Int              // Number of files

  // Status
  status                TransformationStatus

  // Change request (from ADR-024)
  changeRequestId       String?
  changeRequest         ChangeRequest? @relation(fields: [changeRequestId], references: [id])

  // Results
  filesChanged          Int?
  linesAdded            Int?
  linesDeleted          Int?

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  completedAt           DateTime?

  @@index([phaseId])
  @@index([status])
}

enum TransformationType {
  // Language migrations
  JAVA_8_TO_21
  PYTHON_2_TO_3
  DOTNET_FRAMEWORK_TO_8
  PHP_5_TO_8
  RUBY_2_TO_3

  // Framework migrations
  SPRING_BOOT_2_TO_3
  REACT_15_TO_19
  VUE_2_TO_3
  ANGULAR_JS_TO_18
  RAILS_5_TO_7

  // Architecture
  MONOLITH_TO_MODULES
  ADD_API_LAYER
  EXTERNALIZE_CONFIG
  ADD_OBSERVABILITY
  CONTAINERIZATION

  // Testing
  ADD_UNIT_TESTS
  ADD_INTEGRATION_TESTS
  ADD_E2E_TESTS
  IMPROVE_COVERAGE

  // Security
  FIX_VULNERABILITIES
  ADD_AUTHENTICATION
  ADD_AUTHORIZATION
  ROTATE_SECRETS
  ENABLE_HTTPS

  // Performance
  ADD_CACHING
  DATABASE_OPTIMIZATION
  CODE_SPLITTING
  LAZY_LOADING
  CDN_INTEGRATION

  // Quality
  ADD_LINTING
  ADD_TYPE_CHECKING
  REMOVE_DUPLICATION
  REDUCE_COMPLEXITY
  IMPROVE_NAMING
}

enum TransformationStatus {
  PENDING
  IN_PROGRESS
  TESTING
  COMPLETED
  FAILED
  ROLLED_BACK
}
```

## Modernization Playbooks

### 1. Java Legacy Modernization (6-12 months)

**Target**: Java 8/11 applications migrating to Java 21

#### Phase 1: Discovery (Month 1)
```typescript
// Automated discovery
const analysis = {
  // Current state
  javaVersion: '8',
  frameworks: ['Spring Boot 2.3', 'Hibernate 5.4'],
  dependencies: {
    total: 247,
    outdated: 156,
    vulnerabilities: 23,
  },
  codebase: {
    linesOfCode: 487_000,
    fileCount: 3_421,
    testCoverage: 34,
    complexity: 'High',
  },

  // Recommendations
  strategy: 'REFACTOR',           // Re-architect for modern Java
  estimatedEffort: '8 person-months',
  estimatedCost: '$240,000',
  estimatedROI: '4.2x',
  paybackPeriod: '7 months',
}
```

#### Phase 2: Foundation (Month 2-3)
**Transformations**:
1. Update to Java 17 (LTS) first, then Java 21
2. Update Spring Boot 2 → 3
3. Update all dependencies
4. Fix security vulnerabilities
5. Add comprehensive test coverage (target: 80%)

**AI-Powered Code Changes**:
- Replace `Date` with `LocalDateTime`
- Replace `new ArrayList<>()` with `var list = new ArrayList<String>()`
- Convert anonymous classes to lambdas
- Use switch expressions
- Use records for DTOs
- Use text blocks for multi-line strings

#### Phase 3: Modernization (Month 4-8)
**Transformations**:
1. Externalize configuration (12-factor app)
2. Add observability (metrics, logs, traces)
3. Containerization (Dockerfile, Kubernetes)
4. Database connection pooling
5. Add caching layer (Redis)
6. API documentation (OpenAPI 3.0)

#### Phase 4: Optimization (Month 9-12)
**Transformations**:
1. Performance tuning (enable ZGC)
2. Security hardening (OAuth 2.0, JWT)
3. CI/CD automation
4. Load testing and optimization
5. Documentation and knowledge transfer

### 2. .NET Framework → .NET 8 Modernization (6-9 months)

**Target**: .NET Framework 4.x applications

#### Phase 1: Assessment (Month 1)
- .NET Portability Analyzer
- Identify incompatible APIs
- Third-party dependency check
- Architecture review

#### Phase 2: Migration (Month 2-5)
**Transformations**:
1. Convert `.csproj` to SDK-style
2. Migrate to .NET 8
3. Replace System.Web with ASP.NET Core
4. Update Entity Framework 6 → EF Core 8
5. Replace WCF with gRPC/REST
6. Update authentication (ASP.NET Identity → Identity Server)

**AI-Powered Changes**:
- Auto-convert Web Forms to Razor Pages
- Convert `ConfigurationManager` to `IConfiguration`
- Update dependency injection patterns
- Convert synchronous to async/await

#### Phase 3: Modernization (Month 6-9)
1. Add minimal APIs
2. Containerization
3. Cloud-native patterns (health checks, metrics)
4. Performance optimization
5. Cross-platform deployment (Linux)

### 3. Monolith → Cloud-Native (9-18 months)

**Target**: Large monolithic applications

#### Phase 1: Modularization (Month 1-6)
**Strategy**: Strangler Fig Pattern

1. **Identify Bounded Contexts** (DDD):
   - Customer Management
   - Order Processing
   - Inventory Management
   - Billing & Payments

2. **Extract Modules** (within monolith):
   ```
   monolith/
     ├── customer-module/
     ├── order-module/
     ├── inventory-module/
     └── billing-module/
   ```

3. **Add Internal APIs**:
   - Module-to-module communication via interfaces
   - Prepare for future extraction

#### Phase 2: Extract Services (Month 7-12)
1. Start with least critical module
2. Extract to standalone service
3. Run in parallel with monolith
4. Gradual traffic shift (0% → 100%)
5. Repeat for each module

**AI-Powered Extraction**:
- Identify module boundaries
- Generate service scaffolding
- Create API contracts (OpenAPI)
- Generate client SDKs
- Add observability

#### Phase 3: Data Decoupling (Month 13-18)
1. Separate databases per service
2. Implement Saga pattern for distributed transactions
3. Event sourcing for critical flows
4. Add data synchronization
5. Eventual consistency patterns

### 4. COBOL Modernization (18-36 months)

**Target**: Mainframe COBOL applications (banks, insurance)

**Challenge**: 40+ year old systems, mission-critical

#### Phase 1: Documentation & Understanding (Month 1-6)
- AI-powered COBOL analysis
- Generate architecture diagrams
- Map business rules
- Identify data flows
- Document integrations

#### Phase 2: Strangler Fig Approach (Month 7-24)
1. **Don't rewrite COBOL**
2. **Wrap with APIs**:
   - Expose COBOL programs via REST APIs
   - Modern apps call COBOL via API gateway
3. **Gradually Replace**:
   - Implement new features in modern stack
   - Leave COBOL for stable core logic
4. **Data Synchronization**:
   - Dual-write to mainframe + cloud DB
   - Eventual migration off mainframe

#### Phase 3: Full Migration (Month 25-36)
1. Rewrite critical COBOL modules in Java/C#
2. Parallel run (COBOL + modern)
3. Shadow testing (verify outputs match)
4. Gradual cutover
5. Decommission COBOL

**AI-Powered COBOL Translation**:
- Convert COBOL to Java/C# (experimental)
- Preserve business logic
- Extensive testing required

## Implementation

### 1. Legacy System Discovery

```typescript
// Automated legacy system analysis

class LegacyDiscoveryService {
  async analyzeSystem(repositoryId: string): Promise<LegacySystem> {
    const repository = await this.db.repository.findUnique({
      where: { id: repositoryId },
    })

    // Clone repository
    const localPath = await this.gitService.clone(repository.url)

    // Parallel analysis
    const [
      codeMetrics,
      dependencies,
      vulnerabilities,
      testCoverage,
      complexity,
      techStack,
    ] = await Promise.all([
      this.analyzeCodeMetrics(localPath),
      this.analyzeDependencies(localPath),
      this.scanVulnerabilities(localPath),
      this.measureTestCoverage(localPath),
      this.calculateComplexity(localPath),
      this.detectTechStack(localPath),
    ])

    // Calculate technical debt ratio
    const technicalDebtRatio = this.calculateTechDebt({
      codeMetrics,
      testCoverage,
      complexity,
      vulnerabilities,
    })

    // Recommend modernization strategy
    const recommendedStrategy = this.recommendStrategy({
      techStack,
      technicalDebtRatio,
      complexity,
      testCoverage,
    })

    // Estimate effort
    const estimatedEffort = this.estimateEffort({
      linesOfCode: codeMetrics.linesOfCode,
      complexity,
      testCoverage,
      strategy: recommendedStrategy,
    })

    // Create legacy system record
    const legacySystem = await this.db.legacySystem.create({
      data: {
        organizationId: repository.organizationId,
        name: repository.name,
        primaryLanguage: techStack.language,
        languageVersion: techStack.version,
        framework: techStack.framework,
        frameworkVersion: techStack.frameworkVersion,
        databases: techStack.databases,
        linesOfCode: codeMetrics.linesOfCode,
        fileCount: codeMetrics.fileCount,
        complexity: complexity.average,
        technicalDebtRatio,
        testCoverage: testCoverage.percentage,
        dependencyCount: dependencies.total,
        outdatedDependencies: dependencies.outdated,
        vulnerabilities: vulnerabilities.length,
        recommendedStrategy,
        estimatedEffort,
        estimatedCost: this.estimateCost(estimatedEffort),
      },
    })

    return legacySystem
  }

  recommendStrategy(profile: {
    techStack: TechStack
    technicalDebtRatio: number
    complexity: ComplexityMetrics
    testCoverage: number
  }): ModernizationStrategy {
    // High tech debt + low test coverage = REBUILD
    if (profile.technicalDebtRatio > 0.6 && profile.testCoverage < 30) {
      return 'REBUILD'
    }

    // Moderate tech debt = REFACTOR
    if (profile.technicalDebtRatio > 0.3) {
      return 'REFACTOR'
    }

    // Low tech debt, just needs cloud = REHOST
    if (profile.technicalDebtRatio < 0.2 && profile.testCoverage > 60) {
      return 'REHOST'
    }

    // Default: REFACTOR
    return 'REFACTOR'
  }

  estimateEffort(params: {
    linesOfCode: number
    complexity: ComplexityMetrics
    testCoverage: number
    strategy: ModernizationStrategy
  }): number {
    // Base effort: 1 person-month per 10K LOC
    let effort = params.linesOfCode / 10_000

    // Adjust for complexity
    if (params.complexity.average > 15) {
      effort *= 1.5
    }

    // Adjust for test coverage (less coverage = more effort to test modernization)
    if (params.testCoverage < 30) {
      effort *= 1.3
    }

    // Adjust for strategy
    const strategyMultipliers = {
      REHOST: 0.5,
      REPLATFORM: 0.8,
      REFACTOR: 1.2,
      REBUILD: 2.0,
      REPLACE: 0.3,
      RETAIN: 0,
    }

    effort *= strategyMultipliers[params.strategy]

    return Math.round(effort)
  }
}
```

### 2. Modernization Execution

```typescript
// Execute modernization program

class ModernizationExecutionService {
  async executeProgram(programId: string) {
    const program = await this.db.modernizationProgram.findUnique({
      where: { id: programId },
      include: {
        phases: {
          include: { transformations: true },
          orderBy: { order: 'asc' },
        },
        legacySystem: true,
      },
    })

    // Capture baseline
    await this.captureBaseline(program)

    // Update status
    await this.db.modernizationProgram.update({
      where: { id: programId },
      data: { status: 'IN_PROGRESS' },
    })

    // Execute each phase
    for (const phase of program.phases) {
      await this.executePhase(phase.id, program)
    }

    // Validate results
    await this.validateModernization(program)

    // Calculate final ROI
    await this.calculateFinalROI(program.id)

    // Mark complete
    await this.db.modernizationProgram.update({
      where: { id: programId },
      data: {
        status: 'COMPLETED',
        actualEndDate: new Date(),
        progressPercentage: 100,
      },
    })
  }

  async executePhase(
    phaseId: string,
    program: ModernizationProgram
  ) {
    const phase = await this.db.modernizationPhase.findUnique({
      where: { id: phaseId },
      include: { transformations: { orderBy: { createdAt: 'asc' } } },
    })

    // Update status
    await this.db.modernizationPhase.update({
      where: { id: phaseId },
      data: { status: 'IN_PROGRESS' },
    })

    // Execute transformations
    for (const transformation of phase.transformations) {
      await this.executeTransformation(transformation.id, program)
    }

    // Phase validation
    if (phase.phaseType === 'VALIDATION') {
      await this.runValidationSuite(program)
    }

    // Mark complete
    await this.db.modernizationPhase.update({
      where: { id: phaseId },
      data: { status: 'COMPLETED' },
    })
  }

  async executeTransformation(
    transformationId: string,
    program: ModernizationProgram
  ) {
    const transformation = await this.db.modernizationTransformation.findUnique({
      where: { id: transformationId },
    })

    // Create change request (ADR-024)
    const changeRequest = await this.changeManagementService.createChangeRequest({
      organizationId: program.organizationId,
      title: `Modernization: ${transformation.name}`,
      description: `Part of ${program.strategy} modernization program`,
      transformationType: transformation.transformationType,
      scope: transformation.targetFiles,
    })

    // Link to transformation
    await this.db.modernizationTransformation.update({
      where: { id: transformationId },
      data: {
        changeRequestId: changeRequest.id,
        status: 'IN_PROGRESS',
      },
    })

    // Wait for completion
    const result = await this.waitForChangeRequest(changeRequest.id)

    // Update transformation with results
    await this.db.modernizationTransformation.update({
      where: { id: transformationId },
      data: {
        status: result.success ? 'COMPLETED' : 'FAILED',
        filesChanged: result.filesChanged,
        linesAdded: result.linesAdded,
        linesDeleted: result.linesDeleted,
        completedAt: new Date(),
      },
    })
  }

  async runValidationSuite(program: ModernizationProgram) {
    // Comprehensive validation
    const results = await Promise.all([
      this.runUnitTests(program.legacySystem),
      this.runIntegrationTests(program.legacySystem),
      this.runE2ETests(program.legacySystem),
      this.runPerformanceTests(program.legacySystem),
      this.runSecurityScan(program.legacySystem),
      this.runLoadTests(program.legacySystem),
    ])

    const allPassed = results.every(r => r.success)

    if (!allPassed) {
      throw new Error('Validation failed - some tests did not pass')
    }

    return results
  }
}
```

## Consequences

### Positive

1. **Proven Playbooks**: Reduce modernization risk from 55% failure to <15%
2. **AI-Powered Speed**: 5x faster than manual migration (AWS Transform benchmark)
3. **Cost Reduction**: 40-60% lower operational costs post-modernization
4. **Developer Productivity**: 20-50% improvement
5. **Systematic Approach**: Repeatable process across all legacy systems

### Negative

1. **Long Timelines**: Enterprise modernizations span 6-36 months
2. **High Upfront Cost**: $100K-1M+ investment required
3. **Business Disruption**: Risk of downtime during cutover
4. **Skill Gap**: Team may lack modern technology experience
5. **Legacy Knowledge Loss**: COBOL experts retiring

### Mitigations

1. **Incremental Value**: Each phase delivers ROI, not just final state
2. **Risk Management**: Strangler fig pattern minimizes disruption
3. **Training**: Comprehensive upskilling program for team
4. **Knowledge Capture**: AI-powered documentation before migration
5. **Rollback Plans**: One-click rollback for every change (ADR-024)

## Metrics & Success Criteria

### Technical Metrics
- **Test Coverage**: 30% → 80%+
- **Technical Debt Ratio**: 60% → <20%
- **Deployment Frequency**: Quarterly → Daily
- **MTTR**: 4 hours → <30 minutes
- **Vulnerability Count**: 50+ → 0 critical

### Business Metrics
- **Feature Velocity**: 3-5x faster delivery
- **Operational Cost**: 40-60% reduction
- **Downtime**: 99.9% → 99.99% uptime
- **Developer Satisfaction**: 50% → 85%+ happy

### ROI Metrics
- **Payback Period**: <12 months
- **ROI**: 4-10x return on investment
- **Cost Avoidance**: $500K-2M annually (vs maintaining legacy)

## References

- [AWS Transform: AI-Powered Code Modernization](https://aws.amazon.com/code-transformation/)
- [Airbnb: LLM-Driven Migration Case Study](https://medium.com/airbnb-engineering)
- [2026 Legacy Modernization Report - Devox](https://devoxsoftware.com/blog/the-2026-legacy-modernization-report-research-insights-and-strategic-roadmap/)
- [Gartner: Legacy System Modernization](https://www.gartner.com/en/documents/3991199)
- [Deloitte: Legacy Modernization Insights](https://www.deloitte.com/us/en/insights/topics/digital-transformation/legacy-system-modernization.html)
- ADR-024: Change Management for Code Transformations
- ADR-025: ROI Tracking for Code Transformations
- ADR-027: Digital Transformation Playbook

## Review Date
April 2026 (3 months)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-20
**Authors**: Engineering, Product, Solutions Architecture
**Approved By**: CTO, VP Engineering, Principal Architect
