# Developer Onboarding Guide

**Welcome to Forge Factory!** This guide will get you from zero to your first commit in < 4 hours.

## Prerequisites

- **Node.js**: 20.x LTS
- **Go**: 1.21+
- **Docker**: 24.x+
- **PostgreSQL**: 16
- **Redis**: 7.x
- **Git**: 2.x

## Quick Start (30 minutes)

### 1. Clone Repository
```bash
git clone https://github.com/forge-factory/forge.git
cd forge
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Services (Docker Compose)
```bash
docker-compose up -d
# Starts: PostgreSQL, Redis, S3 (LocalStack), PgBouncer
```

### 4. Setup Database
```bash
cp .env.example .env
npm run db:migrate
npm run db:seed  # Adds test data
```

### 5. Start Development Servers
```bash
# Terminal 1: API
npm run dev:api

# Terminal 2: Portal (User App)
npm run dev:portal

# Terminal 3: Admin Portal
npm run dev:admin
```

### 6. Open in Browser
- Portal: http://localhost:3000
- Admin: http://localhost:3001
- API: http://localhost:4000
- API Docs: http://localhost:4000/docs

## Project Structure

```
/apps/
  api/                 # Fastify backend
  portal/              # Next.js user app
  admin/               # Next.js admin app
  docs/                # Nextra documentation

/packages/
  ui/                  # shadcn/ui components
  auth/                # Auth0 integration
  api-client/          # Type-safe API client

/tools/
  adrs/                # Architecture Decision Records
  terraform/           # Infrastructure as Code
  
/workers/
  analysis-worker/     # Background job processors
```

## Tech Stack

**Frontend**: Next.js 14.2+, React 19, TypeScript, Tailwind, shadcn/ui
**Backend**: Fastify 4.x, TypeScript, Prisma
**Database**: PostgreSQL 16, Redis 7
**Auth**: Auth0
**Queue**: BullMQ
**Monitoring**: Datadog

## Development Workflow

### Making Changes

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/add-awesome-feature
   ```

2. **Make Changes**
   - Follow TypeScript strict mode
   - Write tests (80% coverage required)
   - Update documentation

3. **Run Tests**
   ```bash
   npm run test
   npm run test:e2e
   npm run lint
   npm run type-check
   ```

4. **Commit Changes** (Conventional Commits)
   ```bash
   git commit -m "feat: add awesome feature"
   # Format: type(scope): description
   # Types: feat, fix, docs, refactor, test, chore
   ```

5. **Push and Create PR**
   ```bash
   git push -u origin feature/add-awesome-feature
   # Create PR on GitHub
   ```

### Code Review Checklist

- [ ] Tests pass (CI/CD)
- [ ] Code coverage ≥ 80%
- [ ] No TypeScript errors
- [ ] ESLint passes
- [ ] Documentation updated
- [ ] ADR created (if architectural change)

## Debugging

### Backend (API)
```bash
# VS Code launch.json already configured
# Press F5 to start debugging
```

### Frontend (Next.js)
```bash
# Chrome DevTools
# React DevTools extension
# Network tab for API calls
```

### Database
```bash
# Prisma Studio (GUI)
npx prisma studio

# Or psql
psql postgresql://forge:forge_dev@localhost:5432/forge
```

## Common Tasks

### Add New API Endpoint
1. Create route in `/apps/api/src/features/{feature}/routes.ts`
2. Add handler in `handlers.ts`
3. Update OpenAPI spec in `/tools/openapi/`
4. Generate SDK: `npm run generate:sdk`
5. Write tests

### Add New UI Component
1. Use shadcn/ui: `npx shadcn-ui@latest add {component}`
2. Customize in `/packages/ui/components/`
3. Document in Storybook
4. Write tests

### Run Database Migration
```bash
# Create migration
npx prisma migrate dev --name add_new_table

# Apply in production
npx prisma migrate deploy
```

## Getting Help

- **Documentation**: `/docs` or https://docs.forgefactory.dev
- **Slack**: #engineering channel
- **Issues**: GitHub Issues
- **ADRs**: `/tools/adrs/` for architectural decisions

## Next Steps

1. ✅ Complete this onboarding
2. 📖 Read ADRs (start with ADR-001, ADR-010, ADR-011)
3. 🐛 Pick a "good first issue" from GitHub
4. 💬 Introduce yourself in #engineering Slack
5. 🚀 Ship your first PR!

---

**Questions?** Ask in #engineering or DM your onboarding buddy!

**Version**: 1.0
**Last Updated**: 2026-01-20
