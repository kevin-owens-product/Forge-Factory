/**
 * @package @forge/auth
 * @description External module declarations for workspace dependencies
 */

declare module '@forge/errors' {
  export enum ErrorCode {
    UNAUTHENTICATED = 'AUTH_1001',
    INVALID_CREDENTIALS = 'AUTH_1002',
    SESSION_EXPIRED = 'AUTH_1003',
    MFA_REQUIRED = 'AUTH_1004',
    MFA_INVALID = 'AUTH_1005',
    TOKEN_EXPIRED = 'AUTH_1006',
    TOKEN_INVALID = 'AUTH_1007',
    VALIDATION_FAILED = 'VAL_3001',
    NOT_FOUND = 'RES_4001',
    ALREADY_EXISTS = 'RES_4002',
    RATE_LIMIT_EXCEEDED = 'RATE_5001',
  }

  export interface ErrorDetails {
    code: ErrorCode;
    message: string;
    statusCode: number;
    details?: unknown;
    metadata?: Record<string, unknown>;
  }

  export class ForgeError extends Error {
    readonly code: ErrorCode;
    readonly statusCode: number;
    readonly details?: unknown;
    readonly metadata?: Record<string, unknown>;
    constructor(params: ErrorDetails);
  }
}

declare module 'bcrypt' {
  export function hash(data: string, saltOrRounds: string | number): Promise<string>;
  export function compare(data: string, encrypted: string): Promise<boolean>;
  export function genSalt(rounds?: number): Promise<string>;
  export function hashSync(data: string, saltOrRounds: string | number): string;
  export function compareSync(data: string, encrypted: string): boolean;
  export function genSaltSync(rounds?: number): string;
}

declare module 'jsonwebtoken' {
  export interface SignOptions {
    algorithm?: string;
    expiresIn?: string | number;
    notBefore?: string | number;
    audience?: string | string[];
    issuer?: string;
    jwtid?: string;
    subject?: string;
    noTimestamp?: boolean;
    header?: object;
    keyid?: string;
  }

  export interface VerifyOptions {
    algorithms?: string[];
    audience?: string | string[];
    complete?: boolean;
    issuer?: string | string[];
    jwtid?: string;
    ignoreExpiration?: boolean;
    ignoreNotBefore?: boolean;
    subject?: string;
    clockTolerance?: number;
    maxAge?: string | number;
    clockTimestamp?: number;
    nonce?: string;
  }

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

  export interface Jwt {
    header: { alg: string; typ?: string; kid?: string };
    payload: JwtPayload;
    signature: string;
  }

  export function sign(
    payload: string | Buffer | object,
    secretOrPrivateKey: string | Buffer,
    options?: SignOptions
  ): string;

  export function verify(
    token: string,
    secretOrPublicKey: string | Buffer,
    options?: VerifyOptions
  ): JwtPayload;

  export function decode(
    token: string,
    options?: { complete?: boolean; json?: boolean }
  ): null | JwtPayload | Jwt;

  export class TokenExpiredError extends Error {
    expiredAt: Date;
    constructor(message: string, expiredAt: Date);
  }

  export class JsonWebTokenError extends Error {
    constructor(message: string, error?: Error);
  }

  export class NotBeforeError extends Error {
    date: Date;
    constructor(message: string, date: Date);
  }
}

declare module 'otplib' {
  export const authenticator: {
    generate(secret: string): string;
    check(token: string, secret: string): boolean;
    verify(options: { token: string; secret: string }): boolean;
    generateSecret(length?: number): string;
    keyuri(user: string, service: string, secret: string): string;
    options: {
      digits?: number;
      step?: number;
      window?: number;
    };
  };

  export const totp: {
    generate(secret: string): string;
    check(token: string, secret: string): boolean;
    verify(options: { token: string; secret: string }): boolean;
  };
}
