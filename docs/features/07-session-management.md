# Feature: Session Management

**Feature ID:** FF-007
**Version:** 1.0
**Status:** Draft
**Owner:** Engineering Team
**Dependencies:** FF-005 (Authentication System)
**Estimated Effort:** 1 week
**Priority:** P0 (Critical Security Feature)

---

## Overview

Session Management provides secure, scalable session handling for authenticated users. It implements JWT-based authentication with refresh tokens, device tracking, and session revocation capabilities.

### Business Context

**Why Session Management Matters:**
- **Security:** Prevents session hijacking, enables instant revocation
- **User Experience:** Remember devices, sign out remotely
- **Compliance:** SOC 2 requires session management and activity logging
- **Scale:** Stateless JWTs eliminate database lookups on every request

**Modern Requirements:**
- Multi-device support (phone, laptop, tablet)
- "Sign out everywhere" functionality
- Session timeout and inactivity detection
- Suspicious activity detection

---

## User Stories

### End User
```
As a user,
I want to see all my active sessions,
So that I can revoke access from lost or stolen devices.
```

### Security-Conscious User
```
As a user,
I want to sign out of all sessions at once,
So that I can secure my account if I suspect unauthorized access.
```

### Developer
```
As a developer using the API,
I want my access token to auto-refresh,
So that I don't have to re-authenticate constantly.
```

### Security Admin
```
As a security administrator,
I want to force-revoke all sessions for a compromised user,
So that I can immediately stop unauthorized access.
```

---

## Success Criteria

### Functional Requirements
- ✅ Issue short-lived JWT access tokens (15 min)
- ✅ Issue long-lived refresh tokens (30 days)
- ✅ Track all active sessions with device information
- ✅ Allow users to revoke individual sessions
- ✅ Support "sign out everywhere" functionality
- ✅ Detect suspicious sessions (new location, new device type)
- ✅ Auto-revoke sessions after 90 days of inactivity
- ✅ Enforce organization-level session policies

### Non-Functional Requirements
- ✅ Token validation in <10ms (in-memory check)
- ✅ Support 1M+ concurrent sessions per organization
- ✅ 99.99% session service availability
- ✅ Zero downtime session rotation
- ✅ GDPR-compliant session data retention

---

## Vertical Slice Architecture

### 1. Database Schema

```sql
-- User Sessions (tracks all active sessions)
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Token identifiers
  access_token_jti VARCHAR(64) UNIQUE NOT NULL, -- JWT ID for access token
  refresh_token_hash VARCHAR(64) UNIQUE NOT NULL, -- SHA256 of refresh token

  -- Session metadata
  device_type VARCHAR(50), -- 'desktop', 'mobile', 'tablet', 'api'
  device_name TEXT, -- User-friendly name
  os VARCHAR(100),
  browser VARCHAR(100),
  ip_address INET NOT NULL,
  user_agent TEXT,

  -- Location (for suspicious activity detection)
  country_code CHAR(2),
  city TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  -- Revocation
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES users(id),
  revocation_reason TEXT, -- 'user_logout', 'sign_out_all', 'admin_revoked', 'suspicious', 'expired'

  -- Flags
  is_current BOOLEAN DEFAULT FALSE, -- The session making this request
  is_suspicious BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_organization_id ON user_sessions(organization_id);
CREATE INDEX idx_user_sessions_access_token_jti ON user_sessions(access_token_jti);
CREATE INDEX idx_user_sessions_refresh_token_hash ON user_sessions(refresh_token_hash);
CREATE INDEX idx_user_sessions_active ON user_sessions(user_id, revoked_at)
  WHERE revoked_at IS NULL;
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at)
  WHERE revoked_at IS NULL;

-- Device Registry (remembered devices)
CREATE TABLE device_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Device fingerprint
  device_fingerprint VARCHAR(64) UNIQUE NOT NULL, -- Hash of device attributes
  device_name TEXT NOT NULL,
  device_type VARCHAR(50) NOT NULL,

  -- Trust status
  trusted BOOLEAN DEFAULT FALSE,
  trust_granted_at TIMESTAMPTZ,

  -- Metadata
  os VARCHAR(100),
  browser VARCHAR(100),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_ip_address INET,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_device_registry_user_id ON device_registry(user_id);
CREATE INDEX idx_device_registry_fingerprint ON device_registry(device_fingerprint);

-- Session Activity Log (for analytics and security)
CREATE TABLE session_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES user_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Activity
  activity_type VARCHAR(50) NOT NULL, -- 'login', 'logout', 'token_refresh', 'api_call', 'suspicious_activity'
  endpoint TEXT,
  method VARCHAR(10),

  -- Request details
  ip_address INET,
  user_agent TEXT,

  -- Response
  status_code INTEGER,
  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_session_activity_log_session_id ON session_activity_log(session_id, created_at DESC);
CREATE INDEX idx_session_activity_log_user_id ON session_activity_log(user_id, created_at DESC);
CREATE INDEX idx_session_activity_log_activity_type ON session_activity_log(activity_type, created_at DESC);

-- Session Policies (organization-level)
CREATE TABLE session_policies (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,

  -- Token lifetimes
  access_token_lifetime_minutes INTEGER DEFAULT 15,
  refresh_token_lifetime_days INTEGER DEFAULT 30,
  inactivity_timeout_days INTEGER DEFAULT 90,

  -- Security
  require_mfa BOOLEAN DEFAULT FALSE,
  max_concurrent_sessions INTEGER, -- NULL = unlimited
  enforce_ip_allowlist BOOLEAN DEFAULT FALSE,
  ip_allowlist INET[], -- Array of allowed IPs/CIDR blocks

  -- Device trust
  require_trusted_devices BOOLEAN DEFAULT FALSE,
  auto_trust_devices BOOLEAN DEFAULT TRUE,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);
```

