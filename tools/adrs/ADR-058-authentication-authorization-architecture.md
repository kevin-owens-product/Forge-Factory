# ADR-058: Authentication & Authorization Architecture

**Status:** Accepted
**Date:** 2026-01-21
**Priority:** P1 - Enterprise Ready
**Complexity:** High

---

## Context

Enterprise customers require robust authentication and authorization supporting SSO/SAML, MFA, fine-grained permissions, and integration with identity providers. Security is paramount for a platform handling source code.

### Business Requirements

- **Authentication Methods:** Email/password, SSO (SAML, OIDC), Social login
- **MFA:** TOTP, SMS, Hardware keys (WebAuthn)
- **SSO Providers:** Okta, Azure AD, Google Workspace, OneLogin
- **Authorization:** Role-based (RBAC) + Attribute-based (ABAC)
- **Session Management:** Secure sessions, token refresh, revocation
- **Compliance:** SOC 2, HIPAA, GDPR requirements

### Authentication Requirements

| Method | Priority | Use Case |
|--------|----------|----------|
| Email/Password | P0 | Self-service signup |
| Google OAuth | P0 | Developer convenience |
| GitHub OAuth | P0 | Developer convenience |
| SAML 2.0 | P0 | Enterprise SSO |
| OIDC | P1 | Modern SSO |
| LDAP | P2 | Legacy enterprise |

### Authorization Requirements

| Level | Description | Example |
|-------|-------------|---------|
| Organization | Org-wide permissions | Billing admin |
| Project | Project-level access | Project editor |
| Resource | Specific resource access | Repository read |
| Action | Fine-grained actions | Deploy production |

---

## Decision

We will implement a **comprehensive identity and access management system** with:

1. **Authentication Service** - Multi-method authentication
2. **Authorization Service** - RBAC + ABAC hybrid
3. **Session Management** - Secure token handling
4. **SSO Integration** - Enterprise identity providers
5. **MFA Service** - Multi-factor authentication

### Architecture Overview

```typescript
interface AuthenticationSystem {
  // Authentication
  authenticate(credentials: Credentials): Promise<AuthResult>;
  verifyMFA(userId: string, code: string): Promise<MFAResult>;

  // Session management
  createSession(user: User): Promise<Session>;
  validateSession(token: string): Promise<SessionValidation>;
  revokeSession(sessionId: string): Promise<void>;

  // SSO
  initiateSSOLogin(provider: SSOProvider): Promise<SSOInitiation>;
  completeSSOLogin(response: SSOResponse): Promise<AuthResult>;
}

interface AuthorizationSystem {
  // Permission checking
  checkPermission(context: AuthContext, permission: Permission): Promise<boolean>;
  checkPermissions(context: AuthContext, permissions: Permission[]): Promise<PermissionResult[]>;

  // Role management
  assignRole(userId: string, role: Role, scope: Scope): Promise<void>;
  revokeRole(userId: string, role: Role, scope: Scope): Promise<void>;

  // Policy management
  evaluatePolicy(context: AuthContext, policy: Policy): Promise<PolicyResult>;
}

interface AuthContext {
  user: User;
  session: Session;
  organization: Organization;
  project?: Project;
  resource?: Resource;
  environment: Environment;
  requestMetadata: RequestMetadata;
}

interface Permission {
  action: string;           // e.g., "project:deploy"
  resource: string;         // e.g., "project:123"
  conditions?: Condition[];
}
```

### Component 1: Authentication Service

Support multiple authentication methods.

