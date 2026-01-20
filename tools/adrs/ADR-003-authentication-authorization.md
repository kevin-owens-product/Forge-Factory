# ADR-003: Authentication & Authorization Strategy

## Status
Accepted

## Context

Forge Factory requires enterprise-grade authentication and authorization to support:
- **Multiple Auth Methods**: Email/password, OAuth, SAML 2.0, LDAP
- **Multi-Factor Authentication**: TOTP, SMS, WebAuthn for security
- **Role-Based Access Control**: 4 roles + custom enterprise roles
- **Multi-Tenancy**: Users belong to multiple organizations
- **API Authentication**: JWT tokens, API keys, OAuth 2.0
- **Session Management**: Single sign-out, device tracking
- **Compliance**: SOC 2, ISO 27001, GDPR requirements

### Requirements
- Support 100K+ users
- < 100ms authentication latency (P95)
- 99.99% uptime for auth service
- SAML 2.0 for enterprise customers
- MFA enforcement policies
- Audit trail for all auth events

## Decision

Use **Auth0** as the identity provider with the following architecture:

### 1. **Auth0** for Identity Management
### 2. **JWT Tokens** for API Authentication
### 3. **Custom RBAC** with Auth0 Organizations
### 4. **API Keys** for Server-to-Server
### 5. **Fastify JWT Plugin** for Token Validation

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Authentication Flow                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  User (Browser)                                              │
│       │                                                       │
│       │ 1. Click "Sign In"                                   │
│       ▼                                                       │
│  Next.js App                                                 │
│       │                                                       │
│       │ 2. Redirect to Auth0 Universal Login                │
│       ▼                                                       │
│  Auth0 (https://forge-factory.us.auth0.com)                 │
│       │                                                       │
│       │ 3. User enters credentials                           │
│       │ 4. MFA challenge (if enabled)                        │
│       │ 5. SAML/OAuth (if enterprise)                        │
│       │                                                       │
│       │ 6. Return to callback URL with authorization code    │
│       ▼                                                       │
│  Next.js API Route (/api/auth/callback)                     │
│       │                                                       │
│       │ 7. Exchange code for tokens (access + refresh)      │
│       │ 8. Store in httpOnly secure cookie                   │
│       │ 9. Create/update user in database                    │
│       │                                                       │
│       │ 10. Redirect to /dashboard                           │
│       ▼                                                       │
│  Protected Route                                             │
│       │                                                       │
│       │ 11. Extract JWT from cookie                          │
│       │ 12. Validate JWT signature                           │
│       │ 13. Check permissions (RBAC)                         │
│       │ 14. Fetch user from DB (cache with React Query)     │
│       │                                                       │
│       ▼                                                       │
│  Render Dashboard                                            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Detailed Implementation

### 1. Auth0 Configuration

**Tenant**: `forge-factory.us.auth0.com`

**Applications**:
- **Web App** (Next.js SPA): Regular Web Application
- **Mobile App** (Future): Native
- **API** (Backend): API (identifier: `https://api.forgefactory.dev`)

**Connections**:
```
Email/Password: Username-Password-Authentication (default)
Google OAuth: google-oauth2
GitHub OAuth: github
Microsoft AD: Active Directory (enterprise)
SAML: Custom SAML connections per enterprise customer
```

**Organizations** (Multi-Tenancy):
```typescript
// Auth0 Organization = Forge Factory Tenant
organization_id: org_xyz
organization_name: "Acme Corp"
organization_metadata: {
  tier: "enterprise",
  features: ["saml", "custom_roles", "audit_logs"]
}
```

**Roles** (Defined in Auth0):
```
owner:      Full access to organization
admin:      All permissions except billing/deletion
member:     Read/write repositories, create analyses
viewer:     Read-only access
```

**Permissions** (Auth0 API Permissions):
```
read:repositories
write:repositories
delete:repositories
read:analyses
write:analyses
read:users
write:users
delete:users
read:billing
write:billing
read:audit_logs
```

### 2. JWT Token Structure

**Access Token** (15-minute expiration):
```json
{
  "iss": "https://forge-factory.us.auth0.com/",
  "sub": "auth0|user_1a2b3c",
  "aud": ["https://api.forgefactory.dev"],
  "exp": 1706634900,
  "iat": 1706634000,
  "scope": "openid profile email offline_access",
  "azp": "client_abc123",
  "org_id": "org_xyz",
  "permissions": [
    "read:repositories",
    "write:repositories",
    "read:analyses",
    "write:analyses"
  ],
  "https://forgefactory.dev/roles": ["member"],
  "https://forgefactory.dev/email": "[email protected]",
  "https://forgefactory.dev/email_verified": true
}
```

**Refresh Token** (30-day expiration):
- Opaque token stored in httpOnly cookie
- Used to obtain new access token when expired
- Rotated on each use (refresh token rotation)

### 3. Frontend Implementation (Next.js)

**Auth0 SDK**:
```typescript
// lib/auth0.ts
import { Auth0Client } from '@auth0/auth0-spa-js'

export const auth0 = new Auth0Client({
  domain: process.env.NEXT_PUBLIC_AUTH0_DOMAIN!,
  clientId: process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID!,
  authorizationParams: {
    redirect_uri: `${window.location.origin}/api/auth/callback`,
    audience: 'https://api.forgefactory.dev',
    scope: 'openid profile email offline_access',
  },
  cacheLocation: 'memory', // Don't store in localStorage (security)
  useRefreshTokens: true,
})
```

**Login Flow**:
```typescript
// app/(auth)/login/page.tsx
'use client'

export default function LoginPage() {
  const handleLogin = async () => {
    await auth0.loginWithRedirect({
      appState: {
        returnTo: '/dashboard',
      },
    })
  }

  return <Button onClick={handleLogin}>Sign In</Button>
}

// app/api/auth/callback/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  if (!code) {
    return NextResponse.redirect('/login?error=missing_code')
  }

  // Exchange authorization code for tokens
  const tokens = await auth0.getTokens({ code })

  // Decode JWT to get user info
  const user = decodeJwt(tokens.access_token)

  // Create or update user in database
  await db.user.upsert({
    where: { auth0Id: user.sub },
    create: {
      auth0Id: user.sub,
      email: user.email,
      name: user.name,
      emailVerified: user.email_verified,
    },
    update: {
      lastLoginAt: new Date(),
    },
  })

  // Store tokens in secure httpOnly cookie
  const response = NextResponse.redirect('/dashboard')
  response.cookies.set('access_token', tokens.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60, // 15 minutes
  })
  response.cookies.set('refresh_token', tokens.refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  })

  return response
}
```

**Protected Routes**:
```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyJwt } from './lib/jwt'

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const payload = await verifyJwt(token)

    // Add user info to request headers (for server components)
    const response = NextResponse.next()
    response.headers.set('x-user-id', payload.sub)
    response.headers.set('x-org-id', payload.org_id)

    return response
  } catch (error) {
    // Token expired or invalid, try to refresh
    const refreshToken = request.cookies.get('refresh_token')?.value

    if (refreshToken) {
      try {
        const newTokens = await refreshAccessToken(refreshToken)

        const response = NextResponse.next()
        response.cookies.set('access_token', newTokens.access_token, {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 15 * 60,
        })

        return response
      } catch {
        return NextResponse.redirect(new URL('/login', request.url))
      }
    }

    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/repos/:path*', '/settings/:path*'],
}
```

### 4. Backend Implementation (Fastify)

**JWT Validation Plugin**:
```typescript
// apps/api/src/plugins/auth.ts
import fp from 'fastify-plugin'
import fjwt from '@fastify/jwt'

export default fp(async (fastify) => {
  fastify.register(fjwt, {
    secret: {
      // Auth0 public key for RS256 verification
      public: await fetchAuth0PublicKey(),
    },
    verify: {
      algorithms: ['RS256'],
      audience: 'https://api.forgefactory.dev',
      issuer: 'https://forge-factory.us.auth0.com/',
    },
  })

  fastify.decorate('authenticate', async (request, reply) => {
    try {
      await request.jwtVerify()

      // Load user from database
      const user = await db.user.findUnique({
        where: { auth0Id: request.user.sub },
        include: { organizations: true },
      })

      if (!user) {
        return reply.code(401).send({ error: 'User not found' })
      }

      request.user = user
    } catch (err) {
      return reply.code(401).send({ error: 'Invalid token' })
    }
  })
})

// Fetch Auth0 public key (JWKS)
async function fetchAuth0PublicKey() {
  const response = await fetch(
    'https://forge-factory.us.auth0.com/.well-known/jwks.json'
  )
  const jwks = await response.json()
  return convertJWKToPEM(jwks.keys[0])
}
```

**Protected Route**:
```typescript
// apps/api/src/features/repositories/routes.ts
import { FastifyPluginAsync } from 'fastify'
import { requirePermission } from '@/plugins/rbac'

const repositoriesRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/repositories - List repositories
  fastify.get(
    '/',
    {
      onRequest: [
        fastify.authenticate,
        requirePermission('read:repositories'),
      ],
    },
    async (request, reply) => {
      const { user } = request

      const repos = await db.repository.findMany({
        where: {
          organizationId: user.currentOrganizationId,
        },
      })

      return { data: repos }
    }
  )

  // POST /api/v1/repositories - Create repository
  fastify.post(
    '/',
    {
      onRequest: [
        fastify.authenticate,
        requirePermission('write:repositories'),
      ],
    },
    async (request, reply) => {
      // ...
    }
  )
}

export default repositoriesRoutes
```

### 5. RBAC Implementation

**Permission Check**:
```typescript
// apps/api/src/plugins/rbac.ts
import { FastifyRequest, FastifyReply } from 'fastify'

export function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const { user } = request

    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    // Check if user has permission (from JWT)
    const permissions = user.permissions || []

    if (!permissions.includes(permission)) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: `Missing required permission: ${permission}`,
      })
    }
  }
}

// Role-based check
export function requireRole(role: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const { user } = request

    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const roles = user.roles || []

    if (!roles.includes(role)) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: `Missing required role: ${role}`,
      })
    }
  }
}
```

### 6. API Key Authentication

**For Server-to-Server** (CI/CD, scripts, integrations):

**Generate API Key**:
```typescript
// apps/api/src/features/api-keys/service.ts
import crypto from 'crypto'
import bcrypt from 'bcrypt'

export async function createApiKey(userId: string, name: string) {
  // Generate random API key
  const key = `ff_${crypto.randomBytes(32).toString('hex')}` // ff_abc123...

  // Hash for storage (bcrypt)
  const hashedKey = await bcrypt.hash(key, 12)

  // Store in database
  const apiKey = await db.apiKey.create({
    data: {
      userId,
      name,
      keyHash: hashedKey,
      keyPrefix: key.slice(0, 10), // ff_abc123 (for UI display)
      lastUsedAt: null,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
    },
  })

  // Return plaintext key ONCE (never stored)
  return { apiKey, key }
}

export async function validateApiKey(key: string): Promise<User | null> {
  // Find API key by prefix (fast lookup)
  const prefix = key.slice(0, 10)
  const apiKeys = await db.apiKey.findMany({
    where: { keyPrefix: prefix },
    include: { user: true },
  })

  // Check each matching key (bcrypt comparison)
  for (const apiKey of apiKeys) {
    const isValid = await bcrypt.compare(key, apiKey.keyHash)

    if (isValid) {
      // Update last used timestamp
      await db.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      })

      return apiKey.user
    }
  }

  return null
}
```

**Validate API Key in Route**:
```typescript
// apps/api/src/plugins/api-key-auth.ts
export async function authenticateApiKey(request: FastifyRequest, reply: FastifyReply) {
  const apiKey = request.headers['x-api-key']

  if (!apiKey || typeof apiKey !== 'string') {
    return reply.code(401).send({ error: 'Missing API key' })
  }

  const user = await validateApiKey(apiKey)

  if (!user) {
    return reply.code(401).send({ error: 'Invalid API key' })
  }

  request.user = user
}
```

### 7. Multi-Factor Authentication

**Enforced via Auth0**:
```typescript
// Auth0 Dashboard → Security → Multi-factor Auth
// Enable: SMS, Authenticator App (TOTP), WebAuthn

// Enforce MFA per organization
{
  "organization_metadata": {
    "require_mfa": true
  }
}

// Auth0 Rule (custom enforcement)
function (user, context, callback) {
  const org = context.organization

  if (org && org.metadata && org.metadata.require_mfa) {
    if (!context.authentication || !context.authentication.methods ||
        !context.authentication.methods.find(m => m.name === 'mfa')) {
      return callback(new UnauthorizedError('MFA is required for this organization'))
    }
  }

  return callback(null, user, context)
}
```

### 8. Session Management

**Single Sign-Out**:
```typescript
// app/api/auth/logout/route.ts
export async function GET(request: Request) {
  const returnTo = `${process.env.NEXT_PUBLIC_BASE_URL}/login`

  // Clear cookies
  const response = NextResponse.redirect(returnTo)
  response.cookies.delete('access_token')
  response.cookies.delete('refresh_token')

  // Redirect to Auth0 logout (clears Auth0 session)
  const logoutUrl = `https://forge-factory.us.auth0.com/v2/logout?returnTo=${encodeURIComponent(returnTo)}&client_id=${process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID}`

  return NextResponse.redirect(logoutUrl)
}
```

**Device Tracking**:
```typescript
// Track active sessions
await db.session.create({
  data: {
    userId: user.id,
    deviceInfo: request.headers['user-agent'],
    ipAddress: request.ip,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  },
})