### 2. API Endpoints

#### Session Endpoints

**POST /api/v1/auth/token/refresh**
```typescript
/**
 * @prompt-id forge-v4.1:feature:session:refresh-endpoint
 * @generated-at 2026-01-20T00:00:00Z
 */

// Request
{
  refreshToken: string;
}

// Response
{
  accessToken: string; // New 15-min JWT
  refreshToken: string; // New 30-day refresh token (rotated)
  expiresIn: 900; // seconds
}

// Errors
// 401: Invalid or expired refresh token
// 403: Session revoked
```

**GET /api/v1/auth/sessions**
```typescript
// List all active sessions for current user

// Response
{
  sessions: Array<{
    id: string;
    deviceName: string;
    deviceType: 'desktop' | 'mobile' | 'tablet' | 'api';
    os: string;
    browser: string;
    ipAddress: string;
    location: {
      city: string;
      country: string;
    };
    createdAt: string;
    lastActivityAt: string;
    isCurrent: boolean; // Is this the current session?
    isSuspicious: boolean;
  }>;
  total: number;
}
```

**DELETE /api/v1/auth/sessions/:sessionId**
```typescript
// Revoke a specific session

// Response
{
  success: true;
  message: "Session revoked successfully";
}

// Errors
// 404: Session not found
// 403: Cannot revoke session belonging to another user
```

**POST /api/v1/auth/sessions/revoke-all**
```typescript
// Sign out everywhere (revoke all sessions except current)

// Request (optional)
{
  includeCurrentSession?: boolean; // Default: false
}

// Response
{
  success: true;
  sessionsRevoked: number;
}
```

**GET /api/v1/auth/sessions/:sessionId/activity**
```typescript
// Get activity log for a specific session

// Query params
{
  limit?: number; // Default: 50
  offset?: number;
}

// Response
{
  activities: Array<{
    id: string;
    activityType: string;
    endpoint: string;
    method: string;
    statusCode: number;
    ipAddress: string;
    createdAt: string;
  }>;
  total: number;
}
```

#### Device Management Endpoints

**GET /api/v1/auth/devices**
```typescript
// List all registered devices

// Response
{
  devices: Array<{
    id: string;
    deviceName: string;
    deviceType: string;
    os: string;
    browser: string;
    trusted: boolean;
    lastSeenAt: string;
    createdAt: string;
  }>;
  total: number;
}
```

**PATCH /api/v1/auth/devices/:deviceId**
```typescript
// Update device (rename or trust)

// Request
{
  deviceName?: string;
  trusted?: boolean;
}

// Response: Updated device
```

**DELETE /api/v1/auth/devices/:deviceId**
```typescript
// Remove device from registry (revokes all sessions from this device)

// Response
{
  success: true;
  sessionsRevoked: number;
}
```

#### Admin Endpoints