```typescript
class AuthenticationService {
  constructor(
    private userStore: UserStore,
    private passwordService: PasswordService,
    private mfaService: MFAService,
    private sessionService: SessionService,
    private auditLogger: AuditLogger
  ) {}

  async authenticate(credentials: Credentials): Promise<AuthResult> {
    switch (credentials.type) {
      case 'password':
        return this.authenticateWithPassword(credentials);
      case 'oauth':
        return this.authenticateWithOAuth(credentials);
      case 'saml':
        return this.authenticateWithSAML(credentials);
      case 'api_key':
        return this.authenticateWithAPIKey(credentials);
      default:
        throw new AuthenticationError('Unknown credential type');
    }
  }

  private async authenticateWithPassword(
    credentials: PasswordCredentials
  ): Promise<AuthResult> {
    // Find user
    const user = await this.userStore.findByEmail(credentials.email);
    if (!user) {
      await this.auditLogger.log({
        action: 'auth.login',
        outcome: 'failure',
        details: { reason: 'user_not_found', email: credentials.email },
      });
      throw new AuthenticationError('Invalid credentials');
    }

    // Check account status
    if (user.status === 'locked') {
      throw new AuthenticationError('Account is locked');
    }

    // Verify password
    const passwordValid = await this.passwordService.verify(
      credentials.password,
      user.passwordHash
    );

    if (!passwordValid) {
      await this.handleFailedLogin(user);
      throw new AuthenticationError('Invalid credentials');
    }

    // Check if MFA required
    if (user.mfaEnabled) {
      return {
        status: 'mfa_required',
        userId: user.id,
        mfaToken: await this.mfaService.createChallenge(user.id),
      };
    }

    // Create session
    const session = await this.sessionService.create(user);

    await this.auditLogger.log({
      action: 'auth.login',
      outcome: 'success',
      actorId: user.id,
    });

    return {
      status: 'authenticated',
      user: this.sanitizeUser(user),
      session,
    };
  }

  private async handleFailedLogin(user: User): Promise<void> {
    // Increment failed attempts
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    user.lastFailedLogin = new Date();

    // Lock account after 5 failed attempts
    if (user.failedLoginAttempts >= 5) {
      user.status = 'locked';
      user.lockedAt = new Date();

      await this.auditLogger.log({
        action: 'auth.account_locked',
        actorId: user.id,
        details: { reason: 'too_many_failed_attempts' },
      });
    }

    await this.userStore.update(user);

    await this.auditLogger.log({
      action: 'auth.login',
      outcome: 'failure',
      actorId: user.id,
      details: { reason: 'invalid_password', attempts: user.failedLoginAttempts },
    });
  }

  async verifyMFA(userId: string, code: string, mfaToken: string): Promise<AuthResult> {
    // Validate MFA token
    const challenge = await this.mfaService.validateChallenge(mfaToken);
    if (!challenge || challenge.userId !== userId) {
      throw new AuthenticationError('Invalid MFA session');
    }

    // Verify MFA code
    const user = await this.userStore.findById(userId);
    const mfaValid = await this.mfaService.verify(user, code);

    if (!mfaValid) {
      await this.auditLogger.log({
        action: 'auth.mfa_failed',
        actorId: userId,
      });
      throw new AuthenticationError('Invalid MFA code');
    }

    // Create session
    const session = await this.sessionService.create(user);

    await this.auditLogger.log({
      action: 'auth.mfa_verified',
      outcome: 'success',
      actorId: userId,
    });

    return {
      status: 'authenticated',
      user: this.sanitizeUser(user),
      session,
    };
  }
}

class PasswordService {
  private readonly SALT_ROUNDS = 12;
  private readonly MIN_PASSWORD_LENGTH = 12;

  async hash(password: string): Promise<string> {
    this.validatePasswordStrength(password);
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  validatePasswordStrength(password: string): void {
    const errors: string[] = [];

    if (password.length < this.MIN_PASSWORD_LENGTH) {
      errors.push(`Password must be at least ${this.MIN_PASSWORD_LENGTH} characters`);
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain number');
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      errors.push('Password must contain special character');
    }

    // Check against common passwords
    if (this.isCommonPassword(password)) {
      errors.push('Password is too common');
    }

    if (errors.length > 0) {
      throw new ValidationError('Password does not meet requirements', errors);
    }
  }
}
```

### Component 2: Authorization Service

RBAC + ABAC hybrid authorization.

