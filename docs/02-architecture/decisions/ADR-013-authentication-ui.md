# ADR-013: Authentication and Authorization UI

## Status
Accepted

## Context
Forge Factory needs a comprehensive authentication system supporting:
- Email/password authentication
- Social login (Google, GitHub)
- SSO (Single Sign-On) with SAML 2.0
- Two-factor authentication (2FA/MFA)
- Magic link login (passwordless)
- Password reset and recovery
- Email verification
- Session management
- Remember me functionality
- Account linking (multiple auth methods)
- Secure by default (OWASP compliance)

## Decision
We will build a **flexible authentication system** using **Next-Auth (Auth.js)** as the foundation, with custom extensions for enterprise features like SAML SSO and MFA.

### Authentication Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Authentication System Architecture               │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Authentication UI                                     │ │
│  │  - Login Page                                          │ │
│  │  - Signup Page                                         │ │
│  │  - SSO Selection                                       │ │
│  │  - MFA Verification                                    │ │
│  │  - Password Reset                                      │ │
│  └────────────────────────────────────────────────────────┘ │
│                         ↓                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Auth Layer (Next-Auth/Auth.js)                        │ │
│  │  - Session management                                  │ │
│  │  - Provider orchestration                              │ │
│  │  - Callback handling                                   │ │
│  │  - JWT/Session tokens                                  │ │
│  └────────────────────────────────────────────────────────┘ │
│                         ↓                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Authentication Providers                              │ │
│  │  - Credentials (email/password)                        │ │
│  │  - OAuth (Google, GitHub, etc.)                        │ │
│  │  - SAML 2.0 (Enterprise SSO)                           │ │
│  │  - Magic Link                                          │ │
│  └────────────────────────────────────────────────────────┘ │
│                         ↓                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Security Layer                                        │ │
│  │  - Password hashing (bcrypt/argon2)                    │ │
│  │  - 2FA/MFA (TOTP)                                      │ │
│  │  - Rate limiting                                       │ │
│  │  - Suspicious activity detection                       │ │
│  └────────────────────────────────────────────────────────┘ │
│                         ↓                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Storage (PostgreSQL)                                  │ │
│  │  - Users, accounts, sessions                           │ │
│  │  - Verification tokens                                 │ │
│  │  - Audit logs                                          │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

## Implementation

### 1. Next-Auth Configuration

