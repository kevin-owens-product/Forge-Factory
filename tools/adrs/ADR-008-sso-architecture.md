# ADR-008: Single Sign-On (SSO) Architecture

## Status
Accepted

## Context
Enterprise customers require SSO integration with their identity providers (IdP) for:
- Centralized user management
- Enforced security policies
- Compliance requirements
- Simplified user onboarding/offboarding
- Multi-factor authentication (MFA)
- Directory synchronization

We need to support:
- SAML 2.0 (most common in enterprises)
- SCIM 2.0 (for user provisioning)
- Multiple identity providers (Okta, Azure AD, Google Workspace, OneLogin)

## Decision
We will implement **SAML 2.0 for authentication** and **SCIM 2.0 for user provisioning**, leveraging Auth0 as our authentication provider with custom SCIM endpoints.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│         Identity Provider (IdP)                       │
│  • Okta                                              │
│  • Azure AD                                          │
│  • Google Workspace                                  │
│  • OneLogin                                          │
└───────────────┬──────────────────────────────────────┘
                │
                │ (1) SAML Assertion
                ▼
┌──────────────────────────────────────────────────────┐
│                 Auth0                                 │
│  • SAML Identity Provider                            │
│  • Session Management                                │
│  • Token Generation                                  │
└───────────────┬──────────────────────────────────────┘
                │
                │ (2) JWT Token
                ▼
┌──────────────────────────────────────────────────────┐
│            Forge Factory API                          │
│  • Validate JWT                                      │
│  • Check tenant SSO config                           │
│  • Create/update user (JIT provisioning)             │
└──────────────────────────────────────────────────────┘
```

## SAML 2.0 Implementation

### Configuration Model
```typescript
interface SamlConfig {
  tenantId: TenantId;
  enabled: boolean;

  // Identity Provider Configuration
  idpEntityId: string;           // e.g., "http://www.okta.com/exk..."
  idpSsoUrl: string;              // e.g., "https://company.okta.com/app/..."
  idpCertificate: string;         // X.509 certificate (PEM format)

  // Service Provider Configuration
  spEntityId: string;             // e.g., "https://forge.io/saml/tenant123"
  spAcsUrl: string;               // Assertion Consumer Service URL

  // Attribute Mapping
  attributeMapping: {
    email: string;                // e.g., "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
    firstName: string;            // e.g., "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname"
    lastName: string;             // e.g., "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname"
    groups?: string;              // e.g., "http://schemas.xmlsoap.org/claims/Group"
  };

  // Settings
  defaultRoleId: RoleId;          // Role assigned to new users
  jitProvisioning: boolean;       // Just-In-Time user creation
  forceSso: boolean;              // Require SSO (disable email/password)
  signRequests: boolean;          // Sign SAML requests

  // Audit
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date;
}
```

### SAML Flow

#### 1. SP-Initiated Login
```
User → App → Auth0 → IdP → Auth0 → App
```

```typescript
// User clicks "Sign in with SSO"
GET /api/v1/sso/saml/initiate?email=user@company.com

// 1. Lookup tenant by email domain
const tenant = await getTenantByEmailDomain('company.com');

// 2. Check if SSO is enabled
if (!tenant.ssoConfig.enabled) {
  throw new Error('SSO not configured');
}

// 3. Redirect to Auth0 SAML connection
return redirect(`https://auth0.forge.io/samlp/${tenant.id}`);

// 4. Auth0 redirects to IdP with SAML Request
// 5. User authenticates at IdP
// 6. IdP sends SAML Assertion back to Auth0
// 7. Auth0 validates assertion, creates JWT
// 8. Auth0 redirects to callback with JWT
GET /api/v1/sso/saml/callback?token=...
```

#### 2. IdP-Initiated Login
```
User → IdP → App
```

```typescript
// User logs into IdP, clicks Forge Factory app
// IdP sends SAML Assertion directly to SP ACS URL

POST /api/v1/sso/saml/acs
Content-Type: application/x-www-form-urlencoded

SAMLResponse=...

// 1. Validate SAML assertion
const assertion = await validateSamlAssertion(samlResponse);

// 2. Extract user attributes
const userAttributes = extractAttributes(assertion);

