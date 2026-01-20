# Feature: SSO/SAML Integration

**Feature ID:** FF-006
**Version:** 1.0
**Status:** Draft
**Owner:** Engineering Team
**Dependencies:** FF-005 (Authentication System)
**Estimated Effort:** 3 weeks
**Priority:** P0 (Required for Enterprise Sales)

---

## Overview

Enterprise Single Sign-On (SSO) via SAML 2.0 is a critical requirement for selling to large organizations. This feature allows enterprises to:
- Centrally manage user access through their Identity Provider (IdP)
- Enforce company-wide security policies (MFA, password complexity)
- Automatically provision/deprovision users
- Meet compliance requirements (SOC 2, ISO 27001)

### Business Context

**Market Requirement:**
- 78% of enterprise buyers require SSO (Gartner 2023)
- Average deal size 3.2x higher with SSO support
- Reduces customer onboarding time by 60%

**Competitive Landscape:**
- GitHub Enterprise: ✅ SAML SSO
- GitLab Ultimate: ✅ SAML SSO
- **Forge Factory must support this for Business/Enterprise tiers**

---

## User Stories

### Enterprise Admin
```
As an enterprise IT administrator,
I want to configure SAML SSO for my organization,
So that employees can access Forge Factory using their corporate credentials.
```

### End User
```
As a developer at an enterprise,
I want to sign in with my company SSO,
So that I don't need to manage another password.
```

### Security Officer
```
As a security officer,
I want SSO to enforce our MFA and session policies,
So that access to Forge Factory is compliant with our security requirements.
```

---

## Success Criteria

### Functional Requirements
- ✅ Support SAML 2.0 SP-initiated and IdP-initiated flows
- ✅ Support major IdPs (Okta, Azure AD, Google Workspace, OneLogin, Auth0)
- ✅ Allow per-organization SAML configuration
- ✅ Auto-provision users on first SSO login
- ✅ Map SAML attributes to user fields (email, name, role)
- ✅ Handle SAML logout (SLO - Single Logout)
- ✅ Provide clear setup instructions with screenshots
- ✅ Test connection before saving configuration

### Non-Functional Requirements
- ✅ SAML authentication completes in <2 seconds
- ✅ Support 10,000+ organizations with unique SAML configs
- ✅ 99.99% SSO availability (separate from main app uptime)
- ✅ Comprehensive audit logging of all SSO events
- ✅ Security: Validate signatures, check assertions, prevent replay attacks

---

## Vertical Slice Architecture

### 1. Database Schema

```sql
-- SAML Configuration per organization
CREATE TABLE saml_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- IdP Configuration
  idp_entity_id TEXT NOT NULL, -- e.g., "https://company.okta.com"
  idp_sso_url TEXT NOT NULL, -- IdP's SSO endpoint
  idp_slo_url TEXT, -- Optional: Single Logout URL
  idp_certificate TEXT NOT NULL, -- X.509 certificate for signature verification

  -- SP Configuration (our side)
  sp_entity_id TEXT NOT NULL, -- e.g., "https://forge.factory/saml"
  sp_acs_url TEXT NOT NULL, -- Assertion Consumer Service URL
  sp_slo_url TEXT, -- Our logout endpoint

  -- Attribute Mapping
  attribute_mapping JSONB NOT NULL DEFAULT '{
    "email": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
    "firstName": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
    "lastName": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname",
    "role": "role"
  }'::jsonb,

  -- Auto-provisioning
  auto_provision_users BOOLEAN DEFAULT TRUE,
  default_role TEXT DEFAULT 'member', -- Role for auto-provisioned users

  -- Security
  require_signed_assertions BOOLEAN DEFAULT TRUE,
  require_signed_response BOOLEAN DEFAULT TRUE,

  -- Status
  enabled BOOLEAN DEFAULT FALSE,
  last_tested_at TIMESTAMPTZ,
  test_result JSONB, -- Store last test connection result

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_saml_configurations_organization ON saml_configurations(organization_id);

-- SSO Sessions (track SAML sessions separately from regular sessions)
CREATE TABLE sso_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- SAML Session Data
  saml_session_index TEXT NOT NULL, -- From SAML assertion
  saml_name_id TEXT NOT NULL, -- NameID from assertion
  idp_entity_id TEXT NOT NULL,

  -- Session Tracking
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL, -- From SAML SessionNotOnOrAfter

  -- Security
  ip_address INET,
  user_agent TEXT,

  terminated_at TIMESTAMPTZ,
  termination_reason TEXT -- 'logout', 'slo', 'timeout', 'forced'
);

CREATE INDEX idx_sso_sessions_user ON sso_sessions(user_id);
CREATE INDEX idx_sso_sessions_saml_session_index ON sso_sessions(saml_session_index);
CREATE INDEX idx_sso_sessions_active ON sso_sessions(user_id, terminated_at)
  WHERE terminated_at IS NULL;

-- SAML Audit Log
CREATE TABLE saml_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id), -- NULL for failed attempts

  event_type TEXT NOT NULL, -- 'login_success', 'login_failure', 'logout', 'config_updated', 'test_connection'

  -- Request Details
  saml_request_id TEXT,
  saml_name_id TEXT,
  idp_entity_id TEXT,

  -- Result
  success BOOLEAN NOT NULL,
  error_code TEXT,
  error_message TEXT,

  -- Metadata
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saml_audit_logs_organization ON saml_audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_saml_audit_logs_user ON saml_audit_logs(user_id, created_at DESC);
CREATE INDEX idx_saml_audit_logs_event_type ON saml_audit_logs(event_type, created_at DESC);
```

