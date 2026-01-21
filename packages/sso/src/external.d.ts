/**
 * @package @forge/sso
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
    SSO_CONFIG_INVALID = 'SSO_2001',
    SSO_PROVIDER_ERROR = 'SSO_2002',
    SSO_ASSERTION_INVALID = 'SSO_2003',
    SSO_SIGNATURE_INVALID = 'SSO_2004',
    SSO_EXPIRED = 'SSO_2005',
    SSO_STATE_INVALID = 'SSO_2006',
    SSO_TOKEN_INVALID = 'SSO_2007',
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

declare module '@forge/auth' {
  export interface UserIdentity {
    id: string;
    email: string;
    username?: string;
    tenantId: string;
    roles: string[];
    permissions: string[];
    emailVerified: boolean;
    mfaEnabled: boolean;
    metadata?: Record<string, unknown>;
  }

  export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: Date;
    refreshTokenExpiresAt: Date;
  }

  export interface Session {
    id: string;
    userId: string;
    tenantId: string;
    createdAt: Date;
    lastActivityAt: Date;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
    isActive: boolean;
    metadata?: Record<string, unknown>;
  }
}

declare module 'xml2js' {
  export interface ParserOptions {
    explicitArray?: boolean;
    ignoreAttrs?: boolean;
    tagNameProcessors?: Array<(name: string) => string>;
    attrNameProcessors?: Array<(name: string) => string>;
    valueProcessors?: Array<(value: string, name: string) => unknown>;
    attrValueProcessors?: Array<(value: string, name: string) => unknown>;
  }

  export class Parser {
    constructor(options?: ParserOptions);
    parseStringPromise(xml: string): Promise<unknown>;
  }

  export function parseStringPromise(xml: string, options?: ParserOptions): Promise<unknown>;
}

declare module 'xmlbuilder2' {
  export interface XMLBuilderOptions {
    version?: string;
    encoding?: string;
    standalone?: boolean;
  }

  export interface XMLBuilder {
    ele(name: string, attributes?: Record<string, string>): XMLBuilder;
    txt(text: string): XMLBuilder;
    up(): XMLBuilder;
    end(options?: { prettyPrint?: boolean }): string;
    toString(options?: { prettyPrint?: boolean }): string;
  }

  export function create(options?: XMLBuilderOptions): XMLBuilder;
  export function create(root: Record<string, unknown>): XMLBuilder;
}

declare module 'node-forge' {
  export namespace pki {
    interface Certificate {
      publicKey: PublicKey;
      validity: {
        notBefore: Date;
        notAfter: Date;
      };
      subject: {
        getField(name: string): { value: string } | null;
      };
      issuer: {
        getField(name: string): { value: string } | null;
      };
      serialNumber: string;
    }

    interface PublicKey {
      n: { toString(radix: number): string };
      e: { toString(radix: number): string };
    }

    interface PrivateKey {}

    function certificateFromPem(pem: string): Certificate;
    function privateKeyFromPem(pem: string): PrivateKey;
    function publicKeyFromPem(pem: string): PublicKey;
  }

  export namespace md {
    namespace sha1 {
      function create(): MessageDigest;
    }
    namespace sha256 {
      function create(): MessageDigest;
    }
    interface MessageDigest {
      update(data: string): void;
      digest(): { toHex(): string };
    }
  }

  export namespace util {
    function encode64(data: string): string;
    function decode64(data: string): string;
  }
}
