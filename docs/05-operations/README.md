# Operations Guide

This directory contains operational documentation, deployment guides, and runbooks for the Forge Factory platform.

## Overview

Operations documentation covers:
- **Deployment**: How to deploy the platform
- **Monitoring**: Observability and alerting
- **Incident Response**: How to handle incidents
- **Runbooks**: Step-by-step procedures for common operations
- **Maintenance**: Regular maintenance tasks

## Quick Links

- [Deployment Guide](#deployment)
- [Monitoring & Alerting](#monitoring--alerting)
- [Incident Response](#incident-response)
- [Runbooks](./runbooks/)

## Deployment

### Production Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Production Stack                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  CloudFront (CDN)                                        │
│      ↓                                                   │
│  ALB (Load Balancer)                                     │
│      ↓                                                   │
│  ┌──────────────────────────────────────────────────┐  │
│  │  ECS Fargate (Containers)                        │  │
│  │  - API containers (auto-scaling)                 │  │
│  │  - Worker containers (BullMQ)                    │  │
│  │  - WebSocket servers (Socket.io)                 │  │
│  └──────────────────────────────────────────────────┘  │
│      ↓                          ↓                        │
│  ┌─────────────┐          ┌─────────────┐              │
│  │  RDS Proxy  │          │ ElastiCache │              │
│  │     ↓       │          │   (Redis)   │              │
│  │  PostgreSQL │          └─────────────┘              │
│  └─────────────┘                                        │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Deployment Process

#### 1. Pre-deployment Checklist

- [ ] All tests passing in CI
- [ ] Database migrations reviewed
- [ ] Environment variables updated
- [ ] Feature flags configured
- [ ] Rollback plan prepared
- [ ] Team notified of deployment

#### 2. Deploy to Staging

```bash
# Deploy to staging
pnpm deploy:staging

# Run smoke tests
pnpm test:smoke:staging

# Verify deployment
pnpm verify:staging
```

#### 3. Deploy to Production

```bash
# Deploy to production
pnpm deploy:production

# Monitor deployment
pnpm monitor:deployment

# Verify health checks
pnpm health:check
```

#### 4. Post-deployment

- [ ] Verify all services healthy
- [ ] Check error rates in Sentry
- [ ] Monitor performance metrics
- [ ] Verify critical user flows
- [ ] Update deployment log

### Deployment Strategies

**Blue-Green Deployment**: Zero-downtime deployments
- Deploy new version alongside old
- Switch traffic to new version
- Keep old version for quick rollback

**Canary Deployment**: Gradual rollout
- Deploy to 10% of traffic
- Monitor for 30 minutes
- Gradually increase to 100%

### Rollback Procedure

If issues are detected:

```bash
# Immediate rollback
pnpm rollback:production

# Or rollback to specific version
pnpm rollback:production --version=v1.2.3
```

## Monitoring & Alerting

### Key Metrics

#### Application Metrics
- **Request Rate**: Requests per second
- **Error Rate**: 4xx/5xx error percentage
- **Latency**: P50, P95, P99 response times
- **Throughput**: Data processed per second

#### Infrastructure Metrics
- **CPU Usage**: Per container
- **Memory Usage**: Per container
- **Database Connections**: Active connections
- **Cache Hit Rate**: Redis hit percentage

#### Business Metrics
- **Active Users**: Current online users
- **Task Completion Rate**: Tasks completed vs created
- **Workflow Execution Rate**: Workflows per hour
- **Agent Execution Cost**: LLM API costs

### Alerting Rules

| Alert | Threshold | Severity | Action |
|-------|-----------|----------|--------|
| High Error Rate | >1% for 5 min | Critical | Page on-call |
| High Latency | P95 >2s for 10 min | Warning | Investigate |
| Database Connections | >80% for 5 min | Warning | Scale database |
| Memory Usage | >90% for 5 min | Critical | Scale containers |
| Task Queue Backlog | >1000 for 15 min | Warning | Scale workers |
| Failed Workflows | >10% for 10 min | Warning | Check logs |

### Dashboards

- **Operations Dashboard**: System health overview
- **Application Dashboard**: Application metrics
- **Database Dashboard**: Database performance
- **Cost Dashboard**: Infrastructure costs

Access dashboards at: `https://grafana.forge-factory.com`

## Incident Response

### Severity Levels

| Severity | Definition | Response Time | Escalation |
|----------|------------|---------------|------------|
| **SEV-1** | Complete outage | Immediate | Page on-call + CTO |
| **SEV-2** | Major degradation | 15 minutes | Page on-call |
| **SEV-3** | Minor degradation | 1 hour | Slack notification |
| **SEV-4** | Cosmetic issue | Next business day | Create ticket |

### Incident Response Process

1. **Detect**: Alert triggers or issue reported
2. **Triage**: Assess severity and impact
3. **Communicate**: Update status page and stakeholders
4. **Mitigate**: Apply temporary fix if possible
5. **Resolve**: Implement permanent solution
6. **Review**: Conduct post-mortem

### On-Call Rotation

- **Primary**: First responder (5 min response time)
- **Secondary**: Backup (15 min response time)
- **Manager**: Escalation point

### Communication Channels

- **Status Page**: https://status.forge-factory.com
- **Incident Slack**: #incidents
- **Customer Support**: support@forge-factory.com

## Runbooks

Runbooks are step-by-step procedures for common operational tasks:

### Available Runbooks

- [Database Failover](./runbooks/database-failover.md)
- [Scale API Containers](./runbooks/scale-api-containers.md)
- [Clear Redis Cache](./runbooks/clear-redis-cache.md)
- [Restart WebSocket Servers](./runbooks/restart-websocket-servers.md)
- [Database Backup & Restore](./runbooks/database-backup-restore.md)
- [Certificate Renewal](./runbooks/certificate-renewal.md)
- [User Data Export](./runbooks/user-data-export.md)

### Runbook Template

Create new runbooks using this template:

```markdown
# Runbook: [Task Name]

**Purpose**: What this runbook does
**When to use**: Scenarios where this applies
**Frequency**: How often this is typically run
**Duration**: Estimated time to complete
**Risk Level**: Low | Medium | High

## Prerequisites

- Access required
- Tools needed
- Backup/snapshot taken

## Procedure

### Step 1: [Action]
```bash
# Commands
```
**Expected result**: What should happen

### Step 2: [Action]
...

## Verification

How to verify the procedure succeeded:
- [ ] Check 1
- [ ] Check 2

## Rollback

If something goes wrong:
1. ...

## Post-execution

- [ ] Update logs
- [ ] Notify team
- [ ] Document any issues
```

## Maintenance

### Regular Maintenance Tasks

| Task | Frequency | Owner | Runbook |
|------|-----------|-------|---------|
| Database vacuum | Weekly | DBA | [Link](./runbooks/) |
| Log rotation | Daily | Auto | - |
| Certificate renewal | 90 days | DevOps | [Link](./runbooks/) |
| Backup verification | Weekly | DevOps | [Link](./runbooks/) |
| Security patching | Monthly | DevOps | [Link](./runbooks/) |
| Cost review | Monthly | Manager | - |

### Maintenance Windows

**Scheduled Maintenance**: Every 2nd Sunday, 2-4 AM UTC
- Database maintenance
- Security patches
- Infrastructure updates

**Emergency Maintenance**: As needed with 1-hour notice

## Disaster Recovery

### Backup Strategy

- **Database**: Daily full backups, 5-minute WAL archiving
- **Files**: Continuous S3 replication
- **Configs**: Git-based, version controlled

### Recovery Time Objectives (RTO/RPO)

| Service | RTO | RPO |
|---------|-----|-----|
| Database | 1 hour | 5 minutes |
| API | 30 minutes | 0 (stateless) |
| Files | 1 hour | 1 hour |

### Disaster Scenarios

- [Database Corruption](./runbooks/disaster-database.md)
- [Region Outage](./runbooks/disaster-region.md)
- [Security Breach](./runbooks/disaster-security.md)

## Security Operations

### Security Monitoring

- **Intrusion Detection**: AWS GuardDuty
- **Vulnerability Scanning**: Snyk, Semgrep
- **Log Analysis**: CloudWatch Logs Insights
- **Audit Logs**: Exported to S3, retained 7 years

### Security Incident Response

1. **Contain**: Isolate affected systems
2. **Investigate**: Determine scope and impact
3. **Remediate**: Patch vulnerabilities
4. **Notify**: Inform affected parties
5. **Review**: Update security procedures

See [SECURITY.md](../../SECURITY.md) for security policy.

## Cost Management

### Cost Optimization Checklist

- [ ] Review and remove unused resources
- [ ] Right-size over-provisioned instances
- [ ] Enable auto-scaling
- [ ] Use reserved instances for steady workloads
- [ ] Implement data lifecycle policies
- [ ] Monitor LLM API costs

### Cost Alerts

- **Budget Alert**: >80% of monthly budget
- **Anomaly Alert**: >50% increase day-over-day
- **Per-feature Alert**: Individual services over threshold

## Related Documentation

- [Architecture Overview](../02-architecture/architecture.md)
- [Development Guide](../04-development/README.md)
- [Security & Compliance](../02-architecture/security-compliance.md)
- [Infrastructure Code](../../tools/terraform/)

## Emergency Contacts

- **On-Call Engineer**: [PagerDuty rotation]
- **CTO**: [Contact info]
- **AWS Support**: [Support plan]
- **Database DBA**: [Contact info]

---

**Last Updated**: January 2024
**On-Call Rotation**: Week of Jan 22-28, 2024
