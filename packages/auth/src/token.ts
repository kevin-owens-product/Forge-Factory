/**
 * @package @forge/auth
 * @description JWT token handling
 */

import { ErrorCode, ForgeError } from '@forge/errors';
import {
  JwtConfig,
  TokenPayload,
  TokenPair,
  UserIdentity,
  DEFAULT_AUTH_CONFIG,
} from './auth.types';

/**
 * JWT interface for dependency injection
 */
export interface JwtInterface {
  sign(payload: object, secret: string, options?: JwtSignOptions): string;
  verify(token: string, secret: string, options?: JwtVerifyOptions): JwtPayload;
  decode(token: string, options?: { complete?: boolean }): JwtPayload | JwtDecoded | null;
}

/**
 * JWT sign options
 */
export interface JwtSignOptions {
  algorithm?: string;
  expiresIn?: string | number;
  issuer?: string;
  audience?: string;
  subject?: string;
  jwtid?: string;
}

/**
 * JWT verify options
 */
export interface JwtVerifyOptions {
  algorithms?: string[];
  issuer?: string | string[];
  audience?: string | string[];
  ignoreExpiration?: boolean;
  clockTolerance?: number;
}

/**
 * JWT payload from verify/decode
 */
export interface JwtPayload {
  [key: string]: unknown;
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
}

/**
 * Decoded JWT with header
 */
export interface JwtDecoded {
  header: { alg: string; typ?: string };
  payload: JwtPayload;
  signature: string;
}

/**
 * Token verification result
 */
export interface TokenVerificationResult {
  /** Whether token is valid */
  valid: boolean;
  /** Decoded payload (if valid) */
  payload?: TokenPayload;
  /** Error message (if invalid) */
  error?: string;
  /** Error code */
  errorCode?: string;
  /** Whether token is expired */
  expired?: boolean;
}

/**
 * Token service class
 */
export class TokenService {
  private config: JwtConfig;
  private jwt: JwtInterface | null = null;

  constructor(config: Partial<JwtConfig> = {}) {
    this.config = { ...DEFAULT_AUTH_CONFIG.jwt, ...config };
  }

  /**
   * Initialize JWT library
   */
  async initialize(): Promise<void> {
    if (!this.jwt) {
      try {
        const jwtModule = await import('jsonwebtoken');
        this.jwt = jwtModule;
      } catch {
        throw new ForgeError({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'jsonwebtoken module not available. Please install jsonwebtoken package.',
          statusCode: 500,
        });
      }
    }
  }

  /**
   * Set JWT implementation (for testing)
   */
  setJwt(jwt: JwtInterface): void {
    this.jwt = jwt;
  }

  /**
   * Get JWT instance
   */
  private getJwt(): JwtInterface {
    if (!this.jwt) {
      throw new ForgeError({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Token service not initialized. Call initialize() first.',
        statusCode: 500,
      });
    }
    return this.jwt;
  }

  /**
   * Generate a token pair (access + refresh)
   */
  generateTokenPair(user: UserIdentity, sessionId?: string): TokenPair {
    const jwt = this.getJwt();
    const now = Date.now();

    // Generate access token
    const accessPayload: TokenPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roles: user.roles,
      permissions: user.permissions,
      sessionId,
      type: 'access',
    };

    const accessToken = jwt.sign(accessPayload, this.config.secret, {
      algorithm: this.config.algorithm,
      expiresIn: this.config.accessTokenExpiry,
      issuer: this.config.issuer,
      audience: this.config.audience,
      subject: user.id,
      jwtid: this.generateTokenId(),
    });

