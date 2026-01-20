# ADR-005: Deployment Strategy

## Status
Accepted

## Context
We need a deployment strategy that:
- Enables multiple deployments per day
- Maintains 99.9% uptime SLA
- Allows easy rollback on failures
- Minimizes risk of breaking changes
- Supports blue-green deployments
- Enables feature flags for gradual rollouts
- Works across multiple regions

## Decision
We will use **continuous deployment** with **blue-green deployments** and **feature flags** for production releases.

### Deployment Architecture

```
┌─────────────────────────────────────────────────────┐
│            GitHub Repository                         │
│         (main branch = production)                   │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│         GitHub Actions CI/CD                         │
│  • Lint, Test, Build                                │
│  • Security Scan                                     │
│  • Build Docker Images                              │
│  • Push to ECR                                      │
└────────────────┬────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
┌──────────────┐   ┌──────────────┐
│   Staging    │   │  Production  │
│   (Auto)     │   │  (Manual)    │
└──────────────┘   └──────────────┘
                           │
                ┌──────────┴──────────┐
                ▼                     ▼
        ┌──────────────┐      ┌──────────────┐
        │   Blue       │      │   Green      │
        │ (Current)    │      │  (New)       │
        └──────────────┘      └──────────────┘
                │                     │
                └──────────┬──────────┘
                           ▼
                    ┌─────────────┐
                    │ Load Balancer│
                    │  (Traffic   │
                    │   Switch)   │
                    └─────────────┘
```

## Deployment Environments

### 1. Development
- **Trigger**: Feature branch push
- **Deployment**: Manual (developer laptops)
- **Database**: Docker Compose local PostgreSQL
- **Purpose**: Feature development
- **Infrastructure**: Local Docker Compose

### 2. Staging
- **Trigger**: Merge to `main` branch (automatic)
- **Deployment**: Automatic via GitHub Actions
- **Database**: Dedicated RDS instance (mirrors prod)
- **Purpose**: Integration testing, QA
- **Infrastructure**: AWS ECS Fargate (single region: us-east-1)
- **URL**: `https://staging.forge.io`

### 3. Production
- **Trigger**: Git tag `v*` (e.g., `v1.2.3`)
- **Deployment**: Manual approval required
- **Database**: Multi-region RDS instances
- **Purpose**: Customer-facing
- **Infrastructure**: AWS ECS Fargate (multi-region)
- **URL**: `https://app.forge.io`

## Deployment Pipeline

### Stage 1: Build & Test
```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  create:
    tags:
      - 'v*'

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '22'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Type check
        run: pnpm type-check

      - name: Unit tests
        run: pnpm test

      - name: Integration tests
        run: pnpm test:integration

      - name: E2E tests
        run: pnpm test:e2e

      - name: Security scan
        run: pnpm security-scan

      - name: Build
        run: pnpm build
```

### Stage 2: Build Docker Images
```yaml
  build-images:
    needs: build-and-test
    runs-on: ubuntu-latest
    steps:
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: us-east-1

      - name: Login to Amazon ECR
        uses: aws-actions/amazon-ecr-login@v1

      - name: Build and push API image
        run: |
          docker build -t $ECR_REGISTRY/forge-api:$IMAGE_TAG -f apps/api/Dockerfile .
          docker push $ECR_REGISTRY/forge-api:$IMAGE_TAG

      - name: Build and push Portal image
        run: |
          docker build -t $ECR_REGISTRY/forge-portal:$IMAGE_TAG -f apps/portal/Dockerfile .
          docker push $ECR_REGISTRY/forge-portal:$IMAGE_TAG
```

### Stage 3: Deploy to Staging (Auto)
```yaml
  deploy-staging:
    if: github.ref == 'refs/heads/main'
    needs: build-images
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: Update ECS service
        run: |
          aws ecs update-service \
            --cluster forge-staging \
            --service forge-api \
            --force-new-deployment

      - name: Wait for deployment
        run: |
          aws ecs wait services-stable \
            --cluster forge-staging \
            --services forge-api

      - name: Smoke tests
        run: |
          curl -f https://staging.forge.io/health || exit 1
```

