# ADR-001: Vertical Slice Architecture

## Status
Accepted

## Context
We need to choose an architecture that allows for rapid, predictable feature development while maintaining code quality and avoiding merge conflicts in a multi-developer environment.

## Decision
We will use Vertical Slice Architecture where each feature is implemented as a complete, self-contained slice from database to UI.

### What is a Vertical Slice?
A vertical slice contains everything needed for one feature:
- Database schema (Prisma model)
- API endpoints (NestJS controller + service)
- UI components (React)
- Admin UI (React-Admin)
- Tests (unit + integration + e2e)
- Documentation
- Translations (i18n)

### File Structure
```
apps/api/src/modules/organization-management/
├── organization.controller.ts    # REST endpoints
├── organization.service.ts       # Business logic
├── organization.module.ts        # NestJS module
├── dto/                          # Request/response types
├── tests/                        # Unit + integration tests
└── docs/                         # Feature documentation

apps/portal/src/features/organizations/
├── components/                   # UI components
├── hooks/                        # React hooks
├── pages/                        # Page components
└── tests/                        # Component tests

packages/prisma/schema.prisma
└── Organization model            # Database schema
```

### Slice Delivery
Each slice is delivered in a single PR that includes:
1. ✅ Database migration
2. ✅ API endpoints with tests
3. ✅ UI components with tests
4. ✅ Admin UI (if applicable)
5. ✅ Documentation
6. ✅ Translations

## Consequences

### Positive
- **Fast feature delivery**: Everything for one feature in one PR
- **Fewer merge conflicts**: Different developers work on different slices
- **Easy to understand**: All code for a feature is together
- **Testable**: Complete feature can be tested end-to-end
- **Parallelizable**: Multiple slices can be developed simultaneously

### Negative
- **Potential duplication**: Shared code must be actively extracted to packages
- **Learning curve**: Developers used to horizontal layers need to adjust

### Mitigations
- Use NX generators to scaffold slices with best practices
- Regular refactoring to extract patterns into shared packages
- Code review process to catch duplication early

## Alternatives Considered

### 1. Layered Architecture
Build all database → all API → all UI sequentially.
**Rejected**: Slow feedback, high merge conflict risk, delayed testing.

### 2. Microservices
Each feature is a separate service.
**Rejected**: Too much operational overhead for initial launch. We plan for service extraction later, not immediately.

## References
- [Vertical Slice Architecture by Jimmy Bogard](https://www.jimmybogard.com/vertical-slice-architecture/)
- [Feature Slices for Redux](https://redux.js.org/style-guide/#structure-files-as-feature-folders-or-ducks)

## Review Date
2024-04-16 (3 months)