```typescript
class AuthorizationService {
  constructor(
    private roleStore: RoleStore,
    private policyEngine: PolicyEngine,
    private permissionCache: PermissionCache
  ) {}

  async checkPermission(
    context: AuthContext,
    permission: Permission
  ): Promise<boolean> {
    // Check cache first
    const cacheKey = this.generateCacheKey(context, permission);
    const cached = await this.permissionCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    // Get user's roles
    const roles = await this.getUserRoles(context.user.id, permission.resource);

    // Check RBAC permissions
    const rbacResult = await this.checkRBACPermission(roles, permission);
    if (rbacResult.denied) {
      await this.permissionCache.set(cacheKey, false);
      return false;
    }

    if (rbacResult.allowed) {
      // Check ABAC policies
      const abacResult = await this.checkABACPolicies(context, permission);
      const finalResult = abacResult.allowed && !abacResult.denied;

      await this.permissionCache.set(cacheKey, finalResult);
      return finalResult;
    }

    await this.permissionCache.set(cacheKey, false);
    return false;
  }

  private async checkRBACPermission(
    roles: Role[],
    permission: Permission
  ): Promise<RBACResult> {
    for (const role of roles) {
      const rolePermissions = await this.roleStore.getPermissions(role.id);

      for (const rp of rolePermissions) {
        if (this.permissionMatches(rp, permission)) {
          return { allowed: true, role };
        }
      }
    }

    return { allowed: false };
  }

  private async checkABACPolicies(
    context: AuthContext,
    permission: Permission
  ): Promise<ABACResult> {
    // Get applicable policies
    const policies = await this.policyEngine.getApplicablePolicies(
      context,
      permission
    );

    let allowed = false;
    let denied = false;

    for (const policy of policies) {
      const result = await this.policyEngine.evaluate(policy, context, permission);

      if (result.effect === 'deny') {
        denied = true;
        break; // Deny takes precedence
      }

      if (result.effect === 'allow') {
        allowed = true;
      }
    }

    return { allowed, denied };
  }

  private permissionMatches(rolePermission: RolePermission, requested: Permission): boolean {
    // Check action match (supports wildcards)
    if (!this.matchPattern(rolePermission.action, requested.action)) {
      return false;
    }

    // Check resource match (supports wildcards)
    if (!this.matchPattern(rolePermission.resource, requested.resource)) {
      return false;
    }

    return true;
  }

  private matchPattern(pattern: string, value: string): boolean {
    // Convert glob pattern to regex
    const regex = new RegExp(
      '^' +
      pattern
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.')
      + '$'
    );

    return regex.test(value);
  }
}

class PolicyEngine {
  async evaluate(
    policy: Policy,
    context: AuthContext,
    permission: Permission
  ): Promise<PolicyResult> {
    // Check all conditions
    for (const condition of policy.conditions) {
      const conditionMet = await this.evaluateCondition(condition, context, permission);
      if (!conditionMet) {
        return { effect: 'not_applicable', policy };
      }
    }

    return { effect: policy.effect, policy };
  }

  private async evaluateCondition(
    condition: PolicyCondition,
    context: AuthContext,
    permission: Permission
  ): Promise<boolean> {
    const value = this.resolveValue(condition.attribute, context, permission);

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;

      case 'not_equals':
        return value !== condition.value;

      case 'in':
        return (condition.value as any[]).includes(value);

      case 'not_in':
        return !(condition.value as any[]).includes(value);

      case 'greater_than':
        return value > condition.value;

      case 'less_than':
        return value < condition.value;

      case 'contains':
        return String(value).includes(String(condition.value));

      case 'matches':
        return new RegExp(condition.value as string).test(String(value));

      case 'time_between':
        const now = new Date();
        const [start, end] = condition.value as [string, string];
        return now >= new Date(start) && now <= new Date(end);

      case 'ip_in_range':
        return this.ipInRange(context.requestMetadata.ip, condition.value as string);

      default:
        return false;
    }
  }

  private resolveValue(
    attribute: string,
    context: AuthContext,
    permission: Permission
  ): any {
    const parts = attribute.split('.');
    let value: any = { user: context.user, session: context.session, request: context.requestMetadata, resource: permission };

    for (const part of parts) {
      value = value?.[part];
    }

    return value;
  }
}

// Predefined roles
const PREDEFINED_ROLES: Role[] = [
  {
    id: 'org_owner',
    name: 'Organization Owner',
    description: 'Full access to organization',
    permissions: ['organization:*'],
    scope: 'organization',
  },
  {
    id: 'org_admin',
    name: 'Organization Admin',
    description: 'Administrative access to organization',
    permissions: ['organization:read', 'organization:update', 'project:*', 'user:*'],
    scope: 'organization',
  },
  {
    id: 'project_admin',
    name: 'Project Admin',
    description: 'Full access to project',
    permissions: ['project:*'],
    scope: 'project',
  },
  {
    id: 'project_editor',
    name: 'Project Editor',
    description: 'Edit access to project',
    permissions: ['project:read', 'project:update', 'transformation:*'],
    scope: 'project',
  },
  {
    id: 'project_viewer',
    name: 'Project Viewer',
    description: 'Read-only access to project',
    permissions: ['project:read', 'transformation:read'],
    scope: 'project',
  },
];
```