**POST /api/v1/admin/users/:userId/sessions/revoke-all**
```typescript
// Force revoke all sessions for a user (admin/security action)

// Request
{
  reason: string;
}

// Response
{
  success: true;
  sessionsRevoked: number;
}
```

**GET /api/v1/organizations/:orgId/session-policy**
```typescript
// Get organization session policy

// Response: SessionPolicy object
```

**PATCH /api/v1/organizations/:orgId/session-policy**
```typescript
// Update organization session policy

// Request
{
  accessTokenLifetimeMinutes?: number;
  refreshTokenLifetimeDays?: number;
  inactivityTimeoutDays?: number;
  maxConcurrentSessions?: number;
  requireMfa?: boolean;
  enforceIpAllowlist?: boolean;
  ipAllowlist?: string[];
}

// Response: Updated policy
```

### 3. Business Logic

#### Session Service

```typescript
/**
 * @prompt-id forge-v4.1:feature:session:service
 * @generated-at 2026-01-20T00:00:00Z
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { UAParser } from 'ua-parser-js';
import geoip from 'geoip-lite';

interface TokenPayload {
  userId: string;
  organizationId?: string;
  jti: string; // JWT ID
  type: 'access' | 'refresh';
}

export class SessionService {
  private readonly ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET;
  private readonly REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET;

  /**
   * Create new session with access + refresh tokens
   */
  async createSession(
    userId: string,
    organizationId: string | null,
    request: {
      ipAddress: string;
      userAgent: string;
    }
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    session: UserSession;
  }> {
    // Get session policy
    const policy = organizationId
      ? await db.sessionPolicy.findUnique({
          where: { organizationId },
        })
      : null;

    // Check max concurrent sessions
    if (policy?.maxConcurrentSessions) {
      const activeSessions = await db.userSession.count({
        where: {
          userId,
          organizationId,
          revokedAt: null,
        },
      });

      if (activeSessions >= policy.maxConcurrentSessions) {
        throw new Error(
          `Maximum concurrent sessions (${policy.maxConcurrentSessions}) reached`
        );
      }
    }

    // Parse device info
    const deviceInfo = this.parseDeviceInfo(request.userAgent);
    const location = this.getLocation(request.ipAddress);

    // Check if suspicious (new location/device)
    const isSuspicious = await this.detectSuspiciousActivity(
      userId,
      request.ipAddress,
      deviceInfo
    );

    // Generate tokens
    const accessTokenJti = crypto.randomBytes(32).toString('hex');
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    // Token lifetimes
    const accessTokenLifetime =
      (policy?.accessTokenLifetimeMinutes || 15) * 60;
    const refreshTokenLifetime =
      (policy?.refreshTokenLifetimeDays || 30) * 24 * 60 * 60;

    // Create access token
    const accessToken = jwt.sign(
      {
        userId,
        organizationId,
        jti: accessTokenJti,
        type: 'access',
      } as TokenPayload,
      this.ACCESS_TOKEN_SECRET,
      { expiresIn: accessTokenLifetime }
    );

    // Create session record
    const session = await db.userSession.create({
      data: {
        userId,
        organizationId,
        accessTokenJti,
        refreshTokenHash,
        deviceType: deviceInfo.deviceType,
        deviceName: deviceInfo.deviceName,
        os: deviceInfo.os,
        browser: deviceInfo.browser,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        countryCode: location.countryCode,
        city: location.city,
        latitude: location.latitude,
        longitude: location.longitude,
        expiresAt: new Date(Date.now() + refreshTokenLifetime * 1000),
        isSuspicious,
      },
    });

    // Log activity
    await this.logActivity({
      sessionId: session.id,
      userId,
      activityType: 'login',
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      statusCode: 200,
    });

    // Register device
    await this.registerDevice(userId, request.userAgent, request.ipAddress);

    return {
      accessToken,
      refreshToken: `${session.id}.${refreshToken}`, // Include session ID for lookup
      session,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshSession(
    refreshToken: string,
    request: { ipAddress: string; userAgent: string }
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Parse refresh token
    const [sessionId, token] = refreshToken.split('.');
    if (!sessionId || !token) {
      throw new Error('Invalid refresh token format');
    }

    // Hash token for lookup
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find session
    const session = await db.userSession.findFirst({
      where: {
        id: sessionId,
        refreshTokenHash: tokenHash,
        revokedAt: null,
      },
      include: { user: true },
    });

    if (!session) {
      throw new Error('Invalid or revoked refresh token');
    }

    // Check expiration
    if (session.expiresAt < new Date()) {
      await this.revokeSession(session.id, 'expired');
      throw new Error('Refresh token expired');
    }

    // Check inactivity
    const policy = session.organizationId
      ? await db.sessionPolicy.findUnique({
          where: { organizationId: session.organizationId },
        })
      : null;

    const inactivityTimeout = policy?.inactivityTimeoutDays || 90;
    const inactivityDate = new Date(
      Date.now() - inactivityTimeout * 24 * 60 * 60 * 1000
    );

    if (session.lastActivityAt < inactivityDate) {
      await this.revokeSession(session.id, 'inactivity');
      throw new Error('Session expired due to inactivity');
    }

    // Rotate tokens (generate new pair)
    const newAccessTokenJti = crypto.randomBytes(32).toString('hex');
    const newRefreshToken = crypto.randomBytes(32).toString('hex');
    const newRefreshTokenHash = crypto
      .createHash('sha256')
      .update(newRefreshToken)
      .digest('hex');

    const accessTokenLifetime =
      (policy?.accessTokenLifetimeMinutes || 15) * 60;

    const newAccessToken = jwt.sign(
      {
        userId: session.userId,
        organizationId: session.organizationId,
        jti: newAccessTokenJti,
        type: 'access',
      } as TokenPayload,
      this.ACCESS_TOKEN_SECRET,
      { expiresIn: accessTokenLifetime }
    );

    // Update session
    await db.userSession.update({
      where: { id: session.id },
      data: {
        accessTokenJti: newAccessTokenJti,
        refreshTokenHash: newRefreshTokenHash,
        lastActivityAt: new Date(),
        ipAddress: request.ipAddress, // Update to new IP
      },
    });

    // Log activity
    await this.logActivity({
      sessionId: session.id,
      userId: session.userId,
      activityType: 'token_refresh',
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      statusCode: 200,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: `${session.id}.${newRefreshToken}`,
    };
  }

  /**
   * Validate access token
   */
  async validateAccessToken(token: string): Promise<TokenPayload> {
    try {
      const payload = jwt.verify(
        token,
        this.ACCESS_TOKEN_SECRET
      ) as TokenPayload;

      // Check if session is revoked
      const session = await db.userSession.findFirst({
        where: {
          accessTokenJti: payload.jti,
          revokedAt: null,
        },
      });

      if (!session) {
        throw new Error('Session revoked or not found');
      }

      return payload;
    } catch (error) {
      throw new Error('Invalid access token');
    }
  }

  /**
   * Revoke session
   */
  async revokeSession(
    sessionId: string,
    reason: string,
    revokedBy?: string
  ): Promise<void> {
    await db.userSession.update({
      where: { id: sessionId },
      data: {
        revokedAt: new Date(),
        revocationReason: reason,
        revokedBy,
      },
    });
  }

  /**
   * Revoke all sessions for user
   */
  async revokeAllSessions(
    userId: string,
    reason: string,
    excludeSessionId?: string
  ): Promise<number> {
    const result = await db.userSession.updateMany({
      where: {
        userId,
        id: excludeSessionId ? { not: excludeSessionId } : undefined,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revocationReason: reason,
      },
    });

    return result.count;
  }

  /**
   * Parse device info from user agent
   */
  private parseDeviceInfo(userAgent: string): {
    deviceType: string;
    deviceName: string;
    os: string;
    browser: string;
  } {
    const parser = new UAParser(userAgent);
    const result = parser.getResult();

    const deviceType =
      result.device.type || (result.os.name === 'iOS' || result.os.name === 'Android' ? 'mobile' : 'desktop');

    const deviceName = result.device.model
      ? `${result.device.vendor} ${result.device.model}`
      : `${result.os.name} ${result.browser.name}`;

    return {
      deviceType,
      deviceName,
      os: `${result.os.name} ${result.os.version}`,
      browser: `${result.browser.name} ${result.browser.version}`,
    };
  }

  /**
   * Get geolocation from IP
   */
  private getLocation(ipAddress: string): {
    countryCode: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
  } {
    const geo = geoip.lookup(ipAddress);

    if (!geo) {
      return {
        countryCode: null,
        city: null,
        latitude: null,
        longitude: null,
      };
    }

    return {
      countryCode: geo.country,
      city: geo.city,
      latitude: geo.ll[0],
      longitude: geo.ll[1],
    };
  }

  /**
   * Detect suspicious activity
   */
  private async detectSuspiciousActivity(
    userId: string,
    ipAddress: string,
    deviceInfo: any
  ): Promise<boolean> {
    // Get recent sessions
    const recentSessions = await db.userSession.findMany({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    if (recentSessions.length === 0) {
      return false; // First login, not suspicious
    }

    const location = this.getLocation(ipAddress);

    // Check for new location
    const knownCountries = new Set(
      recentSessions.map((s) => s.countryCode).filter(Boolean)
    );
    if (location.countryCode && !knownCountries.has(location.countryCode)) {
      return true; // New country
    }

    // Check for new device type
    const knownDeviceTypes = new Set(recentSessions.map((s) => s.deviceType));
    if (!knownDeviceTypes.has(deviceInfo.deviceType)) {
      return true; // New device type
    }

    return false;
  }

  /**
   * Register device
   */
  private async registerDevice(
    userId: string,
    userAgent: string,
    ipAddress: string
  ): Promise<void> {
    const deviceInfo = this.parseDeviceInfo(userAgent);
    const fingerprint = crypto
      .createHash('sha256')
      .update(`${userId}:${deviceInfo.deviceName}:${deviceInfo.os}`)
      .digest('hex');

    await db.deviceRegistry.upsert({
      where: { deviceFingerprint: fingerprint },
      create: {
        userId,
        deviceFingerprint: fingerprint,
        deviceName: deviceInfo.deviceName,
        deviceType: deviceInfo.deviceType,
        os: deviceInfo.os,
        browser: deviceInfo.browser,
        lastSeenAt: new Date(),
        lastIpAddress: ipAddress,
      },
      update: {
        lastSeenAt: new Date(),
        lastIpAddress: ipAddress,
      },
    });
  }

  /**
   * Log activity
   */
  private async logActivity(data: {
    sessionId: string;
    userId: string;
    activityType: string;
    endpoint?: string;
    method?: string;
    ipAddress: string;
    userAgent: string;
    statusCode: number;
    errorMessage?: string;
  }): Promise<void> {
    await db.sessionActivityLog.create({ data });
  }
}
```