// Sign out from all devices
await db.session.deleteMany({
  where: { userId: user.id },
})
```

## Consequences

### Positive
- **Enterprise-Ready**: SAML, MFA, custom roles out-of-box
- **Security**: Auth0 handles security patches, threat detection
- **Compliance**: SOC 2, ISO 27001, GDPR compliant
- **Scalability**: Auth0 scales to millions of users
- **Developer Experience**: Universal Login reduces attack surface

### Negative
- **Cost**: $240-$800/month for Auth0 (vs. free for custom)
- **Vendor Lock-In**: Migrating off Auth0 is complex
- **Latency**: Auth0 adds ~50ms to auth flow (acceptable)

### Mitigations
- **Cost**: Start with Essentials ($240/month), upgrade as needed
- **Lock-In**: Export user data monthly (GDPR compliance), use standard OIDC
- **Latency**: Cache user data in Redis, validate JWT locally (no Auth0 call)

## Alternatives Considered

**Clerk**: Great DX, but lacks SAML 2.0 (critical for enterprise)
**AWS Cognito**: Cheap, but complex UX and limited customization
**Custom**: 6-12 months to build, ongoing maintenance, security risk

## References
- [Auth0 Documentation](https://auth0.com/docs)
- [Fastify JWT Plugin](https://github.com/fastify/fastify-jwt)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-20