### Component 3: Session Management

Secure token handling and session lifecycle.

```typescript
class SessionService {
  constructor(
    private sessionStore: SessionStore,
    private tokenService: TokenService,
    private config: SessionConfig
  ) {}

  async create(user: User): Promise<Session> {
    const sessionId = generateSecureId();
    const accessToken = await this.tokenService.generateAccessToken(user, sessionId);
    const refreshToken = await this.tokenService.generateRefreshToken(user, sessionId);

    const session: Session = {
      id: sessionId,
      userId: user.id,
      organizationId: user.organizationId,
      accessToken,
      refreshToken,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.config.sessionDuration),
      lastActivityAt: new Date(),
      metadata: {
        ip: getCurrentIP(),
        userAgent: getCurrentUserAgent(),
        device: parseDevice(getCurrentUserAgent()),
      },
    };

    await this.sessionStore.save(session);

    return session;
  }

  async validate(accessToken: string): Promise<SessionValidation> {
    // Verify token signature and expiration
    const payload = await this.tokenService.verifyAccessToken(accessToken);
    if (!payload) {
      return { valid: false, reason: 'invalid_token' };
    }

    // Get session
    const session = await this.sessionStore.get(payload.sessionId);
    if (!session) {
      return { valid: false, reason: 'session_not_found' };
    }

    // Check session expiration
    if (session.expiresAt < new Date()) {
      return { valid: false, reason: 'session_expired' };
    }

    // Check if session was revoked
    if (session.revokedAt) {
      return { valid: false, reason: 'session_revoked' };
    }

    // Update last activity
    session.lastActivityAt = new Date();
    await this.sessionStore.update(session);

    return {
      valid: true,
      session,
      user: await this.userStore.findById(session.userId),
    };
  }

  async refresh(refreshToken: string): Promise<RefreshResult> {
    // Verify refresh token
    const payload = await this.tokenService.verifyRefreshToken(refreshToken);
    if (!payload) {
      return { success: false, reason: 'invalid_refresh_token' };
    }

    // Get session
    const session = await this.sessionStore.get(payload.sessionId);
    if (!session || session.revokedAt) {
      return { success: false, reason: 'session_invalid' };
    }

    // Verify refresh token matches
    if (session.refreshToken !== refreshToken) {
      // Possible token theft - revoke all sessions
      await this.revokeAllUserSessions(session.userId);
      return { success: false, reason: 'token_reuse_detected' };
    }

    // Generate new tokens
    const user = await this.userStore.findById(session.userId);
    const newAccessToken = await this.tokenService.generateAccessToken(user, session.id);
    const newRefreshToken = await this.tokenService.generateRefreshToken(user, session.id);

    // Update session
    session.accessToken = newAccessToken;
    session.refreshToken = newRefreshToken;
    session.expiresAt = new Date(Date.now() + this.config.sessionDuration);
    await this.sessionStore.update(session);

    return {
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async revoke(sessionId: string): Promise<void> {
    const session = await this.sessionStore.get(sessionId);
    if (session) {
      session.revokedAt = new Date();
      await this.sessionStore.update(session);
    }
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    const sessions = await this.sessionStore.findByUser(userId);
    for (const session of sessions) {
      session.revokedAt = new Date();
      await this.sessionStore.update(session);
    }
  }
}

class TokenService {
  constructor(private config: TokenConfig) {}

  async generateAccessToken(user: User, sessionId: string): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      sessionId,
      type: 'access',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.config.accessTokenDuration,
    };

    return jwt.sign(payload, this.config.accessTokenSecret, {
      algorithm: 'RS256',
    });
  }

  async generateRefreshToken(user: User, sessionId: string): Promise<string> {
    const payload: RefreshTokenPayload = {
      sub: user.id,
      sessionId,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.config.refreshTokenDuration,
    };

    return jwt.sign(payload, this.config.refreshTokenSecret, {
      algorithm: 'RS256',
    });
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
    try {
      return jwt.verify(token, this.config.accessTokenPublic, {
        algorithms: ['RS256'],
      }) as AccessTokenPayload;
    } catch {
      return null;
    }
  }
}
```