### 2. API Endpoints

#### Admin Endpoints (Organization Owner/Admin only)

**POST /api/v1/organizations/:orgId/saml/configure**
```typescript
/**
 * @prompt-id forge-v4.1:feature:saml:configure-endpoint
 * @generated-at 2026-01-20T00:00:00Z
 */

// Request
{
  idpEntityId: string;
  idpSsoUrl: string;
  idpSloUrl?: string;
  idpCertificate: string; // X.509 PEM format
  attributeMapping?: {
    email: string;
    firstName?: string;
    lastName?: string;
    role?: string;
  };
  autoProvisionUsers?: boolean;
  defaultRole?: 'member' | 'viewer';
  requireSignedAssertions?: boolean;
  requireSignedResponse?: boolean;
}

// Response
{
  id: string;
  spEntityId: string; // For customer to configure in their IdP
  spAcsUrl: string; // ACS URL for IdP
  spMetadataUrl: string; // Metadata XML endpoint
  enabled: false; // Not enabled until tested
}
```

**POST /api/v1/organizations/:orgId/saml/test**
```typescript
// Test SAML connection before enabling
// Returns SSO URL for admin to test login flow

// Response
{
  testUrl: string; // Redirects to IdP with test request
  testId: string; // Track this test attempt
}
```

**GET /api/v1/organizations/:orgId/saml/configuration**
```typescript
// Response
{
  id: string;
  enabled: boolean;
  idpEntityId: string;
  idpSsoUrl: string;
  attributeMapping: object;
  autoProvisionUsers: boolean;
  defaultRole: string;
  lastTestedAt: string | null;
  testResult: {
    success: boolean;
    error?: string;
    testedAt: string;
  } | null;
}
```

**PATCH /api/v1/organizations/:orgId/saml/configuration**
```typescript
// Update SAML configuration
// Request: Partial<SAMLConfiguration>

// Response: Updated configuration
```

**DELETE /api/v1/organizations/:orgId/saml/configuration**
```typescript
// Disable and delete SAML configuration
// This will force all users to use email/password

// Response: 204 No Content
```

**GET /api/v1/organizations/:orgId/saml/metadata**
```typescript
// Returns SAML Service Provider metadata XML
// For customer to upload to their IdP

// Response: XML
<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://forge.factory/saml">
  <SPSSODescriptor>
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                              Location="https://forge.factory/api/v1/auth/saml/acs" />
    ...
  </SPSSODescriptor>
</EntityDescriptor>
```

#### Public SAML Endpoints

**POST /api/v1/auth/saml/login**
```typescript
// SP-initiated SSO flow
// Request
{
  organizationSlug: string; // e.g., "acme-corp"
  redirectUrl?: string; // Where to redirect after successful login
}

// Response: 302 Redirect to IdP with SAMLRequest
```