### Stage 4: Deploy to Production (Manual)
```yaml
  deploy-production:
    if: startsWith(github.ref, 'refs/tags/v')
    needs: build-images
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://app.forge.io
    steps:
      - name: Create GitHub deployment
        uses: actions/github-script@v6
        with:
          script: |
            await github.rest.repos.createDeployment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              ref: context.ref,
              environment: 'production',
              required_contexts: [],
            });

      - name: Blue-Green deployment
        run: |
          # Deploy to green environment
          ./scripts/blue-green-deploy.sh \
            --cluster forge-production \
            --service forge-api \
            --image $ECR_REGISTRY/forge-api:$IMAGE_TAG

      - name: Run smoke tests
        run: |
          ./scripts/smoke-tests.sh https://app.forge.io

      - name: Switch traffic
        run: |
          # Switch load balancer to green
          ./scripts/traffic-switch.sh --environment green

      - name: Monitor for 30 minutes
        run: |
          ./scripts/monitor.sh --duration 30m

      - name: Rollback if errors
        if: failure()
        run: |
          ./scripts/traffic-switch.sh --environment blue
```

## Blue-Green Deployment Process

### 1. Current State (Blue Active)
```
┌─────────────────┐
│  Load Balancer  │
└────────┬────────┘
         │ 100%
         ▼
┌─────────────────┐      ┌─────────────────┐
│  Blue (v1.0)    │      │  Green (idle)   │
│  ✅ Active      │      │  ⭕ Standby     │
└─────────────────┘      └─────────────────┘
```

### 2. Deploy to Green
```
┌─────────────────┐
│  Load Balancer  │
└────────┬────────┘
         │ 100%
         ▼
┌─────────────────┐      ┌─────────────────┐
│  Blue (v1.0)    │      │  Green (v1.1)   │
│  ✅ Active      │      │  🔄 Deploying   │
└─────────────────┘      └─────────────────┘
```

### 3. Smoke Test Green
```
┌─────────────────┐
│  Load Balancer  │
└────────┬────────┘
         │ 100%
         ▼
┌─────────────────┐      ┌─────────────────┐
│  Blue (v1.0)    │      │  Green (v1.1)   │
│  ✅ Active      │      │  🧪 Testing     │
└─────────────────┘      └─────────────────┘
```

### 4. Gradual Traffic Shift
```
┌─────────────────┐
│  Load Balancer  │
└────┬──────┬─────┘
     │ 90%  │ 10%
     ▼      ▼
┌─────────────────┐      ┌─────────────────┐
│  Blue (v1.0)    │      │  Green (v1.1)   │
│  ⚠️ Draining    │      │  ✅ Active      │
└─────────────────┘      └─────────────────┘
```

### 5. Full Cutover
```
┌─────────────────┐
│  Load Balancer  │
└────────┬────────┘
         │ 100%
         ▼
┌─────────────────┐      ┌─────────────────┐
│  Blue (v1.0)    │      │  Green (v1.1)   │
│  ⭕ Standby     │      │  ✅ Active      │
└─────────────────┘      └─────────────────┘
```

### 6. Rollback if Needed
```
┌─────────────────┐
│  Load Balancer  │
└────────┬────────┘
         │ 100%
         ▼
┌─────────────────┐      ┌─────────────────┐
│  Blue (v1.0)    │      │  Green (v1.1)   │
│  ✅ Active      │      │  ❌ Failed      │
└─────────────────┘      └─────────────────┘
```

## Database Migrations

### Migration Strategy
- **Expand-Contract pattern**: Make backward-compatible changes
- **No downtime**: Migrations run before deployment
- **Rollback support**: Keep old columns until next release

### Migration Process
```sql
-- Release N: Add new column (backward compatible)
ALTER TABLE organizations ADD COLUMN slug TEXT;

-- Application code supports both old and new schema
-- Deploy application

-- Release N+1: Backfill data
UPDATE organizations SET slug = LOWER(name) WHERE slug IS NULL;

-- Release N+2: Make required, drop old column
ALTER TABLE organizations ALTER COLUMN slug SET NOT NULL;
ALTER TABLE organizations ADD CONSTRAINT organizations_slug_unique UNIQUE (slug);
```

### Migration Execution
```bash
# Before deployment
pnpm prisma migrate deploy

# Verify migration
pnpm prisma db execute --sql "SELECT version FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 1"
```

## Feature Flags

### Use Cases
- Gradual rollout of new features
- A/B testing
- Emergency kill switch
- Plan-gated features
- Region-specific features

### Implementation
```typescript
import { unleash } from '@forge/feature-flags';

// Check feature flag
if (await unleash.isEnabled('new-organization-ui', context)) {
  return <NewOrganizationUI />;
} else {
  return <LegacyOrganizationUI />;
}
```

