# ADR-002: API Strategy (REST + tRPC Hybrid)

## Status
Accepted

## Context
We need to choose an API strategy that balances:
- **Developer experience** for internal consumers (Portal, Admin)
- **Interoperability** for external integrations
- **Type safety** across the stack
- **Documentation** requirements
- **Performance** and bandwidth efficiency

Our application has two distinct consumer groups:
1. **Internal clients**: Portal and Admin SPAs we control
2. **External clients**: Third-party integrations, API consumers, webhooks

## Decision
We will use a **hybrid API strategy**:

### Internal Consumers → tRPC
For Portal and Admin applications:
- **Technology**: tRPC with React Query
- **Transport**: HTTP POST to `/api/trpc`
- **Type Safety**: End-to-end TypeScript inference
- **No code generation**: Types automatically shared

### External Consumers → REST
For third-party integrations:
- **Technology**: NestJS REST controllers
- **Standard**: OpenAPI 3.1 specification
- **Documentation**: Auto-generated via `@nestjs/swagger`
- **Versioning**: URL-based (`/api/v1/`, `/api/v2/`)

### Real-time → WebSocket
For live updates:
- **Technology**: Socket.io with Redis adapter
- **Use cases**: Notifications, presence, live dashboards
- **Fallback**: Long polling

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    API Gateway                           │
│                   (NestJS + tRPC)                        │
└─────────────────────┬───────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
   ┌────────┐   ┌─────────┐   ┌──────────┐
   │ tRPC   │   │  REST   │   │WebSocket │
   │Router  │   │ Routes  │   │ Gateway  │
   └────────┘   └─────────┘   └──────────┘
        │             │             │
        └─────────────┼─────────────┘
                      ▼
             ┌─────────────────┐
             │ Business Logic  │
             │   (Services)    │
             └─────────────────┘
```

## Implementation Details

### tRPC Router Structure
```typescript
// apps/api/src/trpc/router.ts
import { router } from './trpc';
import { organizationRouter } from '../modules/organization/organization.router';
import { userRouter } from '../modules/user/user.router';

export const appRouter = router({
  organization: organizationRouter,
  user: userRouter,
  // ... other routers
});

export type AppRouter = typeof appRouter;
```

### Client Usage
```typescript
// apps/portal/src/lib/trpc.ts
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@forge/api';

export const trpc = createTRPCReact<AppRouter>();

// Usage in components
function OrganizationList() {
  const { data, isLoading } = trpc.organization.list.useQuery();
  const createOrg = trpc.organization.create.useMutation();

  // Fully type-safe, no codegen needed
}
```

### REST Controller (External)
```typescript
// apps/api/src/modules/organization/organization.controller.ts
@ApiTags('organizations')
@Controller('api/v1/organizations')
export class OrganizationController {
  @Get()
  @ApiOperation({ summary: 'List organizations' })
  @ApiResponse({ status: 200, type: [OrganizationDto] })
  async list(): Promise<OrganizationDto[]> {
    return this.organizationService.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create organization' })
  @ApiResponse({ status: 201, type: OrganizationDto })
  async create(@Body() dto: CreateOrganizationDto): Promise<OrganizationDto> {
    return this.organizationService.create(dto);
  }
}
```

### Shared Business Logic
Both tRPC and REST call the same service layer:
```typescript
// apps/api/src/modules/organization/organization.service.ts
@Injectable()
export class OrganizationService {
  async list(ctx: RequestContext): Promise<Organization[]> {
    // Tenant isolation automatically applied
    return this.prisma.organization.findMany({
      where: { tenantId: ctx.tenantId }
    });
  }

  async create(ctx: RequestContext, dto: CreateOrganizationDto): Promise<Organization> {
    // Shared logic used by both tRPC and REST
    return this.prisma.organization.create({
      data: {
        ...dto,
        tenantId: ctx.tenantId,
        createdBy: ctx.userId
      }
    });
  }
}
```

## API Capabilities Comparison

| Feature | tRPC | REST | WebSocket |
|---------|------|------|-----------|
| **Type Safety** | ✅ Full | ⚠️ Codegen needed | ⚠️ Manual types |
| **Auto-completion** | ✅ Yes | ❌ No | ❌ No |
| **Documentation** | ⚠️ Manual | ✅ Auto (OpenAPI) | ⚠️ Manual |
| **External use** | ❌ TypeScript only | ✅ Any language | ✅ Any language |
| **Batching** | ✅ Built-in | ❌ Manual | N/A |
| **Real-time** | ❌ No | ❌ No | ✅ Yes |
| **Caching** | ✅ React Query | ✅ HTTP cache | ⚠️ Manual |
| **File uploads** | ⚠️ Limited | ✅ Full support | ✅ Full support |

## Authentication

### tRPC
Middleware checks JWT and injects context:
```typescript
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});
```

### REST
NestJS guards handle auth:
```typescript
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('api/v1/organizations')
export class OrganizationController {
  // All routes protected
}
```

## Error Handling

### tRPC Errors
```typescript
import { TRPCError } from '@trpc/server';