### Component 4: SSO Integration

Enterprise identity provider integration.

```typescript
class SSOService {
  constructor(
    private samlService: SAMLService,
    private oidcService: OIDCService,
    private organizationStore: OrganizationStore
  ) {}

  async initiateSSOLogin(
    organizationId: string,
    returnUrl: string
  ): Promise<SSOInitiation> {
    const org = await this.organizationStore.findById(organizationId);
    if (!org.ssoConfig) {
      throw new AuthenticationError('SSO not configured for this organization');
    }

    switch (org.ssoConfig.protocol) {
      case 'saml':
        return this.samlService.initiateLogin(org.ssoConfig, returnUrl);
      case 'oidc':
        return this.oidcService.initiateLogin(org.ssoConfig, returnUrl);
      default:
        throw new AuthenticationError('Unknown SSO protocol');
    }
  }

  async completeSSOLogin(
    protocol: 'saml' | 'oidc',
    response: SSOResponse
  ): Promise<AuthResult> {
    let ssoUser: SSOUser;

    switch (protocol) {
      case 'saml':
        ssoUser = await this.samlService.processResponse(response);
        break;
      case 'oidc':
        ssoUser = await this.oidcService.processResponse(response);
        break;
      default:
        throw new AuthenticationError('Unknown SSO protocol');
    }

    // Find or create user
    let user = await this.userStore.findByEmail(ssoUser.email);

    if (!user) {
      // Auto-provision user if enabled
      if (ssoUser.organization.ssoConfig?.autoProvision) {
        user = await this.provisionUser(ssoUser);
      } else {
        throw new AuthenticationError('User not found and auto-provisioning is disabled');
      }
    }

    // Update user attributes from SSO
    await this.updateUserFromSSO(user, ssoUser);

    // Create session
    const session = await this.sessionService.create(user);

    return {
      status: 'authenticated',
      user: this.sanitizeUser(user),
      session,
    };
  }

  private async provisionUser(ssoUser: SSOUser): Promise<User> {
    return this.userStore.create({
      email: ssoUser.email,
      name: ssoUser.name,
      organizationId: ssoUser.organizationId,
      ssoId: ssoUser.ssoId,
      ssoProvider: ssoUser.provider,
      status: 'active',
      roles: ssoUser.organization.ssoConfig?.defaultRoles || ['project_viewer'],
    });
  }
}

class SAMLService {
  async initiateLogin(config: SAMLConfig, returnUrl: string): Promise<SSOInitiation> {
    const samlRequest = this.createSAMLRequest(config);
    const relayState = this.encodeRelayState({ returnUrl });

    return {
      redirectUrl: `${config.ssoUrl}?SAMLRequest=${encodeURIComponent(samlRequest)}&RelayState=${encodeURIComponent(relayState)}`,
      protocol: 'saml',
    };
  }

  async processResponse(response: SAMLResponse): Promise<SSOUser> {
    // Verify SAML response signature
    const verified = await this.verifySAMLSignature(response);
    if (!verified) {
      throw new AuthenticationError('Invalid SAML signature');
    }

    // Parse SAML assertion
    const assertion = this.parseSAMLAssertion(response.samlResponse);

    // Validate conditions
    this.validateConditions(assertion);

    // Extract user attributes
    return {
      ssoId: assertion.nameId,
      email: assertion.attributes.email,
      name: assertion.attributes.name || assertion.attributes.displayName,
      groups: assertion.attributes.groups || [],
      provider: 'saml',
    };
  }

  private verifySAMLSignature(response: SAMLResponse): boolean {
    const doc = new xmldom.DOMParser().parseFromString(response.samlResponse);
    const signature = xmlCrypto.xpath(doc, "//*[local-name()='Signature']")[0];

    const sig = new xmlCrypto.SignedXml();
    sig.loadSignature(signature);

    const cert = this.getIdPCertificate(response.organizationId);
    sig.keyInfoProvider = { getKey: () => cert };

    return sig.checkSignature(response.samlResponse);
  }
}
```

