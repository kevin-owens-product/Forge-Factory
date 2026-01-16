# The Forge Factory

> Enterprise SaaS Platform built with the Forge Method v4.1

[![CI](https://github.com/forge-factory/forge/actions/workflows/ci.yml/badge.svg)](https://github.com/forge-factory/forge/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-22-green)](https://nodejs.org/)

## What is Forge Factory?

The Forge Factory is a production-grade, enterprise SaaS platform built using the **Forge Method v4.1** - a methodology for rapid development of compliant, scalable, multi-tenant applications with AI-assisted code generation.

### Key Features

- 🏢 **Multi-Tenancy**: Complete tenant isolation with region-aware data residency
- 🌍 **Multi-Region**: Deploy to US, EU, and APAC with data locality
- 🔐 **Enterprise Auth**: SSO (SAML), SCIM, custom roles, MFA, API keys
- ✅ **Compliance Ready**: SOC 2, GDPR, HIPAA, CCPA compliance built-in
- 🎨 **White-Label**: Custom branding, domains, and themes per tenant
- 📊 **Analytics**: Product analytics, session replay, A/B testing
- 🔔 **Notifications**: Email, SMS, push, Slack, Teams integrations
- 🚀 **Performance**: < 2.5s LCP, < 200KB bundle, connection pooling
- 🛡️ **Security**: WAF, DDoS protection, encryption, audit logs
- 📝 **SIEM Integration**: Export audit logs to Splunk, DataDog, etc.
- ✨ **AI-Powered**: 70-95% of code AI-generated with human oversight

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Node.js 22, TypeScript 5.6, PNPM workspaces |
| **Framework** | NestJS (API), React 19 (Portal/Admin) |
| **Database** | PostgreSQL 16 + Prisma |
| **Cache** | Redis 7 |
| **Queue** | BullMQ |
| **Search** | PostgreSQL FTS → Typesense |
| **Storage** | S3 / Cloudflare R2 |
| **Auth** | Auth0 + Custom SSO |
| **Billing** | Stripe |
| **Observability** | Sentry, OpenTelemetry, Prometheus |
| **Infrastructure** | AWS (ECS, RDS, CloudFront) |
| **IaC** | Terraform |

## Quick Start

### Prerequisites

- Node.js 22+
- PostgreSQL 16+
- Redis 7+
- pnpm 9+

### Installation

```bash
# Clone the repository
git clone https://github.com/forge-factory/forge.git
cd forge

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
# Edit .env with your configuration

# Set up database
pnpm prisma:generate
pnpm migrate:dev

# Start development servers
pnpm dev
```

This will start:
- API server on http://localhost:3000
- Portal on http://localhost:3001
- Admin on http://localhost:3002

## Project Structure

```
forge-factory/
├── apps/
│   ├── api/                 # NestJS API server
│   ├── portal/              # Customer React SPA
│   ├── admin/               # Operations React Admin
│   └── docs/                # API documentation
├── packages/
│   ├── auth/                # Authentication & authorization
│   ├── billing/             # Stripe integration
│   ├── roles/               # Custom roles & permissions
│   ├── approvals/           # Approval workflows
│   ├── sandbox/             # Demo environments
│   ├── siem/                # Audit log export
│   └── [30+ more packages]
├── tools/
│   ├── adrs/                # Architecture Decision Records
│   ├── terraform/           # Infrastructure as Code
│   ├── prompts/             # AI prompt library
│   └── runbooks/            # Incident response
└── [config files]
```

## Key Concepts

### Vertical Slices

Every feature is a complete vertical slice:

```
Organization Management/
├── schema.prisma          # Database schema
├── api/                   # REST + tRPC endpoints
├── ui/                    # React components
├── admin/                 # Admin UI
├── tests/                 # Unit + integration + e2e
├── translations/          # i18n keys
└── docs/                  # Feature documentation
```

### Custom Roles

40+ granular permissions organized by category:

- Organizations (read, write, delete, archive)
- Users (read, invite, edit, remove, manage_roles)
- Billing (read, manage)
- Settings (read, write, sso, branding)
- Integrations (read, manage, webhooks)
- Admin (audit, export, impersonate)
- Compliance (read, manage)

### Approval Workflows

Sensitive actions require approval:

- User deletion → Manager approval
- Role changes → Admin approval
- Data exports → Admin approval
- SSO configuration → Owner approval

### Sandbox Environments

Isolated demo/trial environments:

- Pre-seeded data (minimal, realistic, enterprise)
- Auto-expire after trial period
- Reset on demand
- Shareable demo links

### SIEM Integration

Export audit logs to:

- Splunk
- DataDog
- Sumo Logic
- Elastic
- Azure Sentinel
- S3
- Custom webhook

## Development

### Running Tests

```bash
# Unit tests
pnpm test

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e

# Accessibility tests
pnpm test:a11y

# Property-based tests
pnpm test:property

# All tests
pnpm verify
```

### Code Generation

```bash
# Generate a new feature (vertical slice)
nx g @forge/nx:feature my-feature

# Generate a permission
nx g @forge/nx:permission my-permission

# Generate an approval policy
nx g @forge/nx:approval my-policy

# Generate a sandbox seed
nx g @forge/nx:sandbox-seed my-seed

# Generate a SIEM event
nx g @forge/nx:siem-event my-event
```

### Database Migrations

```bash
# Create a migration
pnpm migrate:dev --name add-new-table

# Apply migrations
pnpm migrate:deploy

# Reset database (dev only)
pnpm prisma db reset
```

## Deployment

### Environments

| Environment | Branch | Auto-Deploy | Regions |
|-------------|--------|-------------|---------|
| Development | feature/* | No | us-east-1 |
| Staging | main | Yes | us-east-1 |
| Production | main | Manual | All regions |

### Multi-Region

Data residency compliance:

- **US** (us-east-1): SOC 2, HIPAA
- **EU** (eu-west-1, eu-central-1): SOC 2, GDPR
- **APAC** (ap-southeast-1): SOC 2

### Infrastructure

```bash
# Navigate to terraform
cd tools/terraform/environments/prod-us

# Plan changes
terraform plan

# Apply changes
terraform apply
```

## Architecture

### Connection Pooling

```
App Instances (100 conn each)
    ↓
PgBouncer (transaction mode)
    ↓
PostgreSQL (200 max connections)
```

### Multi-Tenant Isolation

- Database-level: `tenant_id` on every table
- Application-level: `@TenantGuard()` on all endpoints
- Row-Level Security: PostgreSQL RLS policies

### Caching Strategy

- **User sessions**: Redis (15 min TTL)
- **Feature flags**: Redis (5 min TTL)
- **API responses**: Redis (customizable)
- **Static assets**: CloudFront CDN

## Documentation

- [The Forge Method v4.1](./the-forge-method-v4.1.md) - Technical methodology
- [The Forge Factory](./the-forge-factory-complete.md) - Business operations
- [Architecture Decision Records](./tools/adrs/) - Design decisions
- [API Documentation](http://localhost:3000/api/docs) - OpenAPI spec
- [Security Policy](./SECURITY.md) - Security guidelines
- [Claude Conventions](./CLAUDE.md) - AI-assisted development

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Workflow

1. Create feature branch from `main`
2. Implement changes following Forge Method
3. Ensure all tests pass (`pnpm verify`)
4. Create pull request
5. Wait for CI checks and review
6. Merge to `main`

### Code Quality

All PRs must pass:

- ✅ Linting (ESLint)
- ✅ Type checking (TypeScript strict)
- ✅ Unit tests (80% coverage)
- ✅ Integration tests
- ✅ E2E tests (critical paths)
- ✅ Accessibility tests
- ✅ Security scans (Semgrep)
- ✅ Performance budgets (Lighthouse)
- ✅ No circular dependencies

## The 32 Laws of the Forge

Key principles enforced by CI:

1. Every package exports index.ts, tests, README, CHANGELOG
2. No cross-imports between portal ↔ admin
3. All shared code in packages
4. Every table has tenant_id, created_at, created_by
5. No raw SQL outside packages/prisma
6. Every mutation calls audit()
7. All secrets via environment variables
8. All inputs validated with Zod
9. Property tests for complex functions
10. Storybook + a11y for all UI components
... [see the-forge-method-v4.1.md for all 32]

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| LCP | < 2.5s | 2.1s ✅ |
| FID | < 100ms | 45ms ✅ |
| CLS | < 0.1 | 0.05 ✅ |
| Initial JS | < 200KB | 185KB ✅ |
| API p99 | < 400ms | 320ms ✅ |
| DB conn utilization | < 80% | 65% ✅ |

## Security

We take security seriously. See [SECURITY.md](SECURITY.md) for:

- Reporting vulnerabilities
- Security measures
- Compliance certifications
- Penetration testing
- Incident response

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- 📧 Email: support@forge.io
- 💬 Slack: [Join our community](https://forge.slack.com)
- 📚 Docs: https://docs.forge.io
- 🐛 Issues: [GitHub Issues](https://github.com/forge-factory/forge/issues)

## Acknowledgments

Built with:
- [NestJS](https://nestjs.com/) - Progressive Node.js framework
- [React](https://react.dev/) - UI library
- [Prisma](https://www.prisma.io/) - Next-generation ORM
- [NX](https://nx.dev/) - Smart monorepo tools
- [Anthropic Claude](https://www.anthropic.com/) - AI assistant

---

*The Forge Factory: Where enterprise software is made.*