throw new TRPCError({
  code: 'NOT_FOUND',
  message: 'Organization not found',
  cause: error,
});
```

### REST Errors
```typescript
throw new NotFoundException({
  error: {
    code: 'ORGANIZATION_NOT_FOUND',
    message: 'Organization not found',
    details: { organizationId },
  },
});
```

## Versioning Strategy

### tRPC
- Version by breaking router into v1, v2 namespaces
- Keep old routers for backwards compatibility
```typescript
export const appRouter = router({
  v1: v1Router,
  v2: v2Router,
});
```

### REST
- URL-based versioning: `/api/v1/`, `/api/v2/`
- Deprecation headers:
```typescript
@ApiDeprecated()
@Header('X-API-Deprecated', 'true')
@Header('X-API-Sunset', '2025-12-31')
```

## Rate Limiting

Both tRPC and REST share rate limiting:
```typescript
@RateLimitGuard({ points: 100, duration: 60 })
```

Implemented at API Gateway level using Redis.

## Consequences

### Positive
- **Best of both worlds**: Type safety for internal, interoperability for external
- **Developer productivity**: tRPC eliminates boilerplate and sync issues
- **Single codebase**: Shared business logic, no duplication
- **Performance**: tRPC batching reduces requests
- **Documentation**: OpenAPI for external consumers
- **Flexibility**: Can add GraphQL later if needed

### Negative
- **Two API styles**: Team must understand both
- **Complexity**: More moving parts than pure REST or pure GraphQL
- **tRPC limitations**: Not suitable for external consumers (TypeScript-only)
- **Potential drift**: Must ensure both APIs stay in sync

### Mitigations
- **Shared service layer**: All logic in services, APIs are thin wrappers
- **CI checks**: Ensure OpenAPI spec doesn't have breaking changes
- **Documentation**: Clear guidelines on when to use each
- **Code generation**: Auto-generate REST clients for testing

## Alternatives Considered

### 1. Pure REST
**Rejected**:
- Requires code generation or manual types
- More boilerplate
- No batching
- Slower development for internal clients

### 2. Pure GraphQL
**Rejected**:
- Higher learning curve
- N+1 query problem
- Overfetching control comes with complexity
- tRPC provides better DX for our use case

### 3. Pure tRPC
**Rejected**:
- Not suitable for external integrations
- Requires TypeScript on client
- Harder to document for non-technical users

### 4. gRPC
**Considered** for internal service-to-service:
- May add later for microservices
- Not suitable for browser clients
- More appropriate when we extract services

## Migration Path

### Phase 1 (Current)
- tRPC for Portal and Admin
- REST for external API
- Shared service layer

### Phase 2 (Future)
When we extract microservices:
- Add gRPC for service-to-service
- Keep tRPC for internal clients
- Keep REST for external clients

```
Portal/Admin → tRPC → API Gateway
                           ↓
External → REST → API Gateway → gRPC → Microservices
                           ↓
                        Services
```

## Testing Strategy

### tRPC
```typescript
// Integration test
const caller = appRouter.createCaller(mockContext);
const result = await caller.organization.list();
expect(result).toHaveLength(3);
```

### REST
```typescript
// E2E test
const response = await request(app.getHttpServer())
  .get('/api/v1/organizations')
  .set('Authorization', `Bearer ${token}`);
expect(response.status).toBe(200);
```

## Documentation

### tRPC
- JSDoc comments on procedures
- Type information via IDE
- Example requests in Storybook

### REST
- OpenAPI 3.1 spec at `/api/docs`
- Swagger UI for interactive testing
- Postman collection generation

## References
- [tRPC Documentation](https://trpc.io)
- [NestJS OpenAPI](https://docs.nestjs.com/openapi/introduction)
- [API Design Patterns](https://swagger.io/resources/articles/best-practices-in-api-design/)
- [tRPC vs GraphQL](https://trpc.io/docs/comparison)

## Review Date
2024-04-16 (3 months)
