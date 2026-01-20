# ADR-029: Cloud Migration & Hybrid Cloud Playbook

## Status
Proposed

## Context

**Cloud adoption is accelerating**: By 2026, 95% of new digital workloads will be deployed on cloud-native platforms (Gartner). However, the journey from on-premise to cloud is complex, with **70% of cloud migrations exceeding budget** and **50% experiencing significant delays**.

### Market Reality (2026)

**Cloud Migration Market**:
- **$500B+ annual spend** on cloud infrastructure (AWS, Azure, GCP)
- **$45B migration services market** (growing 22% YoY)
- **Average cloud migration**: 12-18 months for enterprises
- **Cost overruns**: 40-60% over initial estimates (common)
- **Failed migrations**: 25-30% require rollback or restart

**Hybrid Cloud Growth**:
- **85% of enterprises** adopt hybrid/multi-cloud strategies
- **Regulatory drivers**: Data sovereignty, compliance requirements
- **Performance needs**: Edge computing, low-latency applications
- **Risk mitigation**: Avoid vendor lock-in

### Cloud Migration Patterns

**The 6 R's** (AWS Well-Architected Framework):

1. **Rehost (Lift & Shift)**: Move as-is → **Fastest (1-3 months), Low value**
2. **Replatform (Lift & Optimize)**: Minor optimizations → **Moderate speed (3-6 months), Moderate value**
3. **Refactor (Re-architect)**: Cloud-native rebuild → **Slow (6-18 months), High value**
4. **Repurchase**: Switch to SaaS → **Fast (1-2 months), High value**
5. **Retire**: Decommission unnecessary systems → **Immediate, Cost savings**
6. **Retain**: Keep on-premise (for now) → **No migration, Strategic**

### Common Migration Challenges

**Technical**:
- ❌ Application dependencies (hard to untangle)
- ❌ Data migration (TB-PB scale, downtime)
- ❌ Network latency (cloud vs on-premise)
- ❌ Security/compliance (data sovereignty)
- ❌ Cost optimization (over-provisioning)

**Organizational**:
- ❌ Skill gaps (cloud-native expertise)
- ❌ Resistance to change
- ❌ Unclear ROI
- ❌ Vendor lock-in fears

**Financial**:
- ❌ Unpredictable costs (cloud billing complexity)
- ❌ Hidden migration costs
- ❌ Dual-running costs (on-prem + cloud during transition)

## Decision

Implement **comprehensive Cloud Migration & Hybrid Cloud Playbook** supporting all 6 migration patterns, automated cloud-native refactoring, cost optimization, and hybrid cloud orchestration.

### Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│        Cloud Migration & Hybrid Cloud Playbook                 │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Discovery → Assessment → Migration → Optimization → Governance │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Phase 1: Discovery & Assessment              │  │
│  │                                                            │  │
│  │  Application Portfolio Analysis:                          │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ App 1: Customer Portal (Java)                       │  │  │
│  │  │  - Traffic: 10K req/day                             │  │  │
│  │  │  - Data: 500GB PostgreSQL                           │  │  │
│  │  │  - Dependencies: Auth Service, Payment Gateway      │  │  │
│  │  │  - Recommendation: REPLATFORM (Containers + RDS)    │  │  │
│  │  │  - Estimated: 3 months, $120K                       │  │  │
│  │  │                                                       │  │  │
│  │  │ App 2: Batch Processing (Python)                    │  │  │
│  │  │  - Usage: Nightly jobs                              │  │  │
│  │  │  - Recommendation: REFACTOR (Lambda/Step Functions) │  │  │
│  │  │  - Estimated: 2 months, $60K                        │  │  │
│  │  │                                                       │  │  │
│  │  │ App 3: Legacy Reporting (COBOL)                     │  │  │
│  │  │  - Recommendation: RETAIN (on-premise)              │  │  │
│  │  │  - Reason: Compliance, low business value           │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │  Migration Complexity Scoring:                            │  │
│  │  - Application dependencies (1-10)                        │  │
│  │  - Data volume & sensitivity (1-10)                       │  │
│  │  - Compliance requirements (1-10)                         │  │
│  │  - Technical debt (1-10)                                  │  │
│  │  - Business criticality (1-10)                            │  │
│  │                                                            │  │
│  │  Total Score → Recommend Migration Strategy              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Phase 2: Migration Planning                  │  │
│  │                                                            │  │
│  │  Wave Planning:                                           │  │
│  │  ┌────────────────────────────────────────────────────┐   │  │
│  │  │ Wave 1 (Month 1-3): Low-risk, high-value          │   │  │
│  │  │  - Dev/Test environments                           │   │  │
│  │  │  - Non-critical apps                               │   │  │
│  │  │  - Gain experience & confidence                    │   │  │
│  │  │                                                     │   │  │
│  │  │ Wave 2 (Month 4-6): Medium complexity              │   │  │
│  │  │  - Internal tools                                  │   │  │
│  │  │  - Customer-facing (low traffic)                   │   │  │
│  │  │                                                     │   │  │
│  │  │ Wave 3 (Month 7-12): High-value, complex           │   │  │
│  │  │  - Core business applications                      │   │  │
│  │  │  - High-traffic customer systems                   │   │  │
│  │  │  - Revenue-critical workloads                      │   │  │
│  │  │                                                     │   │  │
│  │  │ Wave 4 (Month 13+): Hybrid/Retain                  │   │  │
│  │  │  - Systems staying on-premise                      │   │  │
│  │  │  - Hybrid connectivity setup                       │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  │                                                            │  │
│  │  Cloud Provider Selection:                                │  │
│  │  - AWS: Market leader, broadest services                  │  │
│  │  - Azure: Best for Microsoft shops                        │  │
│  │  - GCP: Strong in data/ML                                 │  │
│  │  - Multi-cloud: Avoid vendor lock-in                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Phase 3: Migration Execution                 │  │
│  │                                                            │  │
│  │  REHOST (Lift & Shift):                                   │  │
│  │  ┌────────────────────────────────────────────────────┐   │  │
│  │  │ 1. Provision cloud infrastructure (IaC)            │   │  │
│  │  │    - Terraform/CloudFormation                      │   │  │
│  │  │    - VPC, subnets, security groups                 │   │  │
│  │  │    - EC2 instances (match on-prem sizing)          │   │  │
│  │  │                                                     │   │  │
│  │  │ 2. Data migration                                  │   │  │
│  │  │    - Database replication (DMS)                    │   │  │
│  │  │    - File sync (rsync, DataSync)                   │   │  │
│  │  │    - Minimize downtime window                      │   │  │
│  │  │                                                     │   │  │
│  │  │ 3. Application migration                           │   │  │
│  │  │    - Deploy to EC2/VMs                             │   │  │
│  │  │    - Update configs (endpoints, secrets)           │   │  │
│  │  │    - DNS cutover                                   │   │  │
│  │  │                                                     │   │  │
│  │  │ 4. Testing & validation                            │   │  │
│  │  │    - Smoke tests                                   │   │  │
│  │  │    - Performance tests                             │   │  │
│  │  │    - User acceptance testing                       │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  │                                                            │  │
│  │  REPLATFORM (Lift & Optimize):                            │  │
│  │  ┌────────────────────────────────────────────────────┐   │  │
│  │  │ 1. Containerization                                │   │  │
│  │  │    - Create Dockerfile                             │   │  │
│  │  │    - Build container images                        │   │  │
│  │  │    - Push to ECR/ACR/GCR                           │   │  │
│  │  │                                                     │   │  │
│  │  │ 2. Managed services                                │   │  │
│  │  │    - RDS (vs self-managed DB)                      │   │  │
│  │  │    - ElastiCache (vs self-managed Redis)           │   │  │
│  │  │    - S3 (vs file servers)                          │   │  │
│  │  │                                                     │   │  │
│  │  │ 3. Deploy to orchestration                         │   │  │
│  │  │    - ECS/EKS (AWS)                                 │   │  │
│  │  │    - AKS (Azure)                                   │   │  │
│  │  │    - GKE (GCP)                                     │   │  │
│  │  │                                                     │   │  │
│  │  │ 4. Add cloud-native features                       │   │  │
│  │  │    - Auto-scaling                                  │   │  │
│  │  │    - Load balancing                                │   │  │
│  │  │    - Managed monitoring (CloudWatch)               │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  │                                                            │  │
│  │  REFACTOR (Cloud-Native):                                 │  │
│  │  ┌────────────────────────────────────────────────────┐   │  │
│  │  │ AI-Powered Refactoring:                            │   │  │
│  │  │ - Decompose monolith → microservices               │   │  │
│  │  │ - Convert batch jobs → serverless (Lambda)         │   │  │
│  │  │ - Add event-driven patterns (SNS/SQS)              │   │  │
│  │  │ - Implement 12-factor app principles               │   │  │
│  │  │ - Add observability (traces, metrics, logs)        │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Phase 4: Optimization                        │  │
│  │                                                            │  │
│  │  Cost Optimization:                                       │  │
│  │  - Right-sizing (eliminate over-provisioning)             │  │
│  │  - Reserved instances / Savings Plans                     │  │
│  │  - Spot instances for non-critical workloads              │  │
│  │  - Auto-scaling policies                                  │  │
│  │  - S3 lifecycle policies (Glacier for archival)           │  │
│  │  - Unused resource cleanup                                │  │
│  │                                                            │  │
│  │  Performance Optimization:                                │  │
│  │  - CDN (CloudFront)                                       │  │
│  │  - Caching (ElastiCache)                                  │  │
│  │  - Database optimization (read replicas)                  │  │
│  │  - Query optimization                                     │  │
│  │                                                            │  │
│  │  Security Hardening:                                      │  │
│  │  - IAM least privilege                                    │  │
│  │  - Encryption at rest & in transit                        │  │
│  │  - VPC security groups                                    │  │
│  │  - WAF for DDoS protection                                │  │
│  │  - Secrets Manager                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Hybrid Cloud Orchestration                   │  │
│  │                                                            │  │
│  │  For systems that must stay on-premise:                   │  │
│  │                                                            │  │
│  │  ┌────────────────────┐         ┌─────────────────────┐   │  │
│  │  │   On-Premise       │◄──────►│   Cloud (AWS/Azure) │   │  │
│  │  │                    │  VPN/   │                     │   │  │
│  │  │ - Legacy COBOL     │ Direct  │ - Modern Apps       │   │  │
│  │  │ - Mainframes       │ Connect │ - Microservices     │   │  │
│  │  │ - Compliance DBs   │         │ - Serverless        │   │  │
│  │  └────────────────────┘         └─────────────────────┘   │  │
│  │           │                               │                │  │
│  │           └───────── Hybrid Data ─────────┘                │  │
│  │                    Synchronization                         │  │
│  │                                                            │  │
│  │  Hybrid Connectivity:                                     │  │
│  │  - AWS Direct Connect / Azure ExpressRoute                │  │
│  │  - Site-to-Site VPN (backup)                              │  │
│  │  - Hybrid DNS (Route 53 + on-prem)                        │  │
│  │  - Data synchronization (DMS, Kafka)                      │  │
│  │                                                            │  │
│  │  Use Cases:                                               │  │
│  │  - Compliance: Keep PII/PHI on-premise                    │  │
│  │  - Latency: Local processing, cloud analytics             │  │
│  │  - Cost: Keep stable workloads on-prem, burst to cloud    │  │
│  │  - Risk: Gradual migration path                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