### Rollout Strategy
```typescript
// Day 1: 5% internal users
{
  name: 'new-organization-ui',
  enabled: true,
  strategies: [
    {
      name: 'gradualRollout',
      parameters: { percentage: 5, userGroup: 'internal' }
    }
  ]
}

// Day 3: 25% all users
{
  strategies: [
    {
      name: 'gradualRollout',
      parameters: { percentage: 25 }
    }
  ]
}

// Day 7: 100% all users
{
  strategies: [
    {
      name: 'default',
      parameters: {}
    }
  ]
}
```

## Rollback Procedures

### Application Rollback
```bash
# Instant rollback: Switch traffic back to blue
./scripts/traffic-switch.sh --environment blue

# Time to rollback: < 2 minutes
```

### Database Rollback
```bash
# Roll back last migration
pnpm prisma migrate resolve --rolled-back <migration_name>

# Time to rollback: Depends on data volume
# Prevention: Expand-contract pattern avoids need for rollback
```

### Feature Flag Rollback
```bash
# Instant disable via Unleash UI or API
curl -X POST https://unleash.forge.io/api/admin/features/new-feature/toggle/off
```

## Monitoring During Deployment

### Key Metrics
```yaml
metrics:
  - error_rate          # Should stay < 1%
  - latency_p99         # Should stay < 400ms
  - active_connections  # Should not drop
  - http_5xx_count      # Should stay near 0
  - database_connections # Should stay < 80%
```

### Automatic Rollback Triggers
```typescript
// If any of these conditions met for > 2 minutes:
const rollbackTriggers = {
  errorRate: errorRate > 0.05,           // 5% errors
  latencyP99: latencyP99 > 1000,         // 1s latency
  http5xxRate: http5xxRate > 0.02,       // 2% 5xx errors
  activeConnections: activeConnections < previousActiveConnections * 0.5, // 50% drop
};
```

## Multi-Region Deployment

### Deployment Order
1. **Deploy to us-east-1** (primary region)
2. **Monitor for 1 hour**
3. **Deploy to eu-west-1**
4. **Monitor for 1 hour**
5. **Deploy to ap-southeast-1**

### Region-Specific Considerations
- Database migrations run in primary region first
- Feature flags synced across regions
- CDN cache invalidated globally

## Deployment Frequency

### Current Target
- **Staging**: 10-20 deployments/day
- **Production**: 2-5 deployments/day

### Deployment Windows
- **Staging**: Anytime (24/7)
- **Production**:
  - Preferred: Mon-Thu, 10am-4pm EST
  - Avoided: Friday afternoon, weekends, holidays
  - Emergency: Anytime with incident commander approval

## Consequences

### Positive
- **Fast iteration**: Deploy multiple times per day
- **Low risk**: Blue-green allows instant rollback
- **Minimal downtime**: Zero-downtime deployments
- **Gradual rollout**: Feature flags enable safe rollouts
- **Confidence**: Automated tests catch issues before production

### Negative
- **Complexity**: More infrastructure to manage
- **Cost**: Running blue and green simultaneously
- **Database migrations**: Require careful planning
- **Feature flag debt**: Old flags must be cleaned up

### Mitigations
- **Infrastructure as Code**: Terraform manages all infra
- **Cost optimization**: Green only runs during deployment
- **Migration strategy**: Expand-contract pattern
- **Flag hygiene**: Monthly cleanup of old flags

## Alternatives Considered

### 1. Rolling Deployment
**Rejected**: Higher risk, harder to rollback

### 2. Canary Deployment
**Considered**: Similar to blue-green but more gradual
- May adopt for high-risk changes
- Requires more sophisticated traffic routing

### 3. Immutable Infrastructure
**Partially adopted**: Docker images are immutable
- Full immutability (recreate entire cluster) too slow

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Security scan clean
- [ ] Database migrations tested in staging
- [ ] Changelog updated
- [ ] Feature flags configured
- [ ] Stakeholders notified

### During Deployment
- [ ] Smoke tests pass
- [ ] Error rate normal
- [ ] Latency normal
- [ ] Database connections healthy

### Post-Deployment
- [ ] Monitor metrics for 30 minutes
- [ ] Verify key user journeys
- [ ] Check error tracking (Sentry)
- [ ] Update status page
- [ ] Announce in #engineering Slack

## References
- [Blue-Green Deployment](https://martinfowler.com/bliki/BlueGreenDeployment.html)
- [Feature Flags](https://martinfowler.com/articles/feature-toggles.html)
- [Expand-Contract Pattern](https://www.tim-wellhausen.de/papers/ExpandContract.pdf)
- [AWS ECS Deployment](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-types.html)

## Review Date
2024-04-16 (3 months)