### 4. UI Components

#### Active Sessions Page

**File:** `apps/web/src/app/(dashboard)/[orgSlug]/settings/sessions/page.tsx`

```typescript
/**
 * @prompt-id forge-v4.1:feature:session:sessions-page
 * @generated-at 2026-01-20T00:00:00Z
 */

'use client';

import { useState } from 'react';
import { Monitor, Smartphone, Tablet, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSessions, useRevokeSession, useRevokeAllSessions } from '@/hooks/api/sessions';
import { formatDistanceToNow } from 'date-fns';

export default function SessionsPage() {
  const { toast } = useToast();
  const { data: sessions, isLoading } = useSessions();
  const revokeMutation = useRevokeSession();
  const revokeAllMutation = useRevokeAllSessions();

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to revoke this session?')) return;

    try {
      await revokeMutation.mutateAsync(sessionId);
      toast({ title: 'Session revoked successfully' });
    } catch (error) {
      toast({
        title: 'Failed to revoke session',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleRevokeAll = async () => {
    if (
      !confirm(
        'Are you sure you want to sign out of all other sessions? This action cannot be undone.'
      )
    )
      return;

    try {
      const result = await revokeAllMutation.mutateAsync();
      toast({
        title: 'Sessions revoked',
        description: `${result.sessionsRevoked} session(s) have been signed out.`,
      });
    } catch (error) {
      toast({
        title: 'Failed to revoke sessions',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile':
        return <Smartphone className="h-5 w-5" />;
      case 'tablet':
        return <Tablet className="h-5 w-5" />;
      default:
        return <Monitor className="h-5 w-5" />;
    }
  };

  if (isLoading) {
    return <div>Loading sessions...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Active Sessions</h1>
          <p className="text-muted-foreground mt-2">
            Manage your active sessions and devices
          </p>
        </div>
        <Button
          variant="destructive"
          onClick={handleRevokeAll}
          disabled={revokeAllMutation.isPending}
        >
          Sign Out Everywhere
        </Button>
      </div>

      <div className="space-y-3">
        {sessions?.sessions.map((session) => (
          <Card
            key={session.id}
            className={`p-6 ${session.isCurrent ? 'border-primary' : ''} ${
              session.isSuspicious ? 'border-yellow-500' : ''
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex gap-4">
                <div className="mt-1">{getDeviceIcon(session.deviceType)}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{session.deviceName}</h3>
                    {session.isCurrent && (
                      <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                        Current Session
                      </span>
                    )}
                    {session.isSuspicious && (
                      <span className="text-xs bg-yellow-100 text-yellow-900 px-2 py-0.5 rounded flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Suspicious
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {session.os} • {session.browser}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {session.ipAddress} • {session.location.city},{' '}
                    {session.location.country}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Last active{' '}
                    {formatDistanceToNow(new Date(session.lastActivityAt), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>

              {!session.isCurrent && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRevokeSession(session.id)}
                  disabled={revokeMutation.isPending}
                >
                  Revoke
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {sessions?.sessions.length === 0 && (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">No active sessions</p>
        </Card>
      )}
    </div>
  );
}
```

### 5. Tests

**File:** `packages/backend/src/features/session/__tests__/session.service.test.ts`

```typescript
/**
 * @prompt-id forge-v4.1:feature:session:service-tests
 * @generated-at 2026-01-20T00:00:00Z
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionService } from '../session.service';
import { db } from '@/lib/db';
import jwt from 'jsonwebtoken';

describe('SessionService', () => {
  let sessionService: SessionService;
  let mockUser: any;
  let mockOrg: any;

  beforeEach(async () => {
    sessionService = new SessionService();

    mockUser = await db.user.create({
      data: {
        email: 'test@example.com',
        firstName: 'Test',
        authMethod: 'email',
      },
    });

    mockOrg = await db.organization.create({
      data: {
        name: 'Test Org',
        slug: 'test-org',
        planTier: 'business',
      },
    });
  });

  describe('createSession', () => {
    it('should create session with access and refresh tokens', async () => {
      const result = await sessionService.createSession(mockUser.id, mockOrg.id, {
        ipAddress: '192.168.1.1',
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0',
      });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.session).toBeDefined();
      expect(result.session.userId).toBe(mockUser.id);
      expect(result.session.deviceType).toBe('desktop');
    });

    it('should enforce max concurrent sessions policy', async () => {
      await db.sessionPolicy.create({
        data: {
          organizationId: mockOrg.id,
          maxConcurrentSessions: 1,
        },
      });

      // Create first session
      await sessionService.createSession(mockUser.id, mockOrg.id, {
        ipAddress: '192.168.1.1',
        userAgent: 'Chrome',
      });

      // Try to create second session (should fail)
      await expect(
        sessionService.createSession(mockUser.id, mockOrg.id, {
          ipAddress: '192.168.1.2',
          userAgent: 'Safari',
        })
      ).rejects.toThrow('Maximum concurrent sessions');
    });

    it('should detect suspicious activity for new location', async () => {
      // Create first session from US
      await sessionService.createSession(mockUser.id, mockOrg.id, {
        ipAddress: '8.8.8.8', // US IP
        userAgent: 'Chrome',
      });

      // Create second session from different country
      const result = await sessionService.createSession(
        mockUser.id,
        mockOrg.id,
        {
          ipAddress: '103.21.244.0', // Australia IP
          userAgent: 'Chrome',
        }
      );

      expect(result.session.isSuspicious).toBe(true);
    });
  });

  describe('refreshSession', () => {
    it('should refresh tokens and rotate refresh token', async () => {
      const { refreshToken: oldRefreshToken } =
        await sessionService.createSession(mockUser.id, mockOrg.id, {
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome',
        });

      const result = await sessionService.refreshSession(oldRefreshToken, {
        ipAddress: '192.168.1.1',
        userAgent: 'Chrome',
      });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken).not.toBe(oldRefreshToken); // Token rotated
    });

    it('should reject expired refresh token', async () => {
      const { refreshToken, session } = await sessionService.createSession(
        mockUser.id,
        mockOrg.id,
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome',
        }
      );

      // Manually expire session
      await db.userSession.update({
        where: { id: session.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await expect(
        sessionService.refreshSession(refreshToken, {
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome',
        })
      ).rejects.toThrow('expired');
    });

    it('should reject inactive session', async () => {
      const { refreshToken, session } = await sessionService.createSession(
        mockUser.id,
        mockOrg.id,
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome',
        }
      );

      // Set policy with short inactivity timeout
      await db.sessionPolicy.create({
        data: {
          organizationId: mockOrg.id,
          inactivityTimeoutDays: 1,
        },
      });

      // Set last activity to 2 days ago
      await db.userSession.update({
        where: { id: session.id },
        data: {
          lastActivityAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
      });

      await expect(
        sessionService.refreshSession(refreshToken, {
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome',
        })
      ).rejects.toThrow('inactivity');
    });
  });

  describe('validateAccessToken', () => {
    it('should validate valid access token', async () => {
      const { accessToken } = await sessionService.createSession(
        mockUser.id,
        mockOrg.id,
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome',
        }
      );

      const payload = await sessionService.validateAccessToken(accessToken);

      expect(payload.userId).toBe(mockUser.id);
      expect(payload.organizationId).toBe(mockOrg.id);
    });

    it('should reject revoked session token', async () => {
      const { accessToken, session } = await sessionService.createSession(
        mockUser.id,
        mockOrg.id,
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome',
        }
      );

      // Revoke session
      await sessionService.revokeSession(session.id, 'test');

      await expect(
        sessionService.validateAccessToken(accessToken)
      ).rejects.toThrow('revoked');
    });
  });

  describe('revokeAllSessions', () => {
    it('should revoke all sessions except current', async () => {
      // Create 3 sessions
      const session1 = await sessionService.createSession(
        mockUser.id,
        mockOrg.id,
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome',
        }
      );

      const session2 = await sessionService.createSession(
        mockUser.id,
        mockOrg.id,
        {
          ipAddress: '192.168.1.2',
          userAgent: 'Safari',
        }
      );

      const session3 = await sessionService.createSession(
        mockUser.id,
        mockOrg.id,
        {
          ipAddress: '192.168.1.3',
          userAgent: 'Firefox',
        }
      );

      // Revoke all except session1
      const count = await sessionService.revokeAllSessions(
        mockUser.id,
        'sign_out_all',
        session1.session.id
      );

      expect(count).toBe(2);

      // Verify session1 still active
      const active1 = await db.userSession.findUnique({
        where: { id: session1.session.id },
      });
      expect(active1.revokedAt).toBeNull();

      // Verify session2 and session3 revoked
      const revoked2 = await db.userSession.findUnique({
        where: { id: session2.session.id },
      });
      expect(revoked2.revokedAt).not.toBeNull();
    });
  });
});
```

---

## Implementation Plan

### Week 1
**Days 1-2:** Database schema and migrations
**Days 3-4:** SessionService implementation (token generation, validation, rotation)
**Days 4-5:** Session endpoints (list, revoke, revoke-all)
**Day 5:** Device registry and fingerprinting

### Testing
**Throughout:** Write unit tests alongside implementation
**End of week:** Integration tests with mock requests

---

## Security Considerations

1. **Token Security**
   - Short-lived access tokens (15 min)
   - Secure refresh token rotation
   - Store refresh tokens as SHA-256 hashes
   - Use crypto.timingSafeEqual for comparisons

2. **Session Hijacking Prevention**
   - Bind sessions to IP + user agent (with tolerance for mobile)
   - Flag suspicious sessions
   - Support forced revocation

3. **Token Revocation**
   - Instant revocation via database lookup
   - Blacklist compromised JTIs
   - Admin override capabilities

4. **Data Privacy**
   - Hash device fingerprints
   - Encrypt session metadata
   - GDPR-compliant data retention (90 days)

---

## Performance Considerations

1. **Token Validation**
   - JWT verification is CPU-bound: <1ms
   - Database lookup for revocation: <5ms with index
   - Redis cache for revoked JTIs: <1ms

2. **Session Listing**
   - Index on `(user_id, revoked_at)`
   - Paginate results (default 50)
   - Cache device registry

3. **Cleanup Jobs**
   - Daily cron: Delete sessions expired >90 days
   - Hourly: Mark inactive sessions for review

---

## Open Questions

1. **Session Transfer:** Allow session transfer between devices? (Answer: No, security risk)
2. **Token Rotation:** Rotate on every request vs. on refresh? (Answer: On refresh only)
3. **Suspicious Sessions:** Auto-revoke or just flag? (Answer: Flag + notify user)

---

## Success Metrics

- Zero session-related security incidents
- <10ms token validation latency (P95)
- 99.99% session service uptime
- <5% false positive suspicious session rate

---

**Status:** Ready for implementation