## Data Model

```typescript
/**
 * @prompt-id forge-v4.1:cloud-migration:data-model:001
 * @generated-at 2026-01-20T00:00:00Z
 * @model claude-sonnet-4-5
 */

model CloudMigrationProgram {
  id                    String   @id @default(cuid())
  organizationId        String
  organization          Organization @relation(fields: [organizationId], references: [id])

  name                  String
  description           String

  // Cloud provider
  targetCloudProvider   CloudProvider
  targetRegion          String           // us-east-1, eu-west-1, etc.
  multiCloud            Boolean @default(false)

  // Migration approach
  strategy              MigrationStrategy // HYBRID, CLOUD_ONLY, MULTI_CLOUD

  // Timeline
  startDate             DateTime
  targetEndDate         DateTime
  actualEndDate         DateTime?

  status                ProgramStatus
  progressPercentage    Int @default(0)

  // Waves
  waves                 MigrationWave[]

  // Budget
  estimatedCost         Int              // Cents
  actualCost            Int @default(0)

  // ROI
  projectedROI          Float
  actualROI             Float?

  // Governance
  programManager        String
  manager               User @relation(fields: [programManager], references: [id])

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([organizationId])
  @@index([status])
}

enum CloudProvider {
  AWS
  AZURE
  GCP
  ALIBABA_CLOUD
  ORACLE_CLOUD
  IBM_CLOUD
  MULTI_CLOUD              // Multiple providers
}

enum MigrationStrategy {
  CLOUD_ONLY               // All to cloud
  HYBRID                   // Mix of cloud + on-premise
  MULTI_CLOUD              // Spread across providers
}

// Migration wave (batch of applications)
model MigrationWave {
  id                    String   @id @default(cuid())
  programId             String
  program               CloudMigrationProgram @relation(fields: [programId], references: [id])

  name                  String           // "Wave 1: Dev/Test"
  description           String
  order                 Int

  startDate             DateTime
  endDate               DateTime

  status                WaveStatus

  // Applications in this wave
  applications          ApplicationMigration[]

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([programId])
  @@unique([programId, order])
}

enum WaveStatus {
  NOT_STARTED
  IN_PROGRESS
  COMPLETED
  BLOCKED
}

// Individual application migration
model ApplicationMigration {
  id                    String   @id @default(cuid())
  waveId                String
  wave                  MigrationWave @relation(fields: [waveId], references: [id])

  // Application details
  applicationName       String
  description           String?
  currentHosting        HostingLocation  // ON_PREMISE, COLO, etc.

  // Migration pattern
  migrationPattern      MigrationPattern // REHOST, REPLATFORM, REFACTOR, etc.

  // Complexity assessment
  complexityScore       Int              // 1-100
  dependencies          Json             // Dependent apps/services
  dataVolume            BigInt           // Bytes

  // Target architecture
  targetArchitecture    Json             // ECS, Lambda, EC2, RDS, etc.

  // Status
  status                MigrationStatus

  // Timeline
  startDate             DateTime?
  completedDate         DateTime?

  // Costs
  estimatedCost         Int              // Cents
  actualCost            Int?

  // Change requests
  changeRequests        ChangeRequest[]

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([waveId])
  @@index([status])
}

enum HostingLocation {
  ON_PREMISE
  COLO
  CLOUD_AWS
  CLOUD_AZURE
  CLOUD_GCP
  HYBRID
}

enum MigrationPattern {
  REHOST                // Lift & shift
  REPLATFORM            // Lift & optimize
  REFACTOR              // Re-architect
  REPURCHASE            // Buy SaaS
  RETIRE                // Decommission
  RETAIN                // Keep on-premise
}

enum MigrationStatus {
  PENDING
  DISCOVERY
  PLANNING
  MIGRATING
  TESTING
  COMPLETED
  FAILED
  ROLLED_BACK
}

// Hybrid cloud connection
model HybridConnection {
  id                    String   @id @default(cuid())
  organizationId        String
  organization          Organization @relation(fields: [organizationId], references: [id])

  name                  String
  connectionType        ConnectionType

  // On-premise details
  onPremiseLocation     String
  onPremiseIpRange      String

  // Cloud details
  cloudProvider         CloudProvider
  cloudRegion           String
  cloudVpcId            String?

  // Connection details
  bandwidth             String           // "1Gbps", "10Gbps"
  latency               Int?             // Milliseconds

  status                ConnectionStatus

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([organizationId])
}

enum ConnectionType {
  VPN                   // Site-to-site VPN
  DIRECT_CONNECT        // AWS Direct Connect
  EXPRESS_ROUTE         // Azure ExpressRoute
  INTERCONNECT          // GCP Cloud Interconnect
}

enum ConnectionStatus {
  PROVISIONING
  ACTIVE
  DEGRADED
  DOWN
}
```

