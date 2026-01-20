# Feature: Authentication System

**Feature ID:** FF-005
**Version:** 1.0
**Status:** Draft
**Owner:** Engineering Team
**Dependencies:** None (foundational)
**Estimated Effort:** 3 weeks

---

## Overview

Complete authentication system with email/password, MFA, OAuth social logins, password reset, and email verification. Foundation for all user-facing features.

### User Story
> As a **user**, I want to **securely sign up and log in** so that **I can access my repositories and settings**.

### Success Criteria
- ✓ Email/password registration and login
- ✓ Email verification required before access
- ✓ MFA (TOTP) optional but encouraged
- ✓ Password reset via email
- ✓ Session management with JWT + refresh tokens
- ✓ Social OAuth (GitHub, Google) for quick signup

---

## Vertical Slice Architecture

### 1. Database Schema

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  password_hash TEXT, -- NULL for OAuth-only users
  name VARCHAR(255),
  avatar_url TEXT,

  -- MFA
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_secret TEXT, -- Encrypted TOTP secret
  backup_codes TEXT[], -- Encrypted backup codes

  -- Account status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email) WHERE status = 'active';

-- OAuth connections
CREATE TABLE oauth_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'github', 'google', 'microsoft'
  provider_user_id VARCHAR(255) NOT NULL,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  expires_at TIMESTAMPTZ,
  scope TEXT[],
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(provider, provider_user_id)
);

CREATE INDEX idx_oauth_user ON oauth_connections(user_id);

-- Email verification tokens
CREATE TABLE email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_verification_token ON email_verification_tokens(token, expires_at);

-- Password reset tokens
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reset_token ON password_reset_tokens(token, expires_at) WHERE used_at IS NULL;

-- Password history (for reuse prevention)
CREATE TABLE password_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_history_user ON password_history(user_id, created_at DESC);

-- Sessions (for tracking and invalidation)
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash VARCHAR(64) UNIQUE NOT NULL,
  device_info JSONB,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON user_sessions(user_id, created_at DESC);
CREATE INDEX idx_sessions_token ON user_sessions(refresh_token_hash) WHERE revoked_at IS NULL;
```

### 2. API Endpoints

```typescript
// types/auth.ts
export interface SignUpRequest {
  email: string;
  password: string;
  name: string;
}

export interface SignUpResponse {
  user: {
    id: string;
    email: string;
    name: string;
    emailVerified: boolean;
  };
  message: string; // "Please check your email to verify your account"
}

export interface SignInRequest {
  email: string;
  password: string;
  mfaCode?: string;
}

export interface SignInResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  requiresMfa: boolean;
}

export interface MfaSetupResponse {
  secret: string;
  qrCode: string; // Data URL
  backupCodes: string[];
}