### Component 5: MFA Service

Multi-factor authentication.

```typescript
class MFAService {
  constructor(
    private totpService: TOTPService,
    private smsService: SMSService,
    private webAuthnService: WebAuthnService
  ) {}

  async enroll(userId: string, method: MFAMethod): Promise<MFAEnrollment> {
    switch (method) {
      case 'totp':
        return this.totpService.enroll(userId);
      case 'sms':
        return this.smsService.enroll(userId);
      case 'webauthn':
        return this.webAuthnService.enroll(userId);
      default:
        throw new Error('Unknown MFA method');
    }
  }

  async verify(user: User, code: string): Promise<boolean> {
    switch (user.mfaMethod) {
      case 'totp':
        return this.totpService.verify(user.totpSecret!, code);
      case 'sms':
        return this.smsService.verify(user.id, code);
      case 'webauthn':
        return this.webAuthnService.verify(user.id, code);
      default:
        return false;
    }
  }

  async createChallenge(userId: string): Promise<string> {
    const challenge = generateSecureId();
    await this.challengeStore.save({
      id: challenge,
      userId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    });
    return challenge;
  }
}

class TOTPService {
  async enroll(userId: string): Promise<TOTPEnrollment> {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(userId, 'Forge Factory', secret);
    const qrCode = await QRCode.toDataURL(otpauthUrl);

    // Store secret temporarily until verified
    await this.pendingEnrollmentStore.save({
      userId,
      secret,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    return {
      method: 'totp',
      secret,
      qrCode,
      otpauthUrl,
    };
  }

  verify(secret: string, code: string): boolean {
    return authenticator.verify({ token: code, secret });
  }
}
```

---

## Consequences

### Positive

1. **Security:** Enterprise-grade authentication
2. **Flexibility:** Multiple auth methods
3. **Compliance:** Meets regulatory requirements
4. **UX:** SSO for seamless login
5. **Control:** Fine-grained permissions

### Negative

1. **Complexity:** Multiple auth flows to maintain
2. **Integration:** SSO provider-specific code
3. **Testing:** Complex security testing needed
4. **Support:** User lockout scenarios

### Trade-offs

- **Security vs. UX:** Stronger security = more friction
- **Flexibility vs. Complexity:** More options = more code
- **Control vs. Simplicity:** Fine-grained = harder to manage

---

## Implementation Plan

### Phase 1: Basic Auth (Week 1-2)
- Email/password authentication
- Password policies
- Session management

### Phase 2: MFA (Week 3-4)
- TOTP implementation
- SMS fallback
- WebAuthn support

### Phase 3: SSO (Week 5-6)
- SAML integration
- OIDC integration
- User provisioning

### Phase 4: Authorization (Week 7-8)
- RBAC implementation
- ABAC policies
- Permission caching

---

## References

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [RFC 6749 - OAuth 2.0](https://tools.ietf.org/html/rfc6749)
- [SAML 2.0 Specification](https://docs.oasis-open.org/security/saml/v2.0/)
- [WebAuthn Specification](https://www.w3.org/TR/webauthn/)

---

**Decision Maker:** Security Lead + Engineering Lead
**Approved By:** CISO
**Implementation Owner:** Security Engineering Team