## Migration Playbooks

### 1. Lift & Shift (REHOST) - 1-3 months

**Best for**: Quick cloud adoption, minimal refactoring

```typescript
// Automated lift & shift
const rehostPlaybook = {
  phases: [
    {
      name: 'Infrastructure Provisioning',
      duration: '1-2 weeks',
      steps: [
        'Create VPC and subnets',
        'Set up security groups',
        'Provision EC2 instances (match on-prem sizing)',
        'Set up load balancers',
        'Configure DNS',
      ],
    },
    {
      name: 'Data Migration',
      duration: '1-2 weeks',
      steps: [
        'Set up AWS DMS replication',
        'Initial bulk data sync',
        'Continuous replication',
        'Cutover window planning',
      ],
    },
    {
      name: 'Application Migration',
      duration: '2-4 weeks',
      steps: [
        'Deploy application to EC2',
        'Update configuration (endpoints, secrets)',
        'Install dependencies',
        'Configure monitoring',
      ],
    },
    {
      name: 'Cutover & Validation',
      duration: '1 week',
      steps: [
        'Final data sync',
        'DNS cutover',
        'Smoke tests',
        'Performance validation',
        'Rollback plan ready',
      ],
    },
  ],

  estimatedCost: {
    migration: '$50K-100K',
    monthlyRun: '$5K-15K',
  },

  expectedBenefits: {
    timeline: 'Fastest (1-3 months)',
    risk: 'Low',
    value: 'Moderate (infrastructure modernization)',
    costSavings: '20-30% vs on-premise',
  },
}
```