**POST /api/v1/auth/saml/acs**
```typescript
// Assertion Consumer Service - receives SAML response from IdP
// This endpoint processes the SAML response and creates/updates user

// Request: Form POST from IdP
{
  SAMLResponse: string; // Base64 encoded SAML assertion
  RelayState?: string; // Optional state to restore
}

// Response: 302 Redirect to app with session cookie
```

**GET /api/v1/auth/saml/slo**
```typescript
// Single Logout - initiated by IdP
// Query params: SAMLRequest (base64)

// Response: 302 Redirect back to IdP with LogoutResponse
```

**POST /api/v1/auth/saml/logout**
```typescript
// User-initiated logout (also notifies IdP if SLO configured)

// Request
{
  sessionId: string;
}

// Response
{
  success: true;
  logoutUrl?: string; // If IdP SLO is configured
}
```

#### Audit Endpoints

**GET /api/v1/organizations/:orgId/saml/audit-logs**
```typescript
// Query params
{
  userId?: string;
  eventType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

// Response
{
  logs: Array<{
    id: string;
    userId: string | null;
    eventType: string;
    success: boolean;
    errorCode?: string;
    errorMessage?: string;
    ipAddress: string;
    createdAt: string;
  }>;
  total: number;
}
```

### 3. Business Logic

#### SAML Service (Backend)