// 3. Find or create user (JIT provisioning)
const user = await findOrCreateUser(userAttributes);

// 4. Create session
const session = await createSession(user.id);

// 5. Redirect to app
return redirect(`https://app.forge.io?session=${session.id}`);
```

### Just-In-Time (JIT) Provisioning

```typescript
async function findOrCreateUser(
  tenantId: TenantId,
  samlAttributes: SamlAttributes,
  config: SamlConfig
): Promise<User> {
  const email = samlAttributes[config.attributeMapping.email];

  // Try to find existing user
  let user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user && config.jitProvisioning) {
    // Create new user
    user = await prisma.user.create({
      data: {
        email,
        firstName: samlAttributes[config.attributeMapping.firstName],
        lastName: samlAttributes[config.attributeMapping.lastName],
        tenantId,
        roleId: config.defaultRoleId,
        ssoProvider: 'saml',
        emailVerified: true, // Trust IdP verification
      }
    });

    // Audit log
    await auditLog.create({
      tenantId,
      action: 'user.created',
      details: { method: 'saml_jit', email },
    });
  } else if (!user) {
    throw new Error('User not found and JIT provisioning disabled');
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });

  return user;
}
```

## SCIM 2.0 Implementation

### Purpose
Automate user provisioning and deprovisioning from IdP.

### Endpoints
```typescript
// Users
GET    /scim/v2/Users              // List users
POST   /scim/v2/Users              // Create user
GET    /scim/v2/Users/:id          // Get user
PATCH  /scim/v2/Users/:id          // Update user
DELETE /scim/v2/Users/:id          // Deactivate user

// Groups
GET    /scim/v2/Groups             // List groups
POST   /scim/v2/Groups             // Create group
GET    /scim/v2/Groups/:id         // Get group
PATCH  /scim/v2/Groups/:id         // Update group members
DELETE /scim/v2/Groups/:id         // Delete group

// Service Provider Config
GET    /scim/v2/ServiceProviderConfig
GET    /scim/v2/Schemas
GET    /scim/v2/ResourceTypes
```

### SCIM User Resource
```json
{
  "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
  "id": "user_abc123",
  "externalId": "okta_user_xyz",
  "userName": "john.doe@company.com",
  "name": {
    "formatted": "John Doe",
    "familyName": "Doe",
    "givenName": "John"
  },
  "emails": [
    {
      "value": "john.doe@company.com",
      "type": "work",
      "primary": true
    }
  ],
  "active": true,
  "groups": [
    {
      "value": "group_admin",
      "display": "Administrators"
    }
  ],
  "meta": {
    "resourceType": "User",
    "created": "2024-01-15T10:00:00Z",
    "lastModified": "2024-01-16T14:30:00Z"
  }
}
```

### SCIM Implementation
```typescript
// POST /scim/v2/Users
async function createScimUser(req: ScimRequest): Promise<ScimResponse> {
  const { userName, name, emails, groups } = req.body;

  // 1. Validate bearer token
  const tenantId = await validateScimToken(req.headers.authorization);

  // 2. Create user
  const user = await prisma.user.create({
    data: {
      email: userName,
      firstName: name.givenName,
      lastName: name.familyName,
      tenantId,
      ssoProvider: 'scim',
      emailVerified: true,
    }
  });

  // 3. Assign to groups (map to roles)
  for (const group of groups || []) {
    const role = await mapGroupToRole(tenantId, group.value);
    await assignRole(user.id, role.id);
  }

  // 4. Return SCIM response
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    id: user.id,
    userName: user.email,
    name: {
      givenName: user.firstName,
      familyName: user.lastName,
    },
    active: true,
    meta: {
      resourceType: 'User',
      created: user.createdAt.toISOString(),
    }
  };
}

// PATCH /scim/v2/Users/:id (for deactivation)
async function updateScimUser(id: string, operations: ScimOperation[]): Promise<ScimResponse> {
  for (const op of operations) {
    if (op.op === 'replace' && op.path === 'active') {
      await prisma.user.update({
        where: { id },
        data: {
          active: op.value,
          deactivatedAt: op.value === false ? new Date() : null
        }
      });
    }
  }

  // Return updated user
  return getScimUser(id);
}
```

### Group-to-Role Mapping
```typescript
interface GroupRoleMapping {
  tenantId: TenantId;
  idpGroupName: string;
  roleId: RoleId;
}