### 2. Containerization (REPLATFORM) - 3-6 months

**Best for**: Moderate modernization, containers

```typescript
// Containerization playbook
const replatformPlaybook = {
  phases: [
    {
      name: 'Containerization',
      duration: '4-6 weeks',
      transformations: [
        'CREATE_DOCKERFILE',
        'CONTAINERIZE_APPLICATION',
        'BUILD_IMAGES',
        'PUSH_TO_REGISTRY',
      ],
    },
    {
      name: 'Managed Services',
      duration: '2-3 weeks',
      steps: [
        'Migrate DB to RDS',
        'Set up ElastiCache for Redis',
        'Configure S3 for file storage',
        'Set up managed monitoring',
      ],
    },
    {
      name: 'Orchestration',
      duration: '3-4 weeks',
      steps: [
        'Set up ECS/EKS cluster',
        'Deploy containers',
        'Configure auto-scaling',
        'Set up service mesh (optional)',
      ],
    },
    {
      name: 'Cloud-Native Features',
      duration: '2-3 weeks',
      transformations: [
        'ADD_HEALTH_CHECKS',
        'ADD_METRICS',
        'ADD_DISTRIBUTED_TRACING',
        'EXTERNALIZE_CONFIG',
      ],
    },
  ],

  estimatedCost: {
    migration: '$120K-250K',
    monthlyRun: '$8K-20K',
  },

  expectedBenefits: {
    timeline: 'Moderate (3-6 months)',
    risk: 'Medium',
    value: 'High (cloud-native benefits)',
    costSavings: '40-50% vs on-premise',
  },
}
```

### 3. Cloud-Native Refactoring (REFACTOR) - 6-18 months

**Best for**: Maximum cloud value, greenfield-like

```typescript
// Cloud-native refactoring
const refactorPlaybook = {
  phases: [
    {
      name: 'Architecture Design',
      duration: '1-2 months',
      steps: [
        'Design microservices boundaries',
        'Define API contracts',
        'Plan data partitioning',
        'Choose cloud services (Lambda, DynamoDB, etc.)',
      ],
    },
    {
      name: 'Decomposition',
      duration: '3-6 months',
      transformations: [
        'DECOMPOSE_MONOLITH',
        'EXTRACT_MICROSERVICES',
        'IMPLEMENT_API_GATEWAY',
        'ADD_EVENT_DRIVEN_PATTERNS',
      ],
    },
    {
      name: 'Serverless Migration',
      duration: '2-4 months',
      transformations: [
        'CONVERT_TO_LAMBDA_FUNCTIONS',
        'IMPLEMENT_STEP_FUNCTIONS',
        'ADD_SQS_SNS_MESSAGING',
        'USE_DYNAMODB_AURORA_SERVERLESS',
      ],
    },
    {
      name: 'Optimization',
      duration: '1-2 months',
      steps: [
        'Performance tuning',
        'Cost optimization',
        'Security hardening',
        'Observability enhancement',
      ],
    },
  ],

  estimatedCost: {
    migration: '$500K-2M',
    monthlyRun: '$10K-30K',
  },

  expectedBenefits: {
    timeline: 'Long (6-18 months)',
    risk: 'High',
    value: 'Highest (full cloud benefits)',
    costSavings: '60-70% vs on-premise',
  },
}
```

### 4. Hybrid Cloud Strategy - Ongoing

**Best for**: Compliance, gradual migration, risk mitigation

```typescript
// Hybrid cloud orchestration
const hybridPlaybook = {
  scenarios: [
    {
      name: 'Compliance-Driven Hybrid',
      description: 'Keep regulated data on-premise, analytics in cloud',
      architecture: {
        onPremise: ['Customer PII database', 'HIPAA-regulated systems'],
        cloud: ['Analytics platform', 'Machine learning', 'Public APIs'],
        connectivity: 'AWS Direct Connect (10Gbps)',
        dataSynchronization: 'AWS DMS + Kafka',
      },
    },
    {
      name: 'Burst-to-Cloud',
      description: 'Stable workloads on-prem, scale to cloud on demand',
      architecture: {
        onPremise: ['Core applications (steady state)'],
        cloud: ['Auto-scaling web tier', 'Seasonal batch processing'],
        connectivity: 'VPN + CloudFormation Auto-Scaling',
      },
    },
    {
      name: 'Multi-Cloud Redundancy',
      description: 'Primary AWS, failover to Azure',
      architecture: {
        primary: 'AWS (us-east-1)',
        secondary: 'Azure (East US)',
        replication: 'Active-passive, async replication',
      },
    },
  ],

  implementation: {
    phases: [
      'Establish hybrid connectivity (Direct Connect)',
      'Set up data synchronization',
      'Deploy hybrid DNS (Route 53 + on-prem)',
      'Implement unified monitoring',
      'Set up cross-environment security',
    ],
  },
}
```