```typescript
/**
 * @prompt-id forge-v4.1:feature:saml:service
 * @generated-at 2026-01-20T00:00:00Z
 */

import { SAML } from '@node-saml/node-saml';
import crypto from 'crypto';

export class SAMLService {
  /**
   * Initialize SAML Service Provider for organization
   */
  async getSAMLProvider(organizationId: string): Promise<SAML> {
    const config = await db.samlConfiguration.findUnique({
      where: { organizationId },
    });

    if (!config || !config.enabled) {
      throw new Error('SAML not configured for this organization');
    }

    return new SAML({
      // Service Provider (us)
      issuer: config.spEntityId,
      callbackUrl: config.spAcsUrl,

      // Identity Provider (customer)
      entryPoint: config.idpSsoUrl,
      logoutUrl: config.idpSloUrl,
      cert: config.idpCertificate,
      identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',

      // Security
      wantAssertionsSigned: config.requireSignedAssertions,
      wantAuthnResponseSigned: config.requireSignedResponse,
      signatureAlgorithm: 'sha256',

      // Validation
      acceptedClockSkewMs: 5000, // Allow 5 second clock skew
    });
  }

  /**
   * Generate SAML login URL (SP-initiated flow)
   */
  async generateLoginUrl(
    organizationSlug: string,
    redirectUrl?: string
  ): Promise<string> {
    const org = await db.organization.findUnique({
      where: { slug: organizationSlug },
      include: { samlConfiguration: true },
    });

    if (!org?.samlConfiguration?.enabled) {
      throw new Error('SAML not enabled for this organization');
    }

    const saml = await this.getSAMLProvider(org.id);

    return new Promise((resolve, reject) => {
      saml.getAuthorizeUrl(
        { RelayState: redirectUrl || '/' },
        (err, loginUrl) => {
          if (err) return reject(err);
          resolve(loginUrl);
        }
      );
    });
  }

  /**
   * Process SAML assertion from IdP
   */
  async processAssertion(
    samlResponse: string,
    organizationId: string
  ): Promise<{ user: User; session: SSOSession }> {
    const saml = await this.getSAMLProvider(organizationId);
    const config = await db.samlConfiguration.findUnique({
      where: { organizationId },
    });

    // Validate SAML response
    const profile = await new Promise<any>((resolve, reject) => {
      saml.validatePostResponse(
        { SAMLResponse: samlResponse },
        (err, profile) => {
          if (err) return reject(err);
          resolve(profile);
        }
      );
    });

    // Extract attributes using mapping
    const email = this.extractAttribute(
      profile,
      config.attributeMapping.email
    );
    const firstName = this.extractAttribute(
      profile,
      config.attributeMapping.firstName
    );
    const lastName = this.extractAttribute(
      profile,
      config.attributeMapping.lastName
    );
    const role = this.extractAttribute(
      profile,
      config.attributeMapping.role
    );

    if (!email) {
      throw new Error('Email attribute not found in SAML assertion');
    }

    // Find or create user
    let user = await db.user.findUnique({ where: { email } });

    if (!user && config.autoProvisionUsers) {
      // Auto-provision user
      user = await db.user.create({
        data: {
          email,
          firstName: firstName || '',
          lastName: lastName || '',
          emailVerified: true, // SSO users are pre-verified
          authMethod: 'saml',
        },
      });

      // Add to organization
      await db.organizationMember.create({
        data: {
          organizationId,
          userId: user.id,
          role: role || config.defaultRole,
        },
      });

      // Audit log
      await this.auditLog({
        organizationId,
        userId: user.id,
        eventType: 'user_auto_provisioned',
        success: true,
      });
    } else if (!user) {
      throw new Error('User not found and auto-provisioning is disabled');
    }

    // Create SSO session
    const sessionIndex = profile.sessionIndex;
    const nameId = profile.nameID;
    const expiresAt = profile.sessionNotOnOrAfter
      ? new Date(profile.sessionNotOnOrAfter)
      : new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours default

    const ssoSession = await db.ssoSession.create({
      data: {
        userId: user.id,
        organizationId,
        samlSessionIndex: sessionIndex,
        samlNameId: nameId,
        idpEntityId: config.idpEntityId,
        expiresAt,
      },
    });

    // Audit log
    await this.auditLog({
      organizationId,
      userId: user.id,
      eventType: 'login_success',
      samlRequestId: profile.inResponseTo,
      samlNameId: nameId,
      idpEntityId: config.idpEntityId,
      success: true,
    });

    return { user, session: ssoSession };
  }

  /**
   * Handle Single Logout from IdP
   */
  async handleSingleLogout(
    samlRequest: string,
    organizationId: string
  ): Promise<string> {
    const saml = await this.getSAMLProvider(organizationId);

    // Parse logout request
    const logoutRequest = await new Promise<any>((resolve, reject) => {
      saml.validatePostRequest(
        { SAMLRequest: samlRequest },
        (err, req) => {
          if (err) return reject(err);
          resolve(req);
        }
      );
    });

    // Find and terminate session
    const nameId = logoutRequest.nameID;
    const sessionIndex = logoutRequest.sessionIndex;

    await db.ssoSession.updateMany({
      where: {
        organizationId,
        samlNameId: nameId,
        samlSessionIndex: sessionIndex,
        terminatedAt: null,
      },
      data: {
        terminatedAt: new Date(),
        terminationReason: 'slo',
      },
    });

    // Generate logout response
    return new Promise((resolve, reject) => {
      saml.generateLogoutResponse(logoutRequest, (err, url) => {
        if (err) return reject(err);
        resolve(url);
      });
    });
  }

  /**
   * Test SAML configuration
   */
  async testConnection(organizationId: string): Promise<boolean> {
    try {
      const loginUrl = await this.generateLoginUrl(organizationId);

      await db.samlConfiguration.update({
        where: { organizationId },
        data: {
          lastTestedAt: new Date(),
          testResult: {
            success: true,
            loginUrl,
            testedAt: new Date().toISOString(),
          },
        },
      });

      return true;
    } catch (error) {
      await db.samlConfiguration.update({
        where: { organizationId },
        data: {
          lastTestedAt: new Date(),
          testResult: {
            success: false,
            error: error.message,
            testedAt: new Date().toISOString(),
          },
        },
      });

      return false;
    }
  }

  /**
   * Extract attribute from SAML profile
   */
  private extractAttribute(profile: any, attributeName: string): string | null {
    // Check in attributes object
    if (profile.attributes && profile.attributes[attributeName]) {
      const value = profile.attributes[attributeName];
      return Array.isArray(value) ? value[0] : value;
    }

    // Check in root
    if (profile[attributeName]) {
      return profile[attributeName];
    }

    return null;
  }

  /**
   * Audit log helper
   */
  private async auditLog(data: {
    organizationId: string;
    userId?: string;
    eventType: string;
    success: boolean;
    samlRequestId?: string;
    samlNameId?: string;
    idpEntityId?: string;
    errorCode?: string;
    errorMessage?: string;
  }): Promise<void> {
    await db.samlAuditLog.create({ data });
  }
}
```