// Example mappings
const mappings: GroupRoleMapping[] = [
  { tenantId, idpGroupName: 'Administrators', roleId: 'admin' },
  { tenantId, idpGroupName: 'Developers', roleId: 'member' },
  { tenantId, idpGroupName: 'Viewers', roleId: 'viewer' },
];

async function mapGroupToRole(tenantId: TenantId, groupName: string): Promise<Role> {
  const mapping = await prisma.groupRoleMapping.findFirst({
    where: { tenantId, idpGroupName: groupName }
  });

  return mapping
    ? await getRole(mapping.roleId)
    : await getRole(config.defaultRoleId);
}
```

## Directory Sync

### Scheduled Sync
```typescript
// Nightly sync job
@Cron('0 2 * * *')  // 2 AM daily
async function syncDirectories() {
  const tenantsWithScim = await prisma.samlConfig.findMany({
    where: { scimEnabled: true }
  });

  for (const config of tenantsWithScim) {
    try {
      await syncTenantDirectory(config.tenantId);
    } catch (error) {
      logger.error('Directory sync failed', { tenantId: config.tenantId, error });
    }
  }
}

async function syncTenantDirectory(tenantId: TenantId) {
  // 1. Fetch users from SCIM endpoint
  const scimUsers = await fetchScimUsers(tenantId);

  // 2. Compare with local users
  const localUsers = await prisma.user.findMany({ where: { tenantId } });

  // 3. Create missing users
  // 4. Deactivate users not in IdP
  // 5. Update changed users
  // 6. Log sync results
}
```

## SSO Configuration UI

### Tenant SSO Setup
```typescript
// Admin UI: SSO Configuration Page
function SsoConfigForm({ tenantId }: { tenantId: TenantId }) {
  const [config, setConfig] = useState<SamlConfig>();

  return (
    <form onSubmit={handleSubmit}>
      <h2>SAML Configuration</h2>

      {/* Provider Selection */}
      <Select
        label="Identity Provider"
        options={['Okta', 'Azure AD', 'Google Workspace', 'OneLogin', 'Custom']}
        onChange={handleProviderChange}
      />

      {/* IdP Metadata */}
      <FileUpload
        label="IdP Metadata XML"
        accept=".xml"
        onUpload={handleMetadataUpload}
      />

      {/* Or manual configuration */}
      <Input label="IdP Entity ID" {...register('idpEntityId')} />
      <Input label="IdP SSO URL" {...register('idpSsoUrl')} />
      <TextArea label="IdP Certificate" {...register('idpCertificate')} />

      {/* Attribute Mapping */}
      <Input label="Email Attribute" {...register('attributeMapping.email')} />
      <Input label="First Name Attribute" {...register('attributeMapping.firstName')} />

      {/* Settings */}
      <Checkbox label="Enable Just-In-Time Provisioning" {...register('jitProvisioning')} />
      <Checkbox label="Force SSO (disable email/password login)" {...register('forceSso')} />

      {/* Test Connection */}
      <Button onClick={handleTest}>Test SAML Connection</Button>

      <Button type="submit">Save Configuration</Button>
    </form>
  );
}
```

### Testing SSO
```typescript
async function testSamlConnection(tenantId: TenantId): Promise<TestResult> {
  const config = await getSamlConfig(tenantId);

  // 1. Validate certificate
  const certValid = validateCertificate(config.idpCertificate);

  // 2. Test SSO URL reachability
  const urlReachable = await testUrl(config.idpSsoUrl);

  // 3. Attempt test login (requires test user at IdP)
  // 4. Validate SAML assertion

  return {
    success: certValid && urlReachable,
    errors: [],
    warnings: [],
  };
}
```

## Security Considerations

### 1. Certificate Validation
```typescript
// Validate IdP certificate
function validateCertificate(certPem: string): boolean {
  const cert = new X509Certificate(certPem);

  // Check expiration
  if (cert.validTo < new Date()) {
    throw new Error('Certificate expired');
  }

  // Check signature algorithm (reject weak algorithms)
  if (cert.signatureAlgorithm === 'sha1WithRSAEncryption') {
    throw new Error('Weak signature algorithm');
  }

  return true;
}
```

### 2. Assertion Validation
```typescript
// Validate SAML assertion
async function validateSamlAssertion(samlResponse: string): Promise<SamlAssertion> {
  const assertion = parseSamlResponse(samlResponse);

  // 1. Check signature
  if (!verifySignature(assertion, config.idpCertificate)) {
    throw new Error('Invalid signature');
  }

  // 2. Check audience
  if (assertion.audience !== config.spEntityId) {
    throw new Error('Invalid audience');
  }

  // 3. Check NotBefore / NotOnOrAfter
  const now = Date.now();
  if (now < assertion.notBefore || now > assertion.notOnOrAfter) {
    throw new Error('Assertion expired');
  }

  // 4. Check replay (store assertion ID)
  if (await isAssertionUsed(assertion.id)) {
    throw new Error('Assertion replay detected');
  }

  return assertion;
}
```

### 3. SCIM Authentication
```typescript
// Generate SCIM bearer token
async function generateScimToken(tenantId: TenantId): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');

  await prisma.scimToken.create({
    data: {
      token: await hash(token),
      tenantId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 365 * 86400000), // 1 year
    }
  });

  return token;
}

