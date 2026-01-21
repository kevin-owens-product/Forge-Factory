# Development Guide

Welcome to the Forge Factory development guide! This directory contains everything you need to set up your development environment and contribute to the project.

## Quick Start

### Prerequisites

- **Node.js**: 22+ LTS
- **pnpm**: 9.0+
- **PostgreSQL**: 16+
- **Redis**: 7+
- **Git**: Latest version

### Setup

```bash
# Clone the repository
git clone https://github.com/kevin-owens-product/Forge-Factory.git
cd Forge-Factory

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Set up database
pnpm db:setup

# Run development servers
pnpm dev
```

## Development Workflow

### 1. Create a Feature Branch

```bash
# Always branch from main
git checkout main
git pull origin main

# Create feature branch
git checkout -b feat/your-feature-name
```

### 2. Follow Vertical Slice Architecture

Each feature should include:
- ✅ Database schema (Prisma models)
- ✅ API endpoints (NestJS controllers + services)
- ✅ UI components (React)
- ✅ Tests (unit + integration + E2E)
- ✅ Documentation

See [ADR-001](../02-architecture/decisions/ADR-001-vertical-slice-architecture.md) for details.

### 3. Write Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run E2E tests
pnpm test:e2e

# Check test coverage
pnpm test:coverage
```

**Minimum 80% test coverage required**

### 4. Lint and Format

```bash
# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format
```

### 5. Commit Changes

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Commit format
git commit -m "<type>(<scope>): <description>"

# Examples
git commit -m "feat(tasks): add kanban board component"
git commit -m "fix(api): resolve tenant isolation bug"
git commit -m "docs(adr): add workflow engine architecture decision"
git commit -m "test(workflows): add integration tests for BullMQ"
```

**Commit Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes

### 6. Push and Create PR

```bash
# Push to your branch
git push origin feat/your-feature-name

# Create pull request on GitHub
```

## Project Structure

```
Forge-Factory/
├── apps/
│   ├── api/              # NestJS backend
│   ├── portal/           # Customer-facing React app
│   └── admin/            # Admin dashboard
├── packages/
│   ├── prisma/           # Database schema
│   ├── shared-types/     # Shared TypeScript types
│   ├── ui/               # Shared UI components
│   └── ...               # Other shared packages
├── docs/                 # All documentation
├── tools/                # Tools and scripts
└── ...
```

## Key Technologies

### Backend
- **Framework**: NestJS 10.3+
- **ORM**: Prisma
- **Database**: PostgreSQL 16+
- **Cache**: Redis 7+
- **Queue**: BullMQ
- **Testing**: Vitest, Supertest

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **UI Library**: React 18+
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui (Radix UI)
- **State**: TanStack Query, Zustand
- **Forms**: React Hook Form + Zod
- **Testing**: Vitest, Testing Library, Playwright

### Infrastructure
- **Hosting**: AWS (ECS, RDS, CloudFront)
- **IaC**: Terraform
- **CI/CD**: GitHub Actions
- **Monitoring**: Sentry, Prometheus, Grafana

## Code Quality Standards

### TypeScript

- Use TypeScript strict mode
- Provide proper types (no `any` unless absolutely necessary)
- Use type inference where possible
- Document complex types

```typescript
// Good
interface Task {
  id: string;
  title: string;
  status: TaskStatus;
}

// Bad
const task: any = { ... };
```

### React Components

- Use functional components with hooks
- Implement proper prop types
- Use `'use client'` directive for client components
- Keep components focused and small

```tsx
// Good
'use client';

interface TaskCardProps {
  task: Task;
  onUpdate: (task: Task) => void;
}

export function TaskCard({ task, onUpdate }: TaskCardProps) {
  // ...
}
```

### API Endpoints

- Use proper HTTP methods
- Implement input validation (DTOs with class-validator)
- Handle errors appropriately
- Add Swagger documentation

```typescript
@Controller('tasks')
export class TasksController {
  @Post()
  @ApiOperation({ summary: 'Create task' })
  async createTask(@Body() dto: CreateTaskDto) {
    // ...
  }
}
```

## Environment Variables

Required environment variables:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/forge"
DATABASE_DIRECT_URL="postgresql://user:password@localhost:5432/forge"

# Redis
REDIS_HOST="localhost"
REDIS_PORT="6379"

# Authentication
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# API Keys
ANTHROPIC_API_KEY="sk-..."
OPENAI_API_KEY="sk-..."

# GitHub
GITHUB_CLIENT_ID="..."
GITHUB_CLIENT_SECRET="..."
```

## Common Commands

```bash
# Development
pnpm dev                  # Start all apps in dev mode
pnpm dev:api              # Start API only
pnpm dev:portal           # Start portal only

# Building
pnpm build                # Build all apps
pnpm build:api            # Build API only
pnpm build:portal         # Build portal only

# Database
pnpm db:migrate           # Run migrations
pnpm db:seed              # Seed database
pnpm db:studio            # Open Prisma Studio
pnpm db:reset             # Reset database

# Code Quality
pnpm lint                 # Lint all code
pnpm lint:fix             # Fix linting issues
pnpm format               # Format code
pnpm typecheck            # Type checking

# Testing
pnpm test                 # Run all tests
pnpm test:unit            # Unit tests only
pnpm test:integration     # Integration tests only
pnpm test:e2e             # E2E tests only
pnpm test:coverage        # Generate coverage report

# Verification (runs all checks)
pnpm verify               # Lint + Typecheck + Test
```

## Debugging

### Backend (NestJS)

```bash
# Debug API in VS Code
# Add this to .vscode/launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Debug API",
  "runtimeExecutable": "pnpm",
  "runtimeArgs": ["dev:api:debug"],
  "port": 9229
}
```

### Frontend (Next.js)

```bash
# Debug portal in VS Code
{
  "type": "node",
  "request": "launch",
  "name": "Debug Portal",
  "runtimeExecutable": "pnpm",
  "runtimeArgs": ["dev:portal"],
  "port": 9229,
  "serverReadyAction": {
    "pattern": "ready on",
    "uriFormat": "http://localhost:3000",
    "action": "openExternally"
  }
}
```

## AI-Assisted Development

See [CLAUDE.md](../../CLAUDE.md) for AI development conventions:

- All AI-generated code must include `@prompt-id` comments
- Minimum 80% test coverage required
- Human review required before merging
- Track AI generation metrics

## Getting Help

- **Questions**: Open a discussion on GitHub
- **Bugs**: Create an issue with reproducible steps
- **Features**: Propose in discussions first
- **Urgent**: Contact team leads

## Related Documentation

- [Architecture Overview](../02-architecture/architecture.md)
- [ADRs](../02-architecture/decisions/README.md)
- [Feature Specs](../03-features/README.md)
- [Operations Guide](../05-operations/README.md)

---

**Last Updated**: January 2024