### 4. UI Components

#### SAML Configuration Page

**File:** `apps/web/src/app/(dashboard)/[orgSlug]/settings/saml/page.tsx`

```typescript
/**
 * @prompt-id forge-v4.1:feature:saml:config-page
 * @generated-at 2026-01-20T00:00:00Z
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useSAMLConfiguration, useConfigureSAML, useTestSAML } from '@/hooks/api/saml';

const samlConfigSchema = z.object({
  idpEntityId: z.string().url('Must be a valid URL'),
  idpSsoUrl: z.string().url('Must be a valid URL'),
  idpSloUrl: z.string().url('Must be a valid URL').optional(),
  idpCertificate: z.string().min(1, 'Certificate is required'),
  autoProvisionUsers: z.boolean(),
  defaultRole: z.enum(['member', 'viewer']),
  requireSignedAssertions: z.boolean(),
  requireSignedResponse: z.boolean(),
});

type SAMLConfigFormData = z.infer<typeof samlConfigSchema>;

export default function SAMLConfigurationPage({
  params,
}: {
  params: { orgSlug: string };
}) {
  const { toast } = useToast();
  const [showSetup, setShowSetup] = useState(false);

  const { data: config, isLoading } = useSAMLConfiguration(params.orgSlug);
  const configureMutation = useConfigureSAML(params.orgSlug);
  const testMutation = useTestSAML(params.orgSlug);

  const form = useForm<SAMLConfigFormData>({
    resolver: zodResolver(samlConfigSchema),
    defaultValues: config || {
      autoProvisionUsers: true,
      defaultRole: 'member',
      requireSignedAssertions: true,
      requireSignedResponse: true,
    },
  });

  const onSubmit = async (data: SAMLConfigFormData) => {
    try {
      const result = await configureMutation.mutateAsync(data);

      toast({
        title: 'SAML Configuration Saved',
        description: 'Your SSO settings have been updated.',
      });

      // Show setup instructions
      setShowSetup(true);
    } catch (error) {
      toast({
        title: 'Configuration Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleTest = async () => {
    try {
      const result = await testMutation.mutateAsync();

      // Open test URL in new window
      window.open(result.testUrl, '_blank');

      toast({
        title: 'Test Connection Initiated',
        description: 'Complete the login flow in the new window.',
      });
    } catch (error) {
      toast({
        title: 'Test Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">SAML SSO Configuration</h1>
        <p className="text-muted-foreground mt-2">
          Enable Single Sign-On for your organization using SAML 2.0
        </p>
      </div>

      {config?.enabled && (
        <Card className="p-6 bg-green-50 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-green-900">SSO Enabled</h3>
              <p className="text-sm text-green-700">
                Users can sign in with {config.idpEntityId}
              </p>
            </div>
            <Button variant="outline" onClick={handleTest}>
              Test Connection
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">
              Identity Provider Configuration
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">IdP Entity ID</label>
                <Input
                  {...form.register('idpEntityId')}
                  placeholder="https://your-idp.com/saml"
                />
                {form.formState.errors.idpEntityId && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.idpEntityId.message}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium">IdP SSO URL</label>
                <Input
                  {...form.register('idpSsoUrl')}
                  placeholder="https://your-idp.com/sso/saml"
                />
                {form.formState.errors.idpSsoUrl && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.idpSsoUrl.message}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium">
                  IdP Logout URL (Optional)
                </label>
                <Input
                  {...form.register('idpSloUrl')}
                  placeholder="https://your-idp.com/slo/saml"
                />
              </div>

              <div>
                <label className="text-sm font-medium">
                  IdP X.509 Certificate
                </label>
                <Textarea
                  {...form.register('idpCertificate')}
                  placeholder="-----BEGIN CERTIFICATE-----&#10;MIIDdzCCAl+gAwIBAgI...&#10;-----END CERTIFICATE-----"
                  rows={8}
                  className="font-mono text-xs"
                />
                {form.formState.errors.idpCertificate && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.idpCertificate.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">User Provisioning</h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">
                    Auto-provision Users
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Automatically create accounts for new SSO users
                  </p>
                </div>
                <Switch {...form.register('autoProvisionUsers')} />
              </div>

              <div>
                <label className="text-sm font-medium">Default Role</label>
                <select
                  {...form.register('defaultRole')}
                  className="w-full p-2 border rounded"
                >
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Security</h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">
                    Require Signed Assertions
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Recommended for production
                  </p>
                </div>
                <Switch {...form.register('requireSignedAssertions')} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">
                    Require Signed Response
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Recommended for production
                  </p>
                </div>
                <Switch {...form.register('requireSignedResponse')} />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={configureMutation.isPending}>
              {configureMutation.isPending ? 'Saving...' : 'Save Configuration'}
            </Button>
            {config && (
              <Button
                type="button"
                variant="outline"
                onClick={handleTest}
                disabled={testMutation.isPending}
              >
                Test Connection
              </Button>
            )}
          </div>
        </form>
      </Card>

      {showSetup && config && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">
            Service Provider Information
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Configure these values in your Identity Provider:
          </p>

          <div className="space-y-3 bg-muted p-4 rounded">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                SP Entity ID
              </label>
              <code className="block text-sm bg-background p-2 rounded mt-1">
                {config.spEntityId}
              </code>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Assertion Consumer Service (ACS) URL
              </label>
              <code className="block text-sm bg-background p-2 rounded mt-1">
                {config.spAcsUrl}
              </code>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Metadata URL
              </label>
              <code className="block text-sm bg-background p-2 rounded mt-1">
                {config.spMetadataUrl}
              </code>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
```