// Validate SCIM bearer token
async function validateScimToken(authHeader: string): Promise<TenantId> {
  const token = authHeader.replace('Bearer ', '');

  const scimToken = await prisma.scimToken.findFirst({
    where: {
      token: await hash(token),
      expiresAt: { gt: new Date() }
    }
  });

  if (!scimToken) {
    throw new UnauthorizedException('Invalid SCIM token');
  }

  return scimToken.tenantId;
}
```

## Monitoring & Alerts

### Metrics
```typescript
// Prometheus metrics
saml_login_attempts_total{tenant_id, status}
saml_login_duration_seconds{tenant_id}
scim_requests_total{tenant_id, operation, status}
sso_certificate_expiry_days{tenant_id}
```

### Alerts
```yaml
- alert: SamlLoginFailures
  expr: rate(saml_login_attempts_total{status="failed"}[5m]) > 0.1
  annotations:
    summary: High SAML login failure rate for {{ $labels.tenant_id }}

- alert: SsoCertificateExpiring
  expr: sso_certificate_expiry_days < 30
  annotations:
    summary: SSO certificate expiring in {{ $value }} days for {{ $labels.tenant_id }}
```

## Consequences

### Positive
- **Enterprise-ready**: Meets enterprise security requirements
- **Simplified onboarding**: Automatic user provisioning
- **Centralized management**: IT controls access
- **Compliance**: Audit trail, enforced policies
- **Security**: MFA enforced at IdP

### Negative
- **Complexity**: More integration points
- **Support burden**: Debugging SSO issues
- **Dependency**: Relies on IdP availability
- **Configuration overhead**: Setup per tenant

### Mitigations
- **Documentation**: Detailed setup guides per IdP
- **Testing tools**: SAML debugger, test connection
- **Monitoring**: Track SSO health per tenant
- **Fallback**: Allow admin override to disable SSO

## Alternatives Considered

### 1. OIDC (OpenID Connect)
**Rejected**: Less common in enterprises than SAML
- May add later for specific IdPs

### 2. LDAP Integration
**Rejected**: Too complex, security risks, legacy

### 3. Custom SSO Protocol
**Rejected**: No standard, interoperability issues

## Future Enhancements

### 1. Social SSO
Add OAuth for GitHub, GitLab:
```typescript
{ provider: 'github', clientId, clientSecret }
```

### 2. Multi-IdP Support
Allow multiple IdPs per tenant:
```typescript
{ idps: [okta, azureAD] }
```

### 3. SAML Attributes → Custom Fields
Map SAML attributes to custom user fields:
```typescript
{ customMapping: { department: 'http://...' } }
```

## References
- [SAML 2.0 Specification](https://docs.oasis-open.org/security/saml/v2.0/)
- [SCIM 2.0 Specification](https://datatracker.ietf.org/doc/html/rfc7644)
- [Auth0 SAML](https://auth0.com/docs/authenticate/protocols/saml)

## Review Date
2024-04-16 (3 months)