```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth';
import { SAMLProvider } from '@/lib/auth/saml-provider';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    // Email/Password
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Missing credentials');
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { memberships: true },
        });

        if (!user || !user.passwordHash) {
          throw new Error('Invalid credentials');
        }

        const isValid = await verifyPassword(
          credentials.password,
          user.passwordHash,
        );

        if (!isValid) {
          throw new Error('Invalid credentials');
        }

        // Check if 2FA is enabled
        if (user.twoFactorEnabled) {
          // Return user with 2FA flag
          return {
            ...user,
            requires2FA: true,
          };
        }

        return user;
      },
    }),

    // Google OAuth
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),

    // GitHub OAuth
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),

    // SAML SSO (custom provider)
    SAMLProvider({
      id: 'saml',
      name: 'SSO',
      type: 'oauth',
      // SAML configuration
    }),
  ],
  pages: {
    signIn: '/login',
    signOut: '/logout',
    error: '/auth/error',
    verifyRequest: '/auth/verify',
    newUser: '/onboarding',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Email verification check
      if (account?.provider === 'credentials' && !user.emailVerified) {
        throw new Error('Please verify your email first');
      }

      // Log sign-in
      await prisma.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          action: 'ACCESS',
          resourceType: 'ORGANIZATION',
          resourceId: user.tenantId,
        },
      });

      return true;
    },
    async jwt({ token, user, account, trigger }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.tenantId = user.tenantId;
        token.role = user.role;
        token.requires2FA = user.requires2FA;
      }

      // Refresh user data on update
      if (trigger === 'update') {
        const updatedUser = await prisma.user.findUnique({
          where: { id: token.id as string },
        });

        if (updatedUser) {
          token.name = updatedUser.name;
          token.email = updatedUser.email;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.tenantId = token.tenantId as string;
        session.user.role = token.role as string;
        session.user.requires2FA = token.requires2FA as boolean;
      }

      return session;
    },
  },
  events: {
    async signIn({ user }) {
      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

### 2. Login Page

```tsx
// app/(auth)/login/page.tsx
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const callbackUrl = searchParams?.get('callbackUrl') || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
      } else if (result?.ok) {
        router.push(callbackUrl);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = (provider: 'google' | 'github') => {
    signIn(provider, { callbackUrl });
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-muted-foreground mt-2">
            Sign in to your Forge Factory account
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/auth/forgot-password"
                className="text-sm text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </Button>
        </form>

        <div className="relative my-6">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-sm text-muted-foreground">
            Or continue with
          </span>
        </div>

        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => handleSocialLogin('google')}
            disabled={isLoading}
          >
            <GoogleIcon className="mr-2 h-4 w-4" />
            Google
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => handleSocialLogin('github')}
            disabled={isLoading}
          >
            <GitHubIcon className="mr-2 h-4 w-4" />
            GitHub
          </Button>
        </div>

        <div className="mt-6 text-center text-sm">
          Don't have an account?{' '}
          <Link href="/signup" className="text-primary hover:underline">
            Sign up
          </Link>
        </div>

        <div className="mt-4 text-center">
          <Link
            href="/auth/sso"
            className="text-sm text-muted-foreground hover:underline"
          >
            Sign in with SSO
          </Link>
        </div>
      </Card>
    </div>
  );
}
```

### 3. Signup Page

```tsx
// app/(auth)/signup/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  confirmPassword: z.string(),
  acceptTerms: z.boolean().refine((val) => val === true, {
    message: 'You must accept the terms and conditions',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type SignupFormData = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupFormData) => {
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Signup failed');
      }

      // Redirect to email verification
      router.push('/auth/verify?email=' + encodeURIComponent(data.email));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-muted-foreground mt-2">
            Get started with Forge Factory
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            {error}
          </Alert>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              placeholder="John Doe"
              {...form.register('name')}
              disabled={isLoading}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive mt-1">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              {...form.register('email')}
              disabled={isLoading}
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive mt-1">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              {...form.register('password')}
              disabled={isLoading}
            />
            {form.formState.errors.password && (
              <p className="text-sm text-destructive mt-1">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              {...form.register('confirmPassword')}
              disabled={isLoading}
            />
            {form.formState.errors.confirmPassword && (
              <p className="text-sm text-destructive mt-1">
                {form.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="acceptTerms"
              {...form.register('acceptTerms')}
              disabled={isLoading}
            />
            <label
              htmlFor="acceptTerms"
              className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I accept the{' '}
              <Link href="/terms" className="text-primary hover:underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
            </label>
          </div>
          {form.formState.errors.acceptTerms && (
            <p className="text-sm text-destructive mt-1">
              {form.formState.errors.acceptTerms.message}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              'Create account'
            )}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm">
          Already have an account?{' '}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </Card>
    </div>
  );
}
```

### 4. SSO Configuration Page

```tsx
// app/(auth)/sso/page.tsx
'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { signIn } from 'next-auth/react';

export default function SSOPage() {
  const [domain, setDomain] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Sign in with SAML using the organization domain
    signIn('saml', {
      callbackUrl: '/dashboard',
      domain,
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Enterprise SSO</h1>
          <p className="text-muted-foreground mt-2">
            Sign in with your organization's SSO
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="domain">Organization Domain</Label>
            <Input
              id="domain"
              type="text"
              placeholder="your-company.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              required
            />
            <p className="text-sm text-muted-foreground mt-1">
              Enter your company's domain to continue
            </p>
          </div>

          <Button type="submit" className="w-full">
            Continue with SSO
          </Button>
        </form>

        <div className="mt-6 text-center text-sm">
          <Link href="/login" className="text-muted-foreground hover:underline">
            Back to login
          </Link>
        </div>
      </Card>
    </div>
  );
}
```

### 5. Protected Route Middleware

```typescript
// middleware.ts
import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Check 2FA requirement
    if (token?.requires2FA && !pathname.startsWith('/auth/2fa')) {
      return NextResponse.redirect(new URL('/auth/2fa', req.url));
    }

    // Check permissions for admin routes
    if (pathname.startsWith('/admin') && token?.role !== 'OWNER' && token?.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/tasks/:path*',
    '/workflows/:path*',
    '/agents/:path*',
    '/admin/:path*',
  ],
};
```

## Security Features

### Password Requirements
- Minimum 8 characters
- Must contain uppercase, lowercase, and number
- Hashed with bcrypt/argon2
- Password strength indicator

### Two-Factor Authentication
- TOTP-based (Google Authenticator, Authy)
- Backup codes
- SMS fallback (optional)

### Rate Limiting
- Login attempts: 5 per 15 minutes
- Password reset: 3 per hour
- API requests: Per-user quotas

### Session Security
- Secure HTTP-only cookies
- CSRF protection
- Session timeout after inactivity
- Concurrent session limits

### Audit Logging
- All authentication events logged
- IP address tracking
- Suspicious activity alerts
- Exportable for compliance

## Consequences

### Positive
- **Flexible**: Multiple authentication methods
- **Secure**: Industry best practices
- **Enterprise-ready**: SSO, SAML, MFA
- **User-friendly**: Social login, magic links

### Negative
- **Complexity**: Multiple auth flows to maintain
- **Cost**: Email sending, SMS for 2FA

### Mitigations
- **Testing**: Comprehensive auth flow tests
- **Documentation**: Clear setup guides
- **Monitoring**: Track auth success/failure rates

## Alternatives Considered

### 1. Third-party Auth (Auth0, Clerk)
**Rejected**: Cost, less control, vendor lock-in.

### 2. Roll Our Own
**Rejected**: Too risky, security is hard to get right.

### 3. Firebase Auth
**Rejected**: Vendor lock-in, less flexible.

## References
- [Next-Auth Documentation](https://next-auth.js.org/)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [SAML 2.0](https://docs.oasis-open.org/security/saml/Post2.0/sstc-saml-tech-overview-2.0.html)

## Review Date
2024-05-16 (3 months)