#### SSO Login Button

**File:** `apps/web/src/components/auth/sso-login-button.tsx`

```typescript
/**
 * @prompt-id forge-v4.1:feature:saml:login-button
 * @generated-at 2026-01-20T00:00:00Z
 */

'use client';

import { Button } from '@/components/ui/button';
import { Building2 } from 'lucide-react';

export function SSOLoginButton({ organizationSlug }: { organizationSlug: string }) {
  const handleSSOLogin = () => {
    // Redirect to SAML SP-initiated flow
    window.location.href = `/api/v1/auth/saml/login?org=${organizationSlug}`;
  };

  return (
    <Button
      variant="outline"
      className="w-full"
      onClick={handleSSOLogin}
    >
      <Building2 className="mr-2 h-4 w-4" />
      Sign in with SSO
    </Button>
  );
}
```

### 5. Tests

#### SAML Service Tests

**File:** `packages/backend/src/features/saml/__tests__/saml.service.test.ts`

```typescript
/**
 * @prompt-id forge-v4.1:feature:saml:service-tests
 * @generated-at 2026-01-20T00:00:00Z
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SAMLService } from '../saml.service';
import { db } from '@/lib/db';

describe('SAMLService', () => {
  let samlService: SAMLService;
  let mockOrganization: any;
  let mockSAMLConfig: any;

  beforeEach(async () => {
    samlService = new SAMLService();

    mockOrganization = await db.organization.create({
      data: {
        name: 'Test Corp',
        slug: 'test-corp',
        planTier: 'business',
      },
    });

    mockSAMLConfig = await db.samlConfiguration.create({
      data: {
        organizationId: mockOrganization.id,
        idpEntityId: 'https://test-idp.com',
        idpSsoUrl: 'https://test-idp.com/sso',
        idpCertificate: MOCK_CERTIFICATE,
        spEntityId: 'https://forge.factory/saml',
        spAcsUrl: 'https://forge.factory/api/v1/auth/saml/acs',
        enabled: true,
      },
    });
  });

  describe('generateLoginUrl', () => {
    it('should generate valid SAML login URL', async () => {
      const loginUrl = await samlService.generateLoginUrl('test-corp');

      expect(loginUrl).toContain('https://test-idp.com/sso');
      expect(loginUrl).toContain('SAMLRequest=');
    });

    it('should throw error for org without SAML', async () => {
      await expect(
        samlService.generateLoginUrl('no-saml-org')
      ).rejects.toThrow('SAML not enabled');
    });
  });

  describe('processAssertion', () => {
    it('should create new user when auto-provisioning enabled', async () => {
      const mockAssertion = createMockSAMLAssertion({
        email: 'newuser@testcorp.com',
        firstName: 'John',
        lastName: 'Doe',
      });

      const result = await samlService.processAssertion(
        mockAssertion,
        mockOrganization.id
      );

      expect(result.user.email).toBe('newuser@testcorp.com');
      expect(result.user.firstName).toBe('John');
      expect(result.session).toBeDefined();

      // Verify user was added to organization
      const member = await db.organizationMember.findFirst({
        where: {
          organizationId: mockOrganization.id,
          userId: result.user.id,
        },
      });
      expect(member).toBeDefined();
      expect(member.role).toBe('member');
    });

    it('should find existing user by email', async () => {
      const existingUser = await db.user.create({
        data: {
          email: 'existing@testcorp.com',
          firstName: 'Jane',
          authMethod: 'email',
        },
      });

      const mockAssertion = createMockSAMLAssertion({
        email: 'existing@testcorp.com',
      });

      const result = await samlService.processAssertion(
        mockAssertion,
        mockOrganization.id
      );

      expect(result.user.id).toBe(existingUser.id);
    });

    it('should reject invalid SAML assertion', async () => {
      const invalidAssertion = 'invalid-base64-saml';

      await expect(
        samlService.processAssertion(invalidAssertion, mockOrganization.id)
      ).rejects.toThrow();
    });

    it('should reject expired SAML assertion', async () => {
      const expiredAssertion = createMockSAMLAssertion({
        email: 'user@test.com',
        notOnOrAfter: new Date(Date.now() - 60000), // 1 minute ago
      });

      await expect(
        samlService.processAssertion(expiredAssertion, mockOrganization.id)
      ).rejects.toThrow('expired');
    });

    it('should create audit log on successful login', async () => {
      const mockAssertion = createMockSAMLAssertion({
        email: 'audit@test.com',
      });

      await samlService.processAssertion(mockAssertion, mockOrganization.id);

      const auditLog = await db.samlAuditLog.findFirst({
        where: {
          organizationId: mockOrganization.id,
          eventType: 'login_success',
        },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog.success).toBe(true);
    });
  });

  describe('handleSingleLogout', () => {
    it('should terminate SSO session on SLO request', async () => {
      const user = await db.user.create({
        data: { email: 'user@test.com' },
      });

      const session = await db.ssoSession.create({
        data: {
          userId: user.id,
          organizationId: mockOrganization.id,
          samlSessionIndex: 'session-123',
          samlNameId: 'user@test.com',
          idpEntityId: 'https://test-idp.com',
          expiresAt: new Date(Date.now() + 3600000),
        },
      });

      const logoutRequest = createMockSAMLLogoutRequest({
        nameId: 'user@test.com',
        sessionIndex: 'session-123',
      });

      await samlService.handleSingleLogout(logoutRequest, mockOrganization.id);

      const terminatedSession = await db.ssoSession.findUnique({
        where: { id: session.id },
      });

      expect(terminatedSession.terminatedAt).not.toBeNull();
      expect(terminatedSession.terminationReason).toBe('slo');
    });
  });

  describe('testConnection', () => {
    it('should mark test as successful', async () => {
      const result = await samlService.testConnection(mockOrganization.id);

      expect(result).toBe(true);

      const config = await db.samlConfiguration.findUnique({
        where: { organizationId: mockOrganization.id },
      });

      expect(config.lastTestedAt).not.toBeNull();
      expect(config.testResult.success).toBe(true);
    });
  });
});

// Test helpers
const MOCK_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIDdzCCAl+gAwIBAgIEAgAAuTANBgkqhkiG9w0BAQUFADBaMQswCQYDVQQGEwJV
...
-----END CERTIFICATE-----`;