// routes/auth.ts
export async function authRoutes(fastify: FastifyInstance) {

  // Sign up
  fastify.post('/api/v1/auth/signup', {
    schema: {
      body: z.object({
        email: z.string().email(),
        password: z.string().min(12).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/),
        name: z.string().min(1).max(255),
      }),
    },
  }, async (request, reply) => {
    const { email, password, name } = request.body;

    // Check if user exists
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return reply.code(400).send({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await db.user.create({
      data: { email, passwordHash, name },
    });

    // Generate verification token
    const token = crypto.randomBytes(32).toString('hex');
    await db.emailVerificationToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    // Send verification email
    await sendEmail({
      to: email,
      subject: 'Verify your email',
      template: 'email-verification',
      data: {
        name,
        verificationUrl: `${APP_URL}/auth/verify-email?token=${token}`,
      },
    });

    return reply.code(201).send({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: false,
      },
      message: 'Please check your email to verify your account',
    });
  });

  // Sign in
  fastify.post('/api/v1/auth/signin', async (request, reply) => {
    const { email, password, mfaCode } = request.body;

    // Find user
    const user = await db.user.findUnique({
      where: { email, status: 'active' },
    });

    if (!user || !user.passwordHash) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    // Check email verification
    if (!user.emailVerified) {
      return reply.code(403).send({ error: 'Please verify your email first' });
    }

    // Check MFA
    if (user.mfaEnabled) {
      if (!mfaCode) {
        return reply.code(200).send({ requiresMfa: true });
      }

      const valid = await verifyTOTP(user.mfaSecret, mfaCode);
      if (!valid) {
        return reply.code(401).send({ error: 'Invalid MFA code' });
      }
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();

    // Store session
    await db.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashToken(refreshToken),
        deviceInfo: request.headers['user-agent'],
        ipAddress: request.ip,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    // Update last login
    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken,
      refreshToken,
      user: sanitizeUser(user),
      requiresMfa: false,
    };
  });

  // Verify email
  fastify.get('/api/v1/auth/verify-email', async (request, reply) => {
    const { token } = request.query as { token: string };

    const verification = await db.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!verification || verification.expiresAt < new Date()) {
      return reply.code(400).send({ error: 'Invalid or expired token' });
    }

    // Mark email as verified
    await db.user.update({
      where: { id: verification.userId },
      data: { emailVerified: true },
    });

    // Delete token
    await db.emailVerificationToken.delete({
      where: { id: verification.id },
    });

    return { message: 'Email verified successfully' };
  });

  // Request password reset
  fastify.post('/api/v1/auth/forgot-password', async (request, reply) => {
    const { email } = request.body;

    const user = await db.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user) {
      return { message: 'If that email exists, a reset link has been sent' };
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString('hex');
    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    // Send email
    await sendEmail({
      to: email,
      subject: 'Reset your password',
      template: 'password-reset',
      data: {
        name: user.name,
        resetUrl: `${APP_URL}/auth/reset-password?token=${token}`,
      },
    });

    return { message: 'If that email exists, a reset link has been sent' };
  });

  // Reset password
  fastify.post('/api/v1/auth/reset-password', async (request, reply) => {
    const { token, password } = request.body;

    const resetToken = await db.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken || resetToken.expiresAt < new Date() || resetToken.usedAt) {
      return reply.code(400).send({ error: 'Invalid or expired token' });
    }

    // Check password history (prevent reuse)
    const history = await db.passwordHistory.findMany({
      where: { userId: resetToken.userId },
      orderBy: { createdAt: 'desc' },
      take: 24,
    });

    for (const old of history) {
      if (await bcrypt.compare(password, old.passwordHash)) {
        return reply.code(400).send({
          error: 'Cannot reuse recent passwords'
        });
      }
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Update user
    await db.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });

    // Save to history
    await db.passwordHistory.create({
      data: {
        userId: resetToken.userId,
        passwordHash,
      },
    });

    // Mark token as used
    await db.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    });

    // Revoke all sessions
    await db.userSession.updateMany({
      where: { userId: resetToken.userId },
      data: { revokedAt: new Date() },
    });

    return { message: 'Password reset successfully' };
  });

  // Setup MFA
  fastify.post('/api/v1/auth/mfa/setup', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = request.user.id;

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Forge Factory (${request.user.email})`,
      issuer: 'Forge Factory',
    });

    // Generate QR code
    const qrCode = await qrcode.toDataURL(secret.otpauth_url);

    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString('hex')
    );

    // Store encrypted
    await db.user.update({
      where: { id: userId },
      data: {
        mfaSecret: await encrypt(secret.base32),
        backupCodes: await Promise.all(
          backupCodes.map(code => bcrypt.hash(code, 10))
        ),
      },
    });

    return {
      secret: secret.base32,
      qrCode,
      backupCodes,
    };
  });

  // Enable MFA
  fastify.post('/api/v1/auth/mfa/enable', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { code } = request.body;
    const userId = request.user.id;

    const user = await db.user.findUnique({ where: { id: userId } });

    if (!user.mfaSecret) {
      return reply.code(400).send({ error: 'MFA not set up' });
    }

    // Verify code
    const secret = await decrypt(user.mfaSecret);
    const valid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!valid) {
      return reply.code(400).send({ error: 'Invalid code' });
    }

    // Enable MFA
    await db.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });

    return { message: 'MFA enabled successfully' };
  });

  // Refresh token
  fastify.post('/api/v1/auth/refresh', async (request, reply) => {
    const { refreshToken } = request.body;

    const tokenHash = hashToken(refreshToken);
    const session = await db.userSession.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date() || session.revokedAt) {
      return reply.code(401).send({ error: 'Invalid refresh token' });
    }

    // Generate new access token
    const accessToken = generateAccessToken(session.user);

    return { accessToken };
  });

  // Sign out
  fastify.post('/api/v1/auth/signout', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { refreshToken } = request.body;

    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await db.userSession.update({
        where: { refreshTokenHash: tokenHash },
        data: { revokedAt: new Date() },
      });
    }

    return { message: 'Signed out successfully' };
  });

  // OAuth GitHub
  fastify.get('/api/v1/auth/oauth/github', async (request, reply) => {
    const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=user:email`;
    return reply.redirect(url);
  });

  fastify.get('/api/v1/auth/oauth/github/callback', async (request, reply) => {
    const { code } = request.query as { code: string };

    // Exchange code for token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const { access_token } = await tokenResponse.json();

    // Get user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const githubUser = await userResponse.json();

    // Find or create user
    let connection = await db.oauthConnection.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'github',
          providerUserId: githubUser.id.toString(),
        },
      },
      include: { user: true },
    });

    if (!connection) {
      // Create new user
      const user = await db.user.create({
        data: {
          email: githubUser.email,
          emailVerified: true, // Trust GitHub
          name: githubUser.name || githubUser.login,
          avatarUrl: githubUser.avatar_url,
        },
      });

      connection = await db.oauthConnection.create({
        data: {
          userId: user.id,
          provider: 'github',
          providerUserId: githubUser.id.toString(),
          accessTokenEncrypted: await encrypt(access_token),
        },
        include: { user: true },
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(connection.user);
    const refreshToken = generateRefreshToken();

    // Redirect to app with tokens
    return reply.redirect(`${APP_URL}/auth/callback?access_token=${accessToken}&refresh_token=${refreshToken}`);
  });
}
```

### 3. UI Components

```typescript
// app/(auth)/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GithubIcon } from 'lucide-react';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export default function LoginPage() {
  const router = useRouter();
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [mfaCode, setMfaCode] = useState('');

  const form = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: z.infer<typeof schema>) => {
    const response = await fetch('/api/v1/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, mfaCode }),
    });

    if (response.ok) {
      const result = await response.json();

      if (result.requiresMfa) {
        setRequiresMfa(true);
        return;
      }

      localStorage.setItem('auth-token', result.accessToken);
      localStorage.setItem('refresh-token', result.refreshToken);
      router.push('/dashboard');
    }
  };

  if (requiresMfa) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Enter MFA Code</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="6-digit code"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value)}
            maxLength={6}
          />
          <Button onClick={() => onSubmit(form.getValues())} className="mt-4 w-full">
            Verify
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Sign In</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <Input {...field} type="email" />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <Input {...field} type="password" />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full">
                Sign In
              </Button>
            </form>
          </Form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <Button variant="outline" className="w-full" onClick={() => {
            window.location.href = '/api/v1/auth/oauth/github';
          }}>
            <GithubIcon className="mr-2 h-4 w-4" />
            Continue with GitHub
          </Button>

          <div className="text-center text-sm">
            <a href="/auth/forgot-password" className="text-primary hover:underline">
              Forgot password?
            </a>
            {' · '}
            <a href="/auth/signup" className="text-primary hover:underline">
              Sign up
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

### 4. Tests

```typescript
describe('Authentication', () => {
  it('signs up new user', async () => {
    const response = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: 'Test User',
      });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe('test@example.com');
  });

  it('requires email verification', async () => {
    // Sign up
    await request(app).post('/api/v1/auth/signup').send({
      email: 'test@example.com',
      password: 'SecurePass123!',
      name: 'Test User',
    });

    // Try to sign in without verification
    const response = await request(app)
      .post('/api/v1/auth/signin')
      .send({
        email: 'test@example.com',
        password: 'SecurePass123!',
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('verify your email');
  });

  it('enforces MFA when enabled', async () => {
    const user = await createVerifiedUser();
    await enableMFA(user.id);

    const response = await request(app)
      .post('/api/v1/auth/signin')
      .send({
        email: user.email,
        password: 'SecurePass123!',
      });

    expect(response.status).toBe(200);
    expect(response.body.requiresMfa).toBe(true);
  });
});
```

---

## Implementation Plan

- **Week 1:** Database schema, basic auth endpoints (signup, signin)
- **Week 2:** Email verification, password reset, MFA
- **Week 3:** OAuth (GitHub, Google), UI components, tests

---

**Status:** Ready for implementation