## Cost Optimization Strategies

```typescript
// AI-powered cost optimization
class CloudCostOptimizer {
  async optimizeCosts(organizationId: string) {
    const recommendations = []

    // 1. Right-sizing (eliminate over-provisioning)
    const oversizedInstances = await this.findOversizedInstances(organizationId)
    for (const instance of oversizedInstances) {
      recommendations.push({
        type: 'RIGHT_SIZE',
        resource: instance.id,
        currentSize: instance.type,
        recommendedSize: instance.rightSize,
        monthlySavings: instance.savings,
      })
    }

    // 2. Reserved instances / Savings Plans
    const steadyWorkloads = await this.findSteadyWorkloads(organizationId)
    recommendations.push({
      type: 'RESERVED_INSTANCES',
      commitment: '1-year',
      discount: '30-40%',
      estimatedSavings: this.calculateReservedSavings(steadyWorkloads),
    })

    // 3. Spot instances
    const batchJobs = await this.findBatchJobs(organizationId)
    recommendations.push({
      type: 'SPOT_INSTANCES',
      workloads: batchJobs,
      discount: '70-90%',
      estimatedSavings: this.calculateSpotSavings(batchJobs),
    })

    // 4. Auto-scaling
    const scalableApps = await this.findScalableApps(organizationId)
    recommendations.push({
      type: 'AUTO_SCALING',
      applications: scalableApps,
      currentCost: this.currentScalingCost(scalableApps),
      optimizedCost: this.optimizedScalingCost(scalableApps),
    })

    // 5. Storage lifecycle policies
    const oldData = await this.findInactiveData(organizationId)
    recommendations.push({
      type: 'S3_LIFECYCLE',
      data: oldData,
      action: 'Move to Glacier after 90 days',
      monthlySavings: oldData.storageGB * 0.02, // $0.02/GB savings
    })

    return recommendations
  }
}
```

## Consequences

### Positive

1. **Flexibility**: Support all migration patterns (6 R's)
2. **Hybrid Support**: Enable gradual, low-risk migrations
3. **Cost Optimization**: AI-powered recommendations save 40-60%
4. **Speed**: Automated migrations 5x faster than manual
5. **Multi-Cloud**: Avoid vendor lock-in

### Negative

1. **Complexity**: Many migration patterns to support
2. **Cost Unpredictability**: Cloud billing is complex
3. **Skill Gap**: Teams need cloud expertise
4. **Dual-Running Costs**: Pay for on-prem + cloud during migration
5. **Data Transfer**: TB-PB migrations expensive

### Mitigations

1. **Decision Framework**: AI recommends best pattern per app
2. **Cost Monitoring**: Real-time dashboards, budget alerts
3. **Training**: Comprehensive cloud upskilling program
4. **Phased Approach**: Minimize dual-running period
5. **Data Optimization**: Compress, deduplicate before transfer

## Metrics & Success Criteria

### Migration Velocity
- **Wave 1 completion**: <3 months
- **Full migration**: 80%+ apps migrated within 12 months
- **Success rate**: 95%+ migrations succeed

### Cost
- **Migration cost**: Within 10% of estimate
- **Operational cost**: 40-60% reduction vs on-premise
- **ROI**: Achieve within 12-18 months

### Performance
- **Latency**: ≤20ms increase vs on-premise
- **Uptime**: 99.9%+ during migration
- **Scalability**: 10x scale capacity

## References

- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [Azure Cloud Adoption Framework](https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/)
- [Gartner: Cloud Migration Best Practices 2026](https://www.gartner.com/en/information-technology/insights/cloud-strategy)
- ADR-024: Change Management for Code Transformations
- ADR-025: ROI Tracking for Code Transformations
- ADR-028: Legacy System Modernization Playbook

---

**Document Version**: 1.0
**Last Updated**: 2026-01-20
**Authors**: Cloud Architecture, Engineering