function createMockSAMLAssertion(data: {
  email: string;
  firstName?: string;
  lastName?: string;
  notOnOrAfter?: Date;
}): string {
  // Implementation would create valid SAML XML and encode it
  // This is simplified for the example
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

function createMockSAMLLogoutRequest(data: {
  nameId: string;
  sessionIndex: string;
}): string {
  return Buffer.from(JSON.stringify(data)).toString('base64');
}
```

---

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1)
1. Database schema migration
2. Install and configure `@node-saml/node-saml` package
3. Create SAMLService class with basic configuration
4. Add SAML routes to API

### Phase 2: SP-Initiated Flow (Week 1-2)
1. Implement login URL generation
2. Implement ACS endpoint (assertion processing)
3. Add user auto-provisioning logic
4. Create audit logging

### Phase 3: UI & Configuration (Week 2)
1. Build SAML configuration page
2. Add SSO login button to login page
3. Create setup instructions UI
4. Add metadata XML endpoint

### Phase 4: Advanced Features (Week 2-3)
1. Implement Single Logout (SLO)
2. Add IdP-initiated flow support
3. Build test connection functionality
4. Add attribute mapping customization

### Phase 5: Testing & Documentation (Week 3)
1. Write comprehensive unit tests
2. Integration tests with mock SAML IdP
3. Test with real IdPs (Okta, Azure AD)
4. Document setup for each IdP

---

## Security Considerations

### SAML-Specific Security

1. **Signature Verification**
   - MUST validate XML signatures on assertions and responses
   - Use strong signature algorithms (SHA256 minimum)
   - Reject unsigned assertions in production

2. **Replay Attack Prevention**
   - Store and check `InResponseTo` IDs
   - Enforce `NotOnOrAfter` timestamp
   - Reject duplicate assertions

3. **XML External Entity (XXE) Protection**
   - Disable external entity processing
   - Use safe XML parsers
   - Validate XML structure before parsing

4. **Certificate Management**
   - Store IdP certificates securely (encrypted at rest)
   - Support certificate rotation
   - Alert admins before certificate expiry

5. **Session Security**
   - Bind SSO sessions to browser fingerprints
   - Enforce session timeouts
   - Support force logout/SLO

### Implementation Checklist

- [ ] All SAML responses validated and signed
- [ ] XML parser configured with XXE protection
- [ ] Replay attack prevention implemented
- [ ] Certificate validation and rotation supported
- [ ] Audit logging for all SAML events
- [ ] Rate limiting on SAML endpoints
- [ ] CSRF protection on ACS endpoint

---

## Performance Considerations

### Optimization Strategies

1. **Configuration Caching**
   - Cache SAML configurations in Redis (5 min TTL)
   - Invalidate cache on configuration updates
   - Target: <50ms for cached config lookup

2. **Certificate Parsing**
   - Pre-parse certificates on configuration save
   - Cache parsed certificate objects
   - Avoid re-parsing on every request

3. **Database Queries**
   - Index `saml_configurations.organization_id`
   - Index `sso_sessions.saml_session_index`
   - Use connection pooling

4. **SAML Response Processing**
   - Stream large XML responses
   - Use efficient XML parser (libxmljs)
   - Target: <500ms for full SAML flow

### Performance Targets

| Metric | Target | P95 | P99 |
|--------|--------|-----|-----|
| Login URL generation | 100ms | 150ms | 200ms |
| ACS processing | 300ms | 500ms | 800ms |
| SLO handling | 200ms | 300ms | 500ms |
| Configuration load | 50ms | 80ms | 100ms |

---

## Open Questions

1. **Multi-IdP Support:** Should we support multiple IdPs per organization? (Answer: Phase 2 feature)
2. **Just-In-Time Provisioning:** Should we support JIT group/role mapping? (Answer: Yes, in Phase 2)
3. **SCIM Integration:** Should we add SCIM for user provisioning? (Answer: Separate feature FF-041)
4. **Session Lifetime:** Should we enforce org-level session policies? (Answer: Yes, add to FF-007)
5. **Backup Auth:** Should we allow email/password fallback for SSO users? (Answer: Optional, configurable per org)

---

## Success Metrics

### Adoption Metrics
- 80% of Business/Enterprise customers enable SSO within 30 days
- <15 minutes average time to configure SSO
- <2 support tickets per SSO setup

### Technical Metrics
- 99.99% SSO availability
- <500ms P95 latency for SAML flows
- Zero security incidents related to SAML

### Business Impact
- 30% faster enterprise deal cycles
- 20% higher conversion for SSO-enabled trials
- 95% SSO user satisfaction score

---

**Status:** Ready for implementation
**Next Steps:** Review with security team, begin Phase 1 development
