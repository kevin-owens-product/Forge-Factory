/**
 * @package @forge/auth
 * @description Comprehensive tests for the authentication library
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  // Services
  TokenService,
  PasswordService,
  SessionService,
  MfaService,
  MfaChallengeManager,
  AuthService,

  // Storage
  InMemorySessionStorage,

  // Providers
  LocalAuthProvider,
  OAuthProvider,
  AuthProviderRegistry,
  createLocalProvider,
  createGoogleProvider,
  createGitHubProvider,
  createMicrosoftProvider,

  // Utilities
  getSessionCookieOptions,
  getClearSessionCookieOptions,

  // Types
  UserIdentity,
  StoredUser,
  TokenPayload,
  Session,
  DEFAULT_AUTH_CONFIG,
  JwtInterface,
  BcryptInterface,
  OtpAuthenticator,
  QrCodeGenerator,
  OAuthUserProvisionCallback,
} from '../src';

// ============================================================================
// Mock implementations
// ============================================================================

const createMockJwt = (): JwtInterface => ({
  sign: vi.fn((payload, _secret, options) => {
    const now = Math.floor(Date.now() / 1000);
    return JSON.stringify({
      ...payload,
      iat: now,
      exp: now + 3600,
      iss: options?.issuer,
      aud: options?.audience,
      jti: options?.jwtid,
    });
  }),
  verify: vi.fn((token, _secret, _options) => {
    try {
      return JSON.parse(token);
    } catch {
      throw new Error('Invalid token');
    }
  }),
  decode: vi.fn((token, options) => {
    try {
      const payload = JSON.parse(token);
      if (options?.complete) {
        return { header: { alg: 'HS256', typ: 'JWT' }, payload, signature: 'sig' };
      }
      return payload;
    } catch {
      return null;
    }
  }),
});

const createMockBcrypt = (): BcryptInterface => ({
  hash: vi.fn(async (data: string, _saltOrRounds: string | number) => {
    return `hashed:${data}`;
  }),
  compare: vi.fn(async (data: string, encrypted: string) => {
    return encrypted === `hashed:${data}`;
  }),
  genSalt: vi.fn(async (_rounds?: number) => {
    return 'mock-salt';
  }),
});

const createMockAuthenticator = (): OtpAuthenticator => ({
  generate: vi.fn(() => '123456'),
  check: vi.fn((token: string) => token === '123456'),
  verify: vi.fn(({ token }) => token === '123456'),
  generateSecret: vi.fn(() => 'JBSWY3DPEHPK3PXPMOCK'),
  keyuri: vi.fn((user, service, secret) => `otpauth://totp/${service}:${user}?secret=${secret}&issuer=${service}`),
  options: { digits: 6, step: 30, window: 1 },
});

const createMockQrGenerator = (): QrCodeGenerator => ({
  toDataURL: vi.fn(async (text: string) => `data:image/png;base64,mock-qr-code-for-${text}`),
});

const createMockUser = (overrides: Partial<StoredUser> = {}): StoredUser => ({
  id: 'user-123',
  email: 'test@example.com',
  username: 'testuser',
  passwordHash: 'hashed:ValidPassword123!',
  tenantId: 'tenant-1',
  roles: ['user'],
  permissions: ['read:profile'],
  emailVerified: true,
  mfaEnabled: false,
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
  failedLoginAttempts: 0,
  ...overrides,
});

const createMockUserIdentity = (overrides: Partial<UserIdentity> = {}): UserIdentity => ({
  id: 'user-123',
  email: 'test@example.com',
  username: 'testuser',
  tenantId: 'tenant-1',
  roles: ['user'],
  permissions: ['read:profile'],
  emailVerified: true,
  mfaEnabled: false,
  ...overrides,
});

// ============================================================================
// TokenService Tests
// ============================================================================

describe('TokenService', () => {
  let tokenService: TokenService;
  let mockJwt: JwtInterface;

  beforeEach(() => {
    tokenService = new TokenService({
      secret: 'test-secret',
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
      issuer: 'test-issuer',
      audience: 'test-audience',
      algorithm: 'HS256',
    });
    mockJwt = createMockJwt();
    tokenService.setJwt(mockJwt);
  });

  describe('generateTokenPair', () => {
    it('should generate access and refresh tokens', () => {
      const user = createMockUserIdentity();
      const result = tokenService.generateTokenPair(user, 'session-123');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.accessTokenExpiresAt).toBeInstanceOf(Date);
      expect(result.refreshTokenExpiresAt).toBeInstanceOf(Date);
      expect(mockJwt.sign).toHaveBeenCalledTimes(2);
    });

    it('should include user data in tokens', () => {
      const user = createMockUserIdentity();
      tokenService.generateTokenPair(user, 'session-123');

      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: user.id,
          email: user.email,
          tenantId: user.tenantId,
          type: 'access',
        }),
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('generateAccessToken', () => {
    it('should generate only an access token', () => {
      const user = createMockUserIdentity();
      const token = tokenService.generateAccessToken(user);

      expect(token).toBeDefined();
      expect(mockJwt.sign).toHaveBeenCalledTimes(1);
      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'access' }),
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate only a refresh token', () => {
      const user = createMockUserIdentity();
      const token = tokenService.generateRefreshToken(user);

      expect(token).toBeDefined();
      expect(mockJwt.sign).toHaveBeenCalledTimes(1);
      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'refresh' }),
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const user = createMockUserIdentity();
      const token = tokenService.generateAccessToken(user);
      const result = tokenService.verifyToken(token);

      expect(result.valid).toBe(true);
      expect(result.payload).toBeDefined();
    });

    it('should reject invalid token', () => {
      (mockJwt.verify as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = tokenService.verifyToken('invalid-token');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should check token type when specified', () => {
      const user = createMockUserIdentity();
      const refreshToken = tokenService.generateRefreshToken(user);

      const result = tokenService.verifyToken(refreshToken, 'access');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Expected access token');
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify access token type', () => {
      const user = createMockUserIdentity();
      const token = tokenService.generateAccessToken(user);
      const result = tokenService.verifyAccessToken(token);

      expect(result.valid).toBe(true);
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify refresh token type', () => {
      const user = createMockUserIdentity();
      const token = tokenService.generateRefreshToken(user);
      const result = tokenService.verifyRefreshToken(token);

      expect(result.valid).toBe(true);
    });
  });

  describe('decodeToken', () => {
    it('should decode a token without verification', () => {
      const user = createMockUserIdentity();
      const token = tokenService.generateAccessToken(user);
      const payload = tokenService.decodeToken(token);

      expect(payload).toBeDefined();
      expect(payload?.sub).toBe(user.id);
    });

    it('should return null for invalid token', () => {
      (mockJwt.decode as ReturnType<typeof vi.fn>).mockReturnValue(null);
      const payload = tokenService.decodeToken('invalid');
      expect(payload).toBeNull();
    });
  });

  describe('decodeTokenComplete', () => {
    it('should decode token with header', () => {
      const user = createMockUserIdentity();
      const token = tokenService.generateAccessToken(user);
      const decoded = tokenService.decodeTokenComplete(token);

      expect(decoded).toBeDefined();
      expect(decoded?.header).toBeDefined();
      expect(decoded?.payload).toBeDefined();
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for non-expired token', () => {
      const user = createMockUserIdentity();
      const token = tokenService.generateAccessToken(user);
      expect(tokenService.isTokenExpired(token)).toBe(false);
    });

    it('should return true for expired token', () => {
      (mockJwt.decode as ReturnType<typeof vi.fn>).mockReturnValue({
        exp: Math.floor(Date.now() / 1000) - 3600,
      });
      expect(tokenService.isTokenExpired('expired-token')).toBe(true);
    });

    it('should return true for token without exp', () => {
      (mockJwt.decode as ReturnType<typeof vi.fn>).mockReturnValue({});
      expect(tokenService.isTokenExpired('no-exp-token')).toBe(true);
    });
  });

  describe('getTokenExpiry', () => {
    it('should return expiry date', () => {
      const user = createMockUserIdentity();
      const token = tokenService.generateAccessToken(user);
      const expiry = tokenService.getTokenExpiry(token);

      expect(expiry).toBeInstanceOf(Date);
    });

    it('should return null for token without exp', () => {
      (mockJwt.decode as ReturnType<typeof vi.fn>).mockReturnValue({});
      expect(tokenService.getTokenExpiry('no-exp')).toBeNull();
    });
  });

  describe('getTokenTtl', () => {
    it('should return remaining TTL in seconds', () => {
      const user = createMockUserIdentity();
      const token = tokenService.generateAccessToken(user);
      const ttl = tokenService.getTokenTtl(token);

      expect(ttl).toBeGreaterThan(0);
    });

    it('should return 0 for expired token', () => {
      (mockJwt.decode as ReturnType<typeof vi.fn>).mockReturnValue({
        exp: Math.floor(Date.now() / 1000) - 3600,
      });
      expect(tokenService.getTokenTtl('expired')).toBe(0);
    });
  });

  describe('refreshTokens', () => {
    it('should generate new token pair from valid refresh token', () => {
      const user = createMockUserIdentity();
      const refreshToken = tokenService.generateRefreshToken(user);
      const newTokens = tokenService.refreshTokens(refreshToken);

      expect(newTokens).not.toBeNull();
      expect(newTokens?.accessToken).toBeDefined();
      expect(newTokens?.refreshToken).toBeDefined();
    });

    it('should return null for invalid refresh token', () => {
      (mockJwt.verify as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = tokenService.refreshTokens('invalid');
      expect(result).toBeNull();
    });
  });

  describe('extractUserFromPayload', () => {
    it('should extract user identity from token payload', () => {
      const payload: TokenPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        tenantId: 'tenant-1',
        roles: ['user'],
        permissions: ['read:profile'],
        type: 'access',
      };

      const user = tokenService.extractUserFromPayload(payload);
      expect(user.id).toBe(payload.sub);
      expect(user.email).toBe(payload.email);
      expect(user.tenantId).toBe(payload.tenantId);
    });
  });

  describe('getConfig', () => {
    it('should return configuration copy', () => {
      const config = tokenService.getConfig();
      expect(config.secret).toBe('test-secret');
      expect(config.issuer).toBe('test-issuer');
    });
  });

  describe('error handling', () => {
    it('should throw if not initialized', () => {
      const uninitializedService = new TokenService();
      expect(() => uninitializedService.generateAccessToken(createMockUserIdentity())).toThrow(
        'Token service not initialized'
      );
    });

    it('should handle TokenExpiredError', () => {
      const expiredError = new Error('Token expired');
      expiredError.name = 'TokenExpiredError';
      (mockJwt.verify as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw expiredError;
      });

      const result = tokenService.verifyToken('expired-token');
      expect(result.valid).toBe(false);
      expect(result.expired).toBe(true);
    });

    it('should handle JsonWebTokenError', () => {
      const jwtError = new Error('Malformed token');
      jwtError.name = 'JsonWebTokenError';
      (mockJwt.verify as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw jwtError;
      });

      const result = tokenService.verifyToken('malformed');
      expect(result.valid).toBe(false);
    });

    it('should handle NotBeforeError', () => {
      const nbfError = new Error('Token not yet valid');
      nbfError.name = 'NotBeforeError';
      (mockJwt.verify as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw nbfError;
      });

      const result = tokenService.verifyToken('not-yet-valid');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not yet valid');
    });

    it('should handle unknown error type', () => {
      (mockJwt.verify as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw 'Unknown error';
      });

      const result = tokenService.verifyToken('unknown-error');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Unknown token error');
    });
  });

  describe('calculateExpiry', () => {
    it('should handle different time units', () => {
      const config = tokenService.getConfig();
      // Test by generating tokens with different configs
      const shortService = new TokenService({ ...config, accessTokenExpiry: '30s' });
      shortService.setJwt(mockJwt);

      const minuteService = new TokenService({ ...config, accessTokenExpiry: '5m' });
      minuteService.setJwt(mockJwt);

      const hourService = new TokenService({ ...config, accessTokenExpiry: '2h' });
      hourService.setJwt(mockJwt);

      const dayService = new TokenService({ ...config, accessTokenExpiry: '3d' });
      dayService.setJwt(mockJwt);

      const weekService = new TokenService({ ...config, accessTokenExpiry: '1w' });
      weekService.setJwt(mockJwt);

      // Each should generate valid tokens
      expect(shortService.generateTokenPair(createMockUserIdentity())).toBeDefined();
      expect(minuteService.generateTokenPair(createMockUserIdentity())).toBeDefined();
      expect(hourService.generateTokenPair(createMockUserIdentity())).toBeDefined();
      expect(dayService.generateTokenPair(createMockUserIdentity())).toBeDefined();
      expect(weekService.generateTokenPair(createMockUserIdentity())).toBeDefined();
    });

    it('should default to 1 hour for invalid format', () => {
      const config = tokenService.getConfig();
      const invalidService = new TokenService({ ...config, accessTokenExpiry: 'invalid' });
      invalidService.setJwt(mockJwt);

      const result = invalidService.generateTokenPair(createMockUserIdentity());
      expect(result).toBeDefined();
    });
  });
});

// ============================================================================
// PasswordService Tests
// ============================================================================

describe('PasswordService', () => {
  let passwordService: PasswordService;
  let mockBcrypt: BcryptInterface;

  beforeEach(() => {
    passwordService = new PasswordService({
      minLength: 8,
      maxLength: 128,
      requireUppercase: true,
      requireLowercase: true,
      requireNumber: true,
      requireSpecialChar: true,
      hashRounds: 12,
      historyCount: 5,
    });
    mockBcrypt = createMockBcrypt();
    passwordService.setBcrypt(mockBcrypt);
  });

  describe('validate', () => {
    it('should validate a strong password', () => {
      const result = passwordService.validate('StrongP@ss123');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject short passwords', () => {
      const result = passwordService.validate('Sh0rt!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters');
    });

    it('should reject very long passwords', () => {
      const result = passwordService.validate('A'.repeat(130) + '1!');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('no more than'))).toBe(true);
    });

    it('should require uppercase letter', () => {
      const result = passwordService.validate('lowercase123!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should require lowercase letter', () => {
      const result = passwordService.validate('UPPERCASE123!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should require number', () => {
      const result = passwordService.validate('NoNumbersHere!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should require special character', () => {
      const result = passwordService.validate('NoSpecial123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('should reject common passwords', () => {
      const result = passwordService.validate('password');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('too common'))).toBe(true);
    });
  });

  describe('calculateStrength', () => {
    it('should return low score for weak passwords', () => {
      const score = passwordService.calculateStrength('abc');
      expect(score).toBeLessThan(30);
    });

    it('should return high score for strong passwords', () => {
      const score = passwordService.calculateStrength('V3ryStr0ng!P@ssw0rd');
      expect(score).toBeGreaterThan(70);
    });

    it('should penalize repeated characters', () => {
      const scoreNormal = passwordService.calculateStrength('abcdefgh');
      const scoreRepeated = passwordService.calculateStrength('aaaabbbb');
      expect(scoreRepeated).toBeLessThan(scoreNormal);
    });

    it('should penalize all letters or all numbers', () => {
      const scoreMixed = passwordService.calculateStrength('abcd1234');
      const scoreLetters = passwordService.calculateStrength('abcdefgh');
      const scoreNumbers = passwordService.calculateStrength('12345678');
      expect(scoreLetters).toBeLessThan(scoreMixed);
      expect(scoreNumbers).toBeLessThan(scoreMixed);
    });
  });

  describe('getStrengthLabel', () => {
    it('should return correct labels', () => {
      expect(passwordService.getStrengthLabel(10)).toBe('weak');
      expect(passwordService.getStrengthLabel(30)).toBe('fair');
      expect(passwordService.getStrengthLabel(50)).toBe('good');
      expect(passwordService.getStrengthLabel(70)).toBe('strong');
      expect(passwordService.getStrengthLabel(90)).toBe('very-strong');
    });
  });

  describe('hash', () => {
    it('should hash a password', async () => {
      const result = await passwordService.hash('testPassword');
      expect(result.hash).toBe('hashed:testPassword');
      expect(mockBcrypt.genSalt).toHaveBeenCalled();
    });
  });

  describe('verify', () => {
    it('should verify a correct password', async () => {
      const result = await passwordService.verify('testPassword', 'hashed:testPassword');
      expect(result).toBe(true);
    });

    it('should reject an incorrect password', async () => {
      const result = await passwordService.verify('wrongPassword', 'hashed:testPassword');
      expect(result).toBe(false);
    });
  });

  describe('isInHistory', () => {
    it('should detect password in history', async () => {
      const history = ['hashed:oldPass1', 'hashed:oldPass2'];
      const result = await passwordService.isInHistory('oldPass1', history);
      expect(result).toBe(true);
    });

    it('should return false for password not in history', async () => {
      const history = ['hashed:oldPass1', 'hashed:oldPass2'];
      const result = await passwordService.isInHistory('newPass', history);
      expect(result).toBe(false);
    });

    it('should return false for empty history', async () => {
      const result = await passwordService.isInHistory('anyPass', []);
      expect(result).toBe(false);
    });

    it('should respect historyCount config', async () => {
      const shortHistoryService = new PasswordService({ historyCount: 2 });
      shortHistoryService.setBcrypt(mockBcrypt);

      const history = ['hashed:old1', 'hashed:old2', 'hashed:old3', 'hashed:old4'];
      // Should only check last 2
      const result = await shortHistoryService.isInHistory('old1', history);
      expect(result).toBe(false);
    });
  });

  describe('generateSecurePassword', () => {
    it('should generate password with correct length', () => {
      const password = passwordService.generateSecurePassword(20);
      expect(password.length).toBe(20);
    });

    it('should generate password with required characters', () => {
      const password = passwordService.generateSecurePassword(16);
      expect(/[a-z]/.test(password)).toBe(true);
      expect(/[A-Z]/.test(password)).toBe(true);
      expect(/[0-9]/.test(password)).toBe(true);
      expect(/[!@#$%^&*()_+\-=]/.test(password)).toBe(true);
    });

    it('should use default length of 16', () => {
      const password = passwordService.generateSecurePassword();
      expect(password.length).toBe(16);
    });
  });

  describe('generateResetToken', () => {
    it('should generate 64-character hex token', () => {
      const token = passwordService.generateResetToken();
      expect(token.length).toBe(64);
      expect(/^[a-f0-9]+$/.test(token)).toBe(true);
    });
  });

  describe('hashResetToken', () => {
    it('should hash a reset token', async () => {
      const token = 'test-token';
      const hash = await passwordService.hashResetToken(token);
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64); // SHA-256 hex
    });
  });

  describe('verifyResetToken', () => {
    it('should verify a reset token', async () => {
      const token = 'test-token';
      const hash = await passwordService.hashResetToken(token);
      const result = await passwordService.verifyResetToken(token, hash);
      expect(result).toBe(true);
    });

    it('should reject wrong token', async () => {
      const hash = await passwordService.hashResetToken('original');
      const result = await passwordService.verifyResetToken('different', hash);
      expect(result).toBe(false);
    });
  });

  describe('getConfig', () => {
    it('should return configuration copy', () => {
      const config = passwordService.getConfig();
      expect(config.minLength).toBe(8);
      expect(config.requireUppercase).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should throw if not initialized', async () => {
      const uninitializedService = new PasswordService();
      await expect(uninitializedService.hash('test')).rejects.toThrow(
        'Password service not initialized'
      );
    });
  });
});

// ============================================================================
// SessionService Tests
// ============================================================================

describe('SessionService', () => {
  let sessionService: SessionService;
  let storage: InMemorySessionStorage;

  beforeEach(() => {
    storage = new InMemorySessionStorage();
    sessionService = new SessionService(storage, {
      durationSeconds: 3600,
      slidingSession: true,
      maxConcurrentSessions: 5,
      cookieName: 'test_session',
      secureCookie: true,
      httpOnlyCookie: true,
      sameSite: 'lax',
    });
  });

  afterEach(() => {
    storage.clear();
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      const session = await sessionService.createSession('user-123', 'tenant-1');

      expect(session.id).toBeDefined();
      expect(session.userId).toBe('user-123');
      expect(session.tenantId).toBe('tenant-1');
      expect(session.isActive).toBe(true);
      expect(session.expiresAt).toBeInstanceOf(Date);
    });

    it('should include optional metadata', async () => {
      const session = await sessionService.createSession('user-123', 'tenant-1', {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        deviceInfo: { type: 'desktop', os: 'macOS', browser: 'Chrome' },
        metadata: { customField: 'value' },
      });

      expect(session.ipAddress).toBe('192.168.1.1');
      expect(session.userAgent).toBe('Mozilla/5.0');
      expect(session.deviceInfo?.type).toBe('desktop');
      expect(session.metadata?.customField).toBe('value');
    });

    it('should extend duration for rememberMe', async () => {
      const normalSession = await sessionService.createSession('user-123', 'tenant-1');
      const extendedSession = await sessionService.createSession('user-123', 'tenant-1', {
        extendedDuration: true,
      });

      expect(extendedSession.expiresAt.getTime()).toBeGreaterThan(
        normalSession.expiresAt.getTime()
      );
    });

    it('should invalidate oldest session when max concurrent reached', async () => {
      const shortService = new SessionService(storage, {
        ...DEFAULT_AUTH_CONFIG.session,
        maxConcurrentSessions: 2,
      });

      const session1 = await shortService.createSession('user-123', 'tenant-1');
      await shortService.createSession('user-123', 'tenant-1');
      await shortService.createSession('user-123', 'tenant-1');

      const checkSession1 = await storage.get(session1.id);
      expect(checkSession1?.isActive).toBe(false);
    });
  });

  describe('getSession', () => {
    it('should get an existing session', async () => {
      const created = await sessionService.createSession('user-123', 'tenant-1');
      const retrieved = await sessionService.getSession(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return null for non-existent session', async () => {
      const session = await sessionService.getSession('non-existent');
      expect(session).toBeNull();
    });

    it('should return null and invalidate expired session', async () => {
      const session = await sessionService.createSession('user-123', 'tenant-1');
      // Manually expire the session
      const stored = await storage.get(session.id);
      if (stored) {
        stored.expiresAt = new Date(Date.now() - 1000);
        await storage.set(stored);
      }

      const retrieved = await sessionService.getSession(session.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('validateSession', () => {
    it('should validate an active session', async () => {
      const session = await sessionService.createSession('user-123', 'tenant-1');
      const result = await sessionService.validateSession(session.id);

      expect(result.valid).toBe(true);
      expect(result.session).toBeDefined();
    });

    it('should return invalid for non-existent session', async () => {
      const result = await sessionService.validateSession('non-existent');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Session not found');
    });

    it('should return invalid for inactive session', async () => {
      const session = await sessionService.createSession('user-123', 'tenant-1');
      await sessionService.invalidateSession(session.id);

      const result = await sessionService.validateSession(session.id);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Session is inactive');
    });

    it('should return invalid for expired session', async () => {
      const session = await sessionService.createSession('user-123', 'tenant-1');
      const stored = await storage.get(session.id);
      if (stored) {
        stored.expiresAt = new Date(Date.now() - 1000);
        await storage.set(stored);
      }

      const result = await sessionService.validateSession(session.id);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Session has expired');
    });
  });

  describe('refreshSession', () => {
    it('should update last activity time', async () => {
      const session = await sessionService.createSession('user-123', 'tenant-1');
      const originalActivity = session.lastActivityAt;

      await new Promise((resolve) => setTimeout(resolve, 10));
      const refreshed = await sessionService.refreshSession(session.id);

      expect(refreshed?.lastActivityAt.getTime()).toBeGreaterThan(originalActivity.getTime());
    });

    it('should extend expiry for sliding sessions', async () => {
      const session = await sessionService.createSession('user-123', 'tenant-1');
      const originalExpiry = session.expiresAt;

      await new Promise((resolve) => setTimeout(resolve, 10));
      const refreshed = await sessionService.refreshSession(session.id);

      expect(refreshed?.expiresAt.getTime()).toBeGreaterThan(originalExpiry.getTime());
    });

    it('should update IP address if changed', async () => {
      const session = await sessionService.createSession('user-123', 'tenant-1', {
        ipAddress: '192.168.1.1',
      });

      const refreshed = await sessionService.refreshSession(session.id, {
        ipAddress: '192.168.1.2',
      });

      expect(refreshed?.ipAddress).toBe('192.168.1.2');
    });

    it('should return null for invalid session', async () => {
      const refreshed = await sessionService.refreshSession('non-existent');
      expect(refreshed).toBeNull();
    });
  });

  describe('invalidateSession', () => {
    it('should set session as inactive', async () => {
      const session = await sessionService.createSession('user-123', 'tenant-1');
      const result = await sessionService.invalidateSession(session.id);

      expect(result).toBe(true);

      const stored = await storage.get(session.id);
      expect(stored?.isActive).toBe(false);
    });

    it('should return false for non-existent session', async () => {
      const result = await sessionService.invalidateSession('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('deleteSession', () => {
    it('should remove session from storage', async () => {
      const session = await sessionService.createSession('user-123', 'tenant-1');
      const result = await sessionService.deleteSession(session.id);

      expect(result).toBe(true);
      expect(await storage.get(session.id)).toBeNull();
    });

    it('should return false for non-existent session', async () => {
      const result = await sessionService.deleteSession('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('getUserSessions', () => {
    it('should get all active sessions for a user', async () => {
      await sessionService.createSession('user-123', 'tenant-1');
      await sessionService.createSession('user-123', 'tenant-1');
      await sessionService.createSession('user-456', 'tenant-1');

      const sessions = await sessionService.getUserSessions('user-123', 'tenant-1');
      expect(sessions.length).toBe(2);
    });

    it('should not include inactive sessions', async () => {
      const session1 = await sessionService.createSession('user-123', 'tenant-1');
      await sessionService.createSession('user-123', 'tenant-1');
      await sessionService.invalidateSession(session1.id);

      const sessions = await sessionService.getUserSessions('user-123', 'tenant-1');
      expect(sessions.length).toBe(1);
    });
  });

  describe('invalidateUserSessions', () => {
    it('should invalidate all user sessions', async () => {
      await sessionService.createSession('user-123', 'tenant-1');
      await sessionService.createSession('user-123', 'tenant-1');
      await sessionService.createSession('user-123', 'tenant-1');

      const count = await sessionService.invalidateUserSessions('user-123', 'tenant-1');
      expect(count).toBe(3);
    });

    it('should except specified session', async () => {
      const session1 = await sessionService.createSession('user-123', 'tenant-1');
      await sessionService.createSession('user-123', 'tenant-1');

      const count = await sessionService.invalidateUserSessions('user-123', 'tenant-1', {
        exceptSessionId: session1.id,
      });

      expect(count).toBe(1);
      const sessions = await sessionService.getUserSessions('user-123', 'tenant-1');
      expect(sessions.length).toBe(1);
      expect(sessions[0].id).toBe(session1.id);
    });
  });

  describe('deleteUserSessions', () => {
    it('should delete all user sessions', async () => {
      await sessionService.createSession('user-123', 'tenant-1');
      await sessionService.createSession('user-123', 'tenant-1');

      const count = await sessionService.deleteUserSessions('user-123', 'tenant-1');
      expect(count).toBe(2);
      expect(storage.size()).toBe(0);
    });
  });

  describe('getSessionStats', () => {
    it('should return session statistics', async () => {
      await sessionService.createSession('user-123', 'tenant-1', {
        deviceInfo: { type: 'desktop' },
      });
      await sessionService.createSession('user-123', 'tenant-1', {
        deviceInfo: { type: 'mobile' },
      });

      const stats = await sessionService.getSessionStats('user-123', 'tenant-1');

      expect(stats.totalSessions).toBe(2);
      expect(stats.activeSessions).toBe(2);
      expect(stats.devices).toContain('desktop');
      expect(stats.devices).toContain('mobile');
      expect(stats.lastActivity).toBeInstanceOf(Date);
    });
  });

  describe('isSessionActive', () => {
    it('should return true for active non-expired session', async () => {
      const session = await sessionService.createSession('user-123', 'tenant-1');
      expect(sessionService.isSessionActive(session)).toBe(true);
    });

    it('should return false for inactive session', async () => {
      const session = await sessionService.createSession('user-123', 'tenant-1');
      session.isActive = false;
      expect(sessionService.isSessionActive(session)).toBe(false);
    });

    it('should return false for expired session', async () => {
      const session = await sessionService.createSession('user-123', 'tenant-1');
      session.expiresAt = new Date(Date.now() - 1000);
      expect(sessionService.isSessionActive(session)).toBe(false);
    });
  });

  describe('getSessionTtl', () => {
    it('should return remaining TTL in seconds', async () => {
      const session = await sessionService.createSession('user-123', 'tenant-1');
      const ttl = sessionService.getSessionTtl(session);

      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(3600);
    });

    it('should return 0 for expired session', async () => {
      const session = await sessionService.createSession('user-123', 'tenant-1');
      session.expiresAt = new Date(Date.now() - 1000);

      expect(sessionService.getSessionTtl(session)).toBe(0);
    });
  });

  describe('parseUserAgent', () => {
    it('should detect desktop browser', () => {
      const info = sessionService.parseUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
      );

      expect(info.type).toBe('desktop');
      expect(info.os).toBe('macOS');
      expect(info.browser).toBe('Chrome');
    });

    it('should detect mobile browser', () => {
      const info = sessionService.parseUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'
      );

      expect(info.type).toBe('mobile');
      expect(info.os).toBe('iOS');
      expect(info.browser).toBe('Safari');
    });

    it('should detect tablet', () => {
      const info = sessionService.parseUserAgent(
        'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'
      );

      expect(info.type).toBe('tablet');
    });

    it('should detect different browsers', () => {
      expect(sessionService.parseUserAgent('Firefox/120.0').browser).toBe('Firefox');
      expect(sessionService.parseUserAgent('Edg/120.0').browser).toBe('Edge');
      expect(sessionService.parseUserAgent('MSIE 11.0; Trident/7.0').browser).toBe('Internet Explorer');
    });

    it('should detect different operating systems', () => {
      expect(sessionService.parseUserAgent('Windows NT 10.0').os).toBe('Windows');
      expect(sessionService.parseUserAgent('Linux x86_64').os).toBe('Linux');
      expect(sessionService.parseUserAgent('Android 14').os).toBe('Android');
    });
  });

  describe('getConfig', () => {
    it('should return configuration copy', () => {
      const config = sessionService.getConfig();
      expect(config.durationSeconds).toBe(3600);
      expect(config.slidingSession).toBe(true);
    });
  });
});

describe('Session Cookie Options', () => {
  it('should generate session cookie options', () => {
    const options = getSessionCookieOptions('session-123', DEFAULT_AUTH_CONFIG.session);

    expect(options.name).toBe(DEFAULT_AUTH_CONFIG.session.cookieName);
    expect(options.value).toBe('session-123');
    expect(options.secure).toBe(true);
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe('lax');
  });

  it('should generate clear cookie options', () => {
    const options = getClearSessionCookieOptions(DEFAULT_AUTH_CONFIG.session);

    expect(options.value).toBe('');
    expect(options.maxAge).toBe(0);
  });
});

describe('InMemorySessionStorage', () => {
  it('should store and retrieve sessions', async () => {
    const storage = new InMemorySessionStorage();
    const session: Session = {
      id: 'test-session',
      userId: 'user-123',
      tenantId: 'tenant-1',
      createdAt: new Date(),
      lastActivityAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
      isActive: true,
    };

    await storage.set(session);
    const retrieved = await storage.get('test-session');
    expect(retrieved).toEqual(session);
  });

  it('should delete sessions', async () => {
    const storage = new InMemorySessionStorage();
    const session: Session = {
      id: 'test-session',
      userId: 'user-123',
      tenantId: 'tenant-1',
      createdAt: new Date(),
      lastActivityAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
      isActive: true,
    };

    await storage.set(session);
    await storage.delete('test-session');
    expect(await storage.get('test-session')).toBeNull();
  });

  it('should get sessions by user ID', async () => {
    const storage = new InMemorySessionStorage();

    await storage.set({
      id: 's1',
      userId: 'user-123',
      tenantId: 'tenant-1',
      createdAt: new Date(),
      lastActivityAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
      isActive: true,
    });
    await storage.set({
      id: 's2',
      userId: 'user-123',
      tenantId: 'tenant-1',
      createdAt: new Date(),
      lastActivityAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
      isActive: true,
    });

    const sessions = await storage.getByUserId('user-123', 'tenant-1');
    expect(sessions.length).toBe(2);
  });

  it('should delete sessions by user ID', async () => {
    const storage = new InMemorySessionStorage();

    await storage.set({
      id: 's1',
      userId: 'user-123',
      tenantId: 'tenant-1',
      createdAt: new Date(),
      lastActivityAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
      isActive: true,
    });

    await storage.deleteByUserId('user-123', 'tenant-1');
    expect(storage.size()).toBe(0);
  });
});

// ============================================================================
// MfaService Tests
// ============================================================================

describe('MfaService', () => {
  let mfaService: MfaService;
  let mockAuthenticator: OtpAuthenticator;
  let mockQrGenerator: QrCodeGenerator;

  beforeEach(() => {
    mfaService = new MfaService({
      enabled: true,
      issuer: 'TestApp',
      digits: 6,
      stepSeconds: 30,
      window: 1,
      backupCodesCount: 10,
    });
    mockAuthenticator = createMockAuthenticator();
    mockQrGenerator = createMockQrGenerator();
    mfaService.setAuthenticator(mockAuthenticator);
    mfaService.setQrGenerator(mockQrGenerator);
  });

  describe('generateSetup', () => {
    it('should generate MFA setup data', async () => {
      const setup = await mfaService.generateSetup('user-123', 'test@example.com');

      expect(setup.secret).toBeDefined();
      expect(setup.qrCodeDataUrl).toContain('data:image');
      expect(setup.manualEntryKey).toBeDefined();
      expect(setup.backupCodes).toHaveLength(10);
      expect(setup.otpauthUri).toContain('otpauth://totp');
    });

    it('should format manual entry key with spaces', async () => {
      const setup = await mfaService.generateSetup('user-123', 'test@example.com');
      expect(setup.manualEntryKey).toContain(' ');
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const result = mfaService.verifyToken('123456', 'MOCK_SECRET');
      expect(result.valid).toBe(true);
    });

    it('should reject an invalid token', () => {
      const result = mfaService.verifyToken('000000', 'MOCK_SECRET');
      expect(result.valid).toBe(false);
    });

    it('should normalize token format', () => {
      const result = mfaService.verifyToken('123 456', 'MOCK_SECRET');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid token format', () => {
      const result = mfaService.verifyToken('abcdef', 'MOCK_SECRET');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid token format');
    });

    it('should handle verification errors', () => {
      (mockAuthenticator.verify as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Verification error');
      });

      const result = mfaService.verifyToken('123456', 'MOCK_SECRET');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Verification error');
    });
  });

  describe('verifyBackupCode', () => {
    it('should verify a valid backup code', async () => {
      const codes = ['ABCD-1234'];
      const hashedCodes = ['HASHED_ABCD1234'];
      const hashFunction = async (code: string) =>
        code === 'ABCD1234' ? 'HASHED_ABCD1234' : 'OTHER';

      const result = await mfaService.verifyBackupCode('ABCD-1234', hashedCodes, hashFunction);
      expect(result.valid).toBe(true);
      expect(result.codeIndex).toBe(0);
    });

    it('should return invalid for wrong backup code', async () => {
      const hashedCodes = ['HASHED_CORRECT'];
      const hashFunction = async (_code: string) => 'HASHED_WRONG';

      const result = await mfaService.verifyBackupCode('WRONG-CODE', hashedCodes, hashFunction);
      expect(result.valid).toBe(false);
      expect(result.codeIndex).toBe(-1);
    });
  });

  describe('generateCurrentToken', () => {
    it('should generate a TOTP token', () => {
      const token = mfaService.generateCurrentToken('MOCK_SECRET');
      expect(token).toBe('123456');
    });
  });

  describe('generateBackupCodes', () => {
    it('should generate specified number of codes', () => {
      const codes = mfaService.generateBackupCodes(5);
      expect(codes).toHaveLength(5);
    });

    it('should format codes as XXXX-XXXX', () => {
      const codes = mfaService.generateBackupCodes(1);
      expect(codes[0]).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    });
  });

  describe('hashBackupCodes', () => {
    it('should hash all backup codes', async () => {
      const codes = ['ABCD-1234', 'EFGH-5678'];
      const hashFunction = async (code: string) => `hashed:${code}`;

      const hashed = await mfaService.hashBackupCodes(codes, hashFunction);

      expect(hashed).toHaveLength(2);
      expect(hashed[0]).toBe('hashed:ABCD1234');
      expect(hashed[1]).toBe('hashed:EFGH5678');
    });
  });

  describe('getTokenTimeRemaining', () => {
    it('should return time remaining until token expires', () => {
      const remaining = mfaService.getTokenTimeRemaining();
      expect(remaining).toBeGreaterThanOrEqual(0);
      expect(remaining).toBeLessThanOrEqual(30);
    });
  });

  describe('isValidSecret', () => {
    it('should validate correct base32 secrets', () => {
      expect(mfaService.isValidSecret('JBSWY3DPEHPK3PXP')).toBe(true);
    });

    it('should reject invalid secrets', () => {
      expect(mfaService.isValidSecret('short')).toBe(false);
      expect(mfaService.isValidSecret('invalid-chars!')).toBe(false);
    });
  });

  describe('getSetupInstructions', () => {
    it('should return setup instructions', () => {
      const instructions = mfaService.getSetupInstructions();

      expect(instructions.steps).toBeDefined();
      expect(instructions.steps.length).toBeGreaterThan(0);
      expect(instructions.supportedApps).toContain('Google Authenticator');
    });
  });

  describe('getConfig', () => {
    it('should return configuration copy', () => {
      const config = mfaService.getConfig();
      expect(config.issuer).toBe('TestApp');
      expect(config.digits).toBe(6);
    });
  });

  describe('isEnabled', () => {
    it('should return enabled status', () => {
      expect(mfaService.isEnabled()).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should throw if not initialized', async () => {
      const uninitializedService = new MfaService();
      await expect(uninitializedService.generateSetup('user', 'email')).rejects.toThrow(
        'MFA service not initialized'
      );
    });
  });
});

describe('MfaChallengeManager', () => {
  let challengeManager: MfaChallengeManager;

  beforeEach(() => {
    challengeManager = new MfaChallengeManager({
      maxAttempts: 3,
      challengeDurationSeconds: 300,
    });
  });

  afterEach(() => {
    challengeManager.clear();
  });

  describe('createChallenge', () => {
    it('should create a new challenge', () => {
      const challenge = challengeManager.createChallenge('user-123', 'tenant-1');

      expect(challenge.id).toBeDefined();
      expect(challenge.userId).toBe('user-123');
      expect(challenge.tenantId).toBe('tenant-1');
      expect(challenge.verified).toBe(false);
      expect(challenge.attempts).toBe(0);
      expect(challenge.maxAttempts).toBe(3);
    });
  });

  describe('getChallenge', () => {
    it('should retrieve an existing challenge', () => {
      const created = challengeManager.createChallenge('user-123', 'tenant-1');
      const retrieved = challengeManager.getChallenge(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return null for non-existent challenge', () => {
      expect(challengeManager.getChallenge('non-existent')).toBeNull();
    });

    it('should return null and delete expired challenge', () => {
      const challenge = challengeManager.createChallenge('user-123', 'tenant-1');
      challenge.expiresAt = new Date(Date.now() - 1000);

      expect(challengeManager.getChallenge(challenge.id)).toBeNull();
    });
  });

  describe('recordAttempt', () => {
    it('should increment attempt count', () => {
      const challenge = challengeManager.createChallenge('user-123', 'tenant-1');
      const result = challengeManager.recordAttempt(challenge.id);

      expect(result.allowed).toBe(true);
      expect(result.remainingAttempts).toBe(2);
    });

    it('should delete challenge when max attempts reached', () => {
      const challenge = challengeManager.createChallenge('user-123', 'tenant-1');

      challengeManager.recordAttempt(challenge.id);
      challengeManager.recordAttempt(challenge.id);
      const result = challengeManager.recordAttempt(challenge.id);

      expect(result.allowed).toBe(false);
      expect(result.remainingAttempts).toBe(0);
      expect(challengeManager.getChallenge(challenge.id)).toBeNull();
    });

    it('should return not allowed for non-existent challenge', () => {
      const result = challengeManager.recordAttempt('non-existent');
      expect(result.allowed).toBe(false);
    });
  });

  describe('verifyChallenge', () => {
    it('should mark challenge as verified', () => {
      const challenge = challengeManager.createChallenge('user-123', 'tenant-1');
      const result = challengeManager.verifyChallenge(challenge.id);

      expect(result).toBe(true);

      const updated = challengeManager.getChallenge(challenge.id);
      expect(updated?.verified).toBe(true);
    });

    it('should return false for non-existent challenge', () => {
      expect(challengeManager.verifyChallenge('non-existent')).toBe(false);
    });
  });

  describe('deleteChallenge', () => {
    it('should remove a challenge', () => {
      const challenge = challengeManager.createChallenge('user-123', 'tenant-1');
      const result = challengeManager.deleteChallenge(challenge.id);

      expect(result).toBe(true);
      expect(challengeManager.getChallenge(challenge.id)).toBeNull();
    });
  });

  describe('cleanupExpired', () => {
    it('should remove expired challenges', () => {
      const challenge1 = challengeManager.createChallenge('user-1', 'tenant-1');
      const challenge2 = challengeManager.createChallenge('user-2', 'tenant-1');

      challenge1.expiresAt = new Date(Date.now() - 1000);

      const cleaned = challengeManager.cleanupExpired();

      expect(cleaned).toBe(1);
      expect(challengeManager.getChallenge(challenge1.id)).toBeNull();
      expect(challengeManager.getChallenge(challenge2.id)).not.toBeNull();
    });
  });
});

// ============================================================================
// Provider Tests
// ============================================================================

describe('AuthProviderRegistry', () => {
  let registry: AuthProviderRegistry;
  let mockProvider: LocalAuthProvider;

  beforeEach(() => {
    registry = new AuthProviderRegistry();
    mockProvider = createLocalProvider(async () => null, {
      id: 'test-local',
      name: 'Test Local',
      enabled: true,
    });
  });

  afterEach(() => {
    registry.clear();
  });

  describe('register', () => {
    it('should register a provider', () => {
      registry.register(mockProvider);
      expect(registry.get('test-local')).toBe(mockProvider);
    });
  });

  describe('unregister', () => {
    it('should remove a provider', () => {
      registry.register(mockProvider);
      const result = registry.unregister('test-local');

      expect(result).toBe(true);
      expect(registry.get('test-local')).toBeUndefined();
    });

    it('should return false for non-existent provider', () => {
      expect(registry.unregister('non-existent')).toBe(false);
    });
  });

  describe('getAll', () => {
    it('should return all providers', () => {
      registry.register(mockProvider);
      const all = registry.getAll();

      expect(all).toHaveLength(1);
      expect(all[0]).toBe(mockProvider);
    });
  });

  describe('getEnabled', () => {
    it('should return only enabled providers', () => {
      registry.register(mockProvider);
      registry.register(
        createLocalProvider(async () => null, {
          id: 'disabled',
          name: 'Disabled',
          enabled: false,
        })
      );

      const enabled = registry.getEnabled();
      expect(enabled).toHaveLength(1);
      expect(enabled[0].id).toBe('test-local');
    });
  });

  describe('getByType', () => {
    it('should filter by provider type', () => {
      registry.register(mockProvider);
      const localProviders = registry.getByType('local');

      expect(localProviders).toHaveLength(1);
      expect(localProviders[0].type).toBe('local');
    });
  });

  describe('findProvider', () => {
    it('should find provider that can handle credentials', () => {
      registry.register(mockProvider);

      const found = registry.findProvider({
        identifier: 'test@example.com',
        password: 'password',
      });

      expect(found).toBe(mockProvider);
    });

    it('should return undefined if no provider can handle', () => {
      const found = registry.findProvider({
        identifier: 'test@example.com',
        password: 'password',
      });

      expect(found).toBeUndefined();
    });
  });

  describe('getPublicConfigs', () => {
    it('should return sanitized configs', () => {
      registry.register(mockProvider);
      const configs = registry.getPublicConfigs();

      expect(configs).toHaveLength(1);
      expect(configs[0].id).toBe('test-local');
      expect(configs[0].name).toBe('Test Local');
    });
  });
});

describe('LocalAuthProvider', () => {
  let provider: LocalAuthProvider;
  let mockPasswordService: PasswordService;
  let mockUser: StoredUser;

  beforeEach(() => {
    mockUser = createMockUser();
    mockPasswordService = new PasswordService();
    mockPasswordService.setBcrypt(createMockBcrypt());

    provider = new LocalAuthProvider({
      id: 'local',
      name: 'Email & Password',
      enabled: true,
      userLookup: async (identifier) => (identifier === mockUser.email ? mockUser : null),
      userUpdate: async () => {},
      passwordService: mockPasswordService,
    });
  });

  describe('authenticate', () => {
    it('should authenticate valid credentials', async () => {
      const result = await provider.authenticate(
        { identifier: mockUser.email, password: 'ValidPassword123!' },
        mockUser.tenantId
      );

      expect(result.success).toBe(true);
      expect(result.user?.id).toBe(mockUser.id);
    });

    it('should reject invalid password', async () => {
      const result = await provider.authenticate(
        { identifier: mockUser.email, password: 'wrong' },
        mockUser.tenantId
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    it('should reject non-existent user', async () => {
      const result = await provider.authenticate(
        { identifier: 'nonexistent@example.com', password: 'password' },
        mockUser.tenantId
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    it('should reject inactive account', async () => {
      mockUser.status = 'suspended';

      const result = await provider.authenticate(
        { identifier: mockUser.email, password: 'ValidPassword123!' },
        mockUser.tenantId
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('suspended');
    });

    it('should reject locked account', async () => {
      mockUser.lockoutEndsAt = new Date(Date.now() + 3600000);

      const result = await provider.authenticate(
        { identifier: mockUser.email, password: 'ValidPassword123!' },
        mockUser.tenantId
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('locked');
    });

    it('should return MFA required if enabled', async () => {
      mockUser.mfaEnabled = true;

      const result = await provider.authenticate(
        { identifier: mockUser.email, password: 'ValidPassword123!' },
        mockUser.tenantId
      );

      expect(result.success).toBe(false);
      expect(result.mfaRequired).toBe(true);
    });
  });

  describe('canHandle', () => {
    it('should handle credentials with identifier and password', () => {
      expect(
        provider.canHandle({ identifier: 'test@example.com', password: 'pass' })
      ).toBe(true);
    });

    it('should not handle credentials without password', () => {
      expect(provider.canHandle({ identifier: 'test@example.com', password: '' })).toBe(
        false
      );
    });
  });

  describe('getPublicConfig', () => {
    it('should return sanitized config', () => {
      const config = provider.getPublicConfig();

      expect(config.id).toBe('local');
      expect(config.name).toBe('Email & Password');
      expect(config.type).toBe('local');
    });
  });
});

describe('OAuthProvider', () => {
  let provider: OAuthProvider;
  let mockProvisioner: OAuthUserProvisionCallback;

  beforeEach(() => {
    mockProvisioner = vi.fn(async (userInfo) => ({
      id: userInfo.id,
      email: userInfo.email || 'test@example.com',
      tenantId: 'tenant-1',
      roles: ['user'],
      permissions: [],
      emailVerified: true,
      mfaEnabled: false,
    }));

    provider = new OAuthProvider({
      id: 'test-oauth',
      name: 'Test OAuth',
      enabled: true,
      settings: {
        clientId: 'client-123',
        clientSecret: 'secret-456',
        authorizationUrl: 'https://auth.example.com/authorize',
        tokenUrl: 'https://auth.example.com/token',
        userInfoUrl: 'https://api.example.com/userinfo',
        scopes: ['openid', 'email', 'profile'],
        redirectUri: 'https://app.example.com/callback',
      },
      userProvisioner: mockProvisioner,
    });
  });

  afterEach(() => {
    provider.clearStateStorage();
  });

  describe('authenticate', () => {
    it('should reject direct authentication', async () => {
      const result = await provider.authenticate(
        { identifier: 'test', password: 'test' },
        'tenant-1'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('redirect-based');
    });
  });

  describe('canHandle', () => {
    it('should return false (OAuth uses redirect)', () => {
      expect(provider.canHandle({ identifier: 'test', password: 'test' })).toBe(false);
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should generate authorization URL', () => {
      const result = provider.getAuthorizationUrl('tenant-1');

      expect(result.authorizationUrl).toContain('https://auth.example.com/authorize');
      expect(result.authorizationUrl).toContain('client_id=client-123');
      expect(result.authorizationUrl).toContain('response_type=code');
      expect(result.state).toBeDefined();
    });

    it('should include custom state', () => {
      const result = provider.getAuthorizationUrl('tenant-1', { state: 'custom-state' });

      expect(result.state).toBe('custom-state');
      expect(result.authorizationUrl).toContain('state=custom-state');
    });

    it('should include PKCE code verifier', () => {
      const result = provider.getAuthorizationUrl('tenant-1');
      expect(result.codeVerifier).toBeDefined();
    });
  });

  describe('handleCallback', () => {
    it('should reject invalid state', async () => {
      const result = await provider.handleCallback('code', 'invalid-state');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid or expired state');
    });

    it('should reject expired state', async () => {
      const authResult = provider.getAuthorizationUrl('tenant-1');

      // Manually expire the state
      const stateData = (provider as any).stateStorage.get(authResult.state);
      stateData.expiresAt = new Date(Date.now() - 1000);

      const result = await provider.handleCallback('code', authResult.state);

      expect(result.success).toBe(false);
      expect(result.error).toContain('expired');
    });
  });

  describe('getPublicConfig', () => {
    it('should return config without secrets', () => {
      const config = provider.getPublicConfig();

      expect(config.id).toBe('test-oauth');
      expect(config.settings?.clientId).toBe('client-123');
      expect((config.settings as any)?.clientSecret).toBeUndefined();
    });
  });

  describe('cleanupExpiredStates', () => {
    it('should remove expired states', () => {
      provider.getAuthorizationUrl('tenant-1');
      const auth2 = provider.getAuthorizationUrl('tenant-2');

      // Expire one state
      const stateData = (provider as any).stateStorage.get(auth2.state);
      stateData.expiresAt = new Date(Date.now() - 1000);

      const cleaned = provider.cleanupExpiredStates();
      expect(cleaned).toBe(1);
    });
  });
});

describe('OAuth Provider Factories', () => {
  const mockProvisioner: OAuthUserProvisionCallback = vi.fn(async () => ({
    id: 'user-123',
    email: 'test@example.com',
    tenantId: 'tenant-1',
    roles: ['user'],
    permissions: [],
    emailVerified: true,
    mfaEnabled: false,
  }));

  it('should create Google provider', () => {
    const provider = createGoogleProvider(
      'client-id',
      'client-secret',
      'https://app.com/callback',
      mockProvisioner
    );

    expect(provider.id).toBe('google');
    expect(provider.name).toBe('Google');
  });

  it('should create GitHub provider', () => {
    const provider = createGitHubProvider(
      'client-id',
      'client-secret',
      'https://app.com/callback',
      mockProvisioner
    );

    expect(provider.id).toBe('github');
    expect(provider.name).toBe('GitHub');
  });

  it('should create Microsoft provider', () => {
    const provider = createMicrosoftProvider(
      'client-id',
      'client-secret',
      'https://app.com/callback',
      mockProvisioner
    );

    expect(provider.id).toBe('microsoft');
    expect(provider.name).toBe('Microsoft');
  });
});

// ============================================================================
// AuthService Tests
// ============================================================================

describe('AuthService', () => {
  let authService: AuthService;
  let mockUser: StoredUser;
  let mockBcrypt: BcryptInterface;
  let mockJwt: JwtInterface;
  let mockAuthenticator: OtpAuthenticator;
  let storage: InMemorySessionStorage;

  beforeEach(async () => {
    // Create fresh mock user for each test to prevent state pollution
    mockUser = createMockUser();
    mockBcrypt = createMockBcrypt();
    mockJwt = createMockJwt();
    mockAuthenticator = createMockAuthenticator();
    storage = new InMemorySessionStorage();

    authService = new AuthService({
      config: {
        enableLogging: true,
      },
      sessionStorage: storage,
      userLookup: async (identifier) => (identifier === mockUser.email || identifier === mockUser.id ? mockUser : null),
      userUpdate: vi.fn(),
      auditLog: vi.fn(),
    });

    // Set up mock dependencies
    const tokenService = (authService as any).tokenService;
    tokenService.setJwt(mockJwt);

    const passwordService = (authService as any).passwordService;
    passwordService.setBcrypt(mockBcrypt);

    const mfaService = (authService as any).mfaService;
    mfaService.setAuthenticator(mockAuthenticator);

    await authService.initialize();
  });

  afterEach(async () => {
    storage.clear();
    // Reset all singletons to prevent test pollution
    const { resetAuthService } = await import('../src');
    resetAuthService();
  });

  describe('initialize', () => {
    it('should initialize services', async () => {
      const service = new AuthService({
        userLookup: async () => null,
      });

      // Set up mocks before initialize
      const tokenService = (service as any).tokenService;
      tokenService.setJwt(mockJwt);

      const passwordService = (service as any).passwordService;
      passwordService.setBcrypt(mockBcrypt);

      const mfaService = (service as any).mfaService;
      mfaService.setAuthenticator(mockAuthenticator);

      await service.initialize();

      // Second initialize should be idempotent
      await service.initialize();

      expect((service as any).initialized).toBe(true);
    });
  });

  describe('authenticate', () => {
    it('should authenticate valid credentials', async () => {
      const result = await authService.authenticate(
        { identifier: mockUser.email, password: 'ValidPassword123!' },
        { tenantId: mockUser.tenantId }
      );

      expect(result.success).toBe(true);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.sessionId).toBeDefined();
    });

    it('should reject invalid credentials', async () => {
      const result = await authService.authenticate(
        { identifier: mockUser.email, password: 'wrong' },
        { tenantId: mockUser.tenantId }
      );

      expect(result.success).toBe(false);
    });

    it('should require MFA when enabled', async () => {
      mockUser.mfaEnabled = true;

      const result = await authService.authenticate(
        { identifier: mockUser.email, password: 'ValidPassword123!' },
        { tenantId: mockUser.tenantId }
      );

      expect(result.success).toBe(false);
      expect(result.mfaRequired).toBe(true);
      expect(result.mfaChallengeId).toBeDefined();
    });

    it('should fail if no provider found', async () => {
      // Clear the registry
      (authService as any).providerRegistry.clear();

      const result = await authService.authenticate(
        { identifier: mockUser.email, password: 'ValidPassword123!' },
        { tenantId: mockUser.tenantId }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No authentication provider');
    });
  });

  describe('verifyMfa', () => {
    it('should verify MFA and complete authentication', async () => {
      mockUser.mfaEnabled = true;
      mockUser.mfaSecret = 'MOCK_SECRET';

      // First authenticate to get challenge
      const authResult = await authService.authenticate(
        { identifier: mockUser.email, password: 'ValidPassword123!' },
        { tenantId: mockUser.tenantId }
      );

      expect(authResult.mfaChallengeId).toBeDefined();

      // Verify MFA
      const result = await authService.verifyMfa(
        authResult.mfaChallengeId!,
        '123456',
        { tenantId: mockUser.tenantId }
      );

      expect(result.success).toBe(true);
      expect(result.accessToken).toBeDefined();
    });

    it('should reject invalid MFA challenge', async () => {
      const result = await authService.verifyMfa('invalid-challenge', '123456', {
        tenantId: 'tenant-1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid or expired MFA challenge');
    });

    it('should limit MFA attempts', async () => {
      mockUser.mfaEnabled = true;
      mockUser.mfaSecret = 'MOCK_SECRET';

      const authResult = await authService.authenticate(
        { identifier: mockUser.email, password: 'ValidPassword123!' },
        { tenantId: mockUser.tenantId }
      );

      // Invalid attempts
      for (let i = 0; i < 3; i++) {
        await authService.verifyMfa(authResult.mfaChallengeId!, '000000', {
          tenantId: mockUser.tenantId,
        });
      }

      // Should be locked out
      const result = await authService.verifyMfa(authResult.mfaChallengeId!, '123456', {
        tenantId: mockUser.tenantId,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens', async () => {
      const authResult = await authService.authenticate(
        { identifier: mockUser.email, password: 'ValidPassword123!' },
        { tenantId: mockUser.tenantId }
      );

      const result = await authService.refreshTokens(authResult.refreshToken!, {
        tenantId: mockUser.tenantId,
      });

      expect(result.tokens).toBeDefined();
      expect(result.tokens?.accessToken).toBeDefined();
    });

    it('should reject invalid refresh token', async () => {
      (mockJwt.verify as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await authService.refreshTokens('invalid', {
        tenantId: mockUser.tenantId,
      });

      expect(result.error).toBeDefined();
    });
  });

  describe('logout', () => {
    it('should invalidate session', async () => {
      const authResult = await authService.authenticate(
        { identifier: mockUser.email, password: 'ValidPassword123!' },
        { tenantId: mockUser.tenantId }
      );

      const result = await authService.logout(authResult.sessionId!, {
        tenantId: mockUser.tenantId,
      });

      expect(result).toBe(true);

      const session = await authService.getSession(authResult.sessionId!);
      expect(session).toBeNull();
    });
  });

  describe('logoutAll', () => {
    it('should invalidate all sessions', async () => {
      // Clear any existing sessions first
      storage.clear();

      await authService.authenticate(
        { identifier: mockUser.email, password: 'ValidPassword123!' },
        { tenantId: mockUser.tenantId }
      );
      await authService.authenticate(
        { identifier: mockUser.email, password: 'ValidPassword123!' },
        { tenantId: mockUser.tenantId }
      );

      const count = await authService.logoutAll(mockUser.id, {
        tenantId: mockUser.tenantId,
        userId: mockUser.id,
      });

      expect(count).toBe(2);
    });
  });

  describe('setupMfa', () => {
    it('should generate MFA setup data', async () => {
      const mfaService = (authService as any).mfaService;
      mfaService.setQrGenerator(createMockQrGenerator());

      const setup = await authService.setupMfa('user-123', 'test@example.com');

      expect(setup.secret).toBeDefined();
      expect(setup.backupCodes).toHaveLength(10);
    });
  });

  describe('enableMfa', () => {
    it('should enable MFA after verification', async () => {
      const result = await authService.enableMfa(
        mockUser.id,
        'MOCK_SECRET',
        '123456',
        ['BACKUP-CODE'],
        { tenantId: mockUser.tenantId }
      );

      expect(result.success).toBe(true);
    });

    it('should reject invalid token', async () => {
      const result = await authService.enableMfa(
        mockUser.id,
        'MOCK_SECRET',
        '000000',
        ['BACKUP-CODE'],
        { tenantId: mockUser.tenantId }
      );

      expect(result.success).toBe(false);
    });
  });

  describe('disableMfa', () => {
    it('should disable MFA with valid password', async () => {
      const result = await authService.disableMfa(mockUser.id, 'ValidPassword123!', {
        tenantId: mockUser.tenantId,
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid password', async () => {
      const result = await authService.disableMfa(mockUser.id, 'wrong', {
        tenantId: mockUser.tenantId,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('changePassword', () => {
    it('should change password', async () => {
      const result = await authService.changePassword(
        mockUser.id,
        'ValidPassword123!',
        'NewValidP@ss456',
        { tenantId: mockUser.tenantId }
      );

      expect(result.success).toBe(true);
    });

    it('should reject wrong current password', async () => {
      const result = await authService.changePassword(
        mockUser.id,
        'wrong',
        'NewValidP@ss456',
        { tenantId: mockUser.tenantId }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('incorrect');
    });

    it('should reject weak new password', async () => {
      const result = await authService.changePassword(
        mockUser.id,
        'ValidPassword123!',
        'weak',
        { tenantId: mockUser.tenantId }
      );

      expect(result.success).toBe(false);
    });

    it('should reject password in history', async () => {
      mockUser.passwordHistory = ['hashed:PreviousP@ss123'];

      const result = await authService.changePassword(
        mockUser.id,
        'ValidPassword123!',
        'PreviousP@ss123',
        { tenantId: mockUser.tenantId }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('reuse');
    });
  });

  describe('validateAccessToken', () => {
    it('should validate a valid token', async () => {
      const authResult = await authService.authenticate(
        { identifier: mockUser.email, password: 'ValidPassword123!' },
        { tenantId: mockUser.tenantId }
      );

      const result = authService.validateAccessToken(authResult.accessToken!);

      expect(result.valid).toBe(true);
      expect(result.user).toBeDefined();
    });

    it('should reject invalid token', () => {
      (mockJwt.verify as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = authService.validateAccessToken('invalid');

      expect(result.valid).toBe(false);
    });
  });

  describe('getUserSessions', () => {
    it('should return user sessions', async () => {
      await authService.authenticate(
        { identifier: mockUser.email, password: 'ValidPassword123!' },
        { tenantId: mockUser.tenantId }
      );

      const sessions = await authService.getUserSessions(mockUser.id, mockUser.tenantId);
      expect(sessions.length).toBeGreaterThan(0);
    });
  });

  describe('validatePassword', () => {
    it('should validate password without initialization', () => {
      const service = new AuthService();
      const result = service.validatePassword('weak');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('hashPassword', () => {
    it('should hash password', async () => {
      const hash = await authService.hashPassword('TestPassword123!');
      expect(hash).toBeDefined();
    });
  });

  describe('registerProvider', () => {
    it('should register a new provider', () => {
      const provider = createLocalProvider(async () => null, { id: 'custom' });
      authService.registerProvider(provider);

      const providers = authService.getProviders();
      expect(providers.some((p) => p.id === 'custom')).toBe(true);
    });
  });

  describe('getConfig', () => {
    it('should return configuration copy', () => {
      const config = authService.getConfig();
      expect(config).toBeDefined();
      expect(config.jwt).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should throw if not initialized for protected methods', () => {
      const uninitializedService = new AuthService();

      expect(() =>
        uninitializedService.validateAccessToken('token')
      ).toThrow('Auth service not initialized');
    });
  });
});