    // Generate refresh token
    const refreshPayload: TokenPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roles: user.roles,
      permissions: user.permissions,
      sessionId,
      type: 'refresh',
    };

    const refreshToken = jwt.sign(refreshPayload, this.config.secret, {
      algorithm: this.config.algorithm,
      expiresIn: this.config.refreshTokenExpiry,
      issuer: this.config.issuer,
      audience: this.config.audience,
      subject: user.id,
      jwtid: this.generateTokenId(),
    });

    // Calculate expiry times
    const accessTokenExpiresAt = this.calculateExpiry(this.config.accessTokenExpiry, now);
    const refreshTokenExpiresAt = this.calculateExpiry(this.config.refreshTokenExpiry, now);

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
    };
  }

  /**
   * Generate access token only
   */
  generateAccessToken(user: UserIdentity, sessionId?: string): string {
    const jwt = this.getJwt();

    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roles: user.roles,
      permissions: user.permissions,
      sessionId,
      type: 'access',
    };

    return jwt.sign(payload, this.config.secret, {
      algorithm: this.config.algorithm,
      expiresIn: this.config.accessTokenExpiry,
      issuer: this.config.issuer,
      audience: this.config.audience,
      subject: user.id,
      jwtid: this.generateTokenId(),
    });
  }

  /**
   * Generate refresh token only
   */
  generateRefreshToken(user: UserIdentity, sessionId?: string): string {
    const jwt = this.getJwt();

    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roles: user.roles,
      permissions: user.permissions,
      sessionId,
      type: 'refresh',
    };

    return jwt.sign(payload, this.config.secret, {
      algorithm: this.config.algorithm,
      expiresIn: this.config.refreshTokenExpiry,
      issuer: this.config.issuer,
      audience: this.config.audience,
      subject: user.id,
      jwtid: this.generateTokenId(),
    });
  }

  /**
   * Verify a token
   */
  verifyToken(token: string, expectedType?: 'access' | 'refresh'): TokenVerificationResult {
    const jwt = this.getJwt();

    try {
      const payload = jwt.verify(token, this.config.secret, {
        algorithms: [this.config.algorithm],
        issuer: this.config.issuer,
        audience: this.config.audience,
      }) as unknown as TokenPayload;

      // Check token type if specified
      if (expectedType && payload.type !== expectedType) {
        return {
          valid: false,
          error: `Expected ${expectedType} token, got ${payload.type}`,
          errorCode: ErrorCode.TOKEN_INVALID,
        };
      }

      return {
        valid: true,
        payload,
      };
    } catch (error) {
      return this.handleVerificationError(error);
    }
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): TokenVerificationResult {
    return this.verifyToken(token, 'access');
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): TokenVerificationResult {
    return this.verifyToken(token, 'refresh');
  }

  /**
   * Decode a token without verification
   */
  decodeToken(token: string): TokenPayload | null {
    const jwt = this.getJwt();
    const decoded = jwt.decode(token);
    return decoded as TokenPayload | null;
  }

  /**
   * Decode token with header
   */
  decodeTokenComplete(token: string): JwtDecoded | null {
    const jwt = this.getJwt();
    return jwt.decode(token, { complete: true }) as JwtDecoded | null;
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    const payload = this.decodeToken(token);
    if (!payload || !payload.exp) {
      return true;
    }
    return Date.now() >= payload.exp * 1000;
  }

  /**
   * Get token expiry time
   */
  getTokenExpiry(token: string): Date | null {
    const payload = this.decodeToken(token);
    if (!payload || !payload.exp) {
      return null;
    }
    return new Date(payload.exp * 1000);
  }

  /**
   * Get remaining token TTL in seconds
   */
  getTokenTtl(token: string): number {
    const payload = this.decodeToken(token);
    if (!payload || !payload.exp) {
      return 0;
    }
    const remaining = payload.exp * 1000 - Date.now();
    return Math.max(0, Math.floor(remaining / 1000));
  }

  /**
   * Refresh tokens using a refresh token
   */
  refreshTokens(refreshToken: string): TokenPair | null {
    const result = this.verifyRefreshToken(refreshToken);
    if (!result.valid || !result.payload) {
      return null;
    }

    const user: UserIdentity = {
      id: result.payload.sub,
      email: result.payload.email,
      tenantId: result.payload.tenantId,
      roles: result.payload.roles,
      permissions: result.payload.permissions,
      emailVerified: true,
      mfaEnabled: false,
    };

    return this.generateTokenPair(user, result.payload.sessionId);
  }

  /**
   * Extract user identity from token payload
   */
  extractUserFromPayload(payload: TokenPayload): UserIdentity {
    return {
      id: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      roles: payload.roles,
      permissions: payload.permissions,
      emailVerified: true, // Assumed true if they have a valid token
      mfaEnabled: false, // Not stored in token
    };
  }

  /**
   * Generate a unique token ID
   */
  private generateTokenId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `${timestamp}-${random}`;
  }

  /**
   * Calculate expiry date from duration string
   */
  private calculateExpiry(duration: string, fromTime: number = Date.now()): Date {
    const match = duration.match(/^(\d+)([smhdw])$/);
    if (!match) {
      // Default to 1 hour if invalid
      return new Date(fromTime + 3600000);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    let milliseconds: number;
    switch (unit) {
      case 's':
        milliseconds = value * 1000;
        break;
      case 'm':
        milliseconds = value * 60 * 1000;
        break;
      case 'h':
        milliseconds = value * 60 * 60 * 1000;
        break;
      case 'd':
        milliseconds = value * 24 * 60 * 60 * 1000;
        break;
      case 'w':
        milliseconds = value * 7 * 24 * 60 * 60 * 1000;
        break;
      default:
        milliseconds = 3600000; // Default 1 hour
    }

    return new Date(fromTime + milliseconds);
  }

  /**
   * Handle JWT verification errors
   */
  private handleVerificationError(error: unknown): TokenVerificationResult {
    if (error instanceof Error) {
      const name = error.name;

      if (name === 'TokenExpiredError') {
        return {
          valid: false,
          error: 'Token has expired',
          errorCode: ErrorCode.TOKEN_EXPIRED,
          expired: true,
        };
      }

      if (name === 'JsonWebTokenError') {
        return {
          valid: false,
          error: error.message || 'Invalid token',
          errorCode: ErrorCode.TOKEN_INVALID,
        };
      }

      if (name === 'NotBeforeError') {
        return {
          valid: false,
          error: 'Token not yet valid',
          errorCode: ErrorCode.TOKEN_INVALID,
        };
      }

      return {
        valid: false,
        error: error.message,
        errorCode: ErrorCode.TOKEN_INVALID,
      };
    }

    return {
      valid: false,
      error: 'Unknown token error',
      errorCode: ErrorCode.TOKEN_INVALID,
    };
  }

  /**
   * Get configuration
   */
  getConfig(): JwtConfig {
    return { ...this.config };
  }
}

// Singleton instance
let tokenServiceInstance: TokenService | null = null;

/**
 * Get the singleton token service instance
 */
export function getTokenService(config?: Partial<JwtConfig>): TokenService {
  if (!tokenServiceInstance) {
    tokenServiceInstance = new TokenService(config);
  }
  return tokenServiceInstance;
}

/**
 * Reset the singleton token service instance (for testing)
 */
export function resetTokenService(): void {
  tokenServiceInstance = null;
}
