/**
 * @package @forge/errors
 * @description Typed error codes and error handling
 */

// ============================================
// Error Codes
// ============================================

export enum ErrorCode {
  // Authentication (1xxx)
  UNAUTHENTICATED = 'AUTH_1001',
  INVALID_CREDENTIALS = 'AUTH_1002',
  SESSION_EXPIRED = 'AUTH_1003',
  MFA_REQUIRED = 'AUTH_1004',
  MFA_INVALID = 'AUTH_1005',
  TOKEN_EXPIRED = 'AUTH_1006',
  TOKEN_INVALID = 'AUTH_1007',

  // Authorization (2xxx)
  FORBIDDEN = 'AUTHZ_2001',
  INSUFFICIENT_PERMISSIONS = 'AUTHZ_2002',
  TENANT_MISMATCH = 'AUTHZ_2003',
  APPROVAL_REQUIRED = 'AUTHZ_2004',
  IP_NOT_ALLOWED = 'AUTHZ_2005',

  // Validation (3xxx)
  VALIDATION_FAILED = 'VAL_3001',
  INVALID_INPUT = 'VAL_3002',
  MISSING_REQUIRED_FIELD = 'VAL_3003',
  INVALID_FORMAT = 'VAL_3004',
  VALUE_OUT_OF_RANGE = 'VAL_3005',

  // Resource (4xxx)
  NOT_FOUND = 'RES_4001',
  ALREADY_EXISTS = 'RES_4002',
  CONFLICT = 'RES_4003',
  GONE = 'RES_4004',

  // Rate Limiting (5xxx)
  RATE_LIMIT_EXCEEDED = 'RATE_5001',
  QUOTA_EXCEEDED = 'RATE_5002',

  // External Services (6xxx)
  EXTERNAL_SERVICE_ERROR = 'EXT_6001',
  PAYMENT_FAILED = 'EXT_6002',
  EMAIL_DELIVERY_FAILED = 'EXT_6003',
  SMS_DELIVERY_FAILED = 'EXT_6004',

  // Internal (9xxx)
  INTERNAL_SERVER_ERROR = 'INT_9001',
  DATABASE_ERROR = 'INT_9002',
  CACHE_ERROR = 'INT_9003',
  QUEUE_ERROR = 'INT_9004',
  STORAGE_ERROR = 'INT_9005',
}

// ============================================
// Error Class
// ============================================

export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  statusCode: number;
  details?: unknown;
  metadata?: Record<string, unknown>;
}

export class ForgeError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;
  public readonly metadata?: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(params: ErrorDetails) {
    super(params.message);
    this.name = 'ForgeError';
    this.code = params.code;
    this.statusCode = params.statusCode;
    this.details = params.details;
    this.metadata = params.metadata;
    this.timestamp = new Date();

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ForgeError);
    }
  }

  /**
   * Serialize error for API response
   */
  toJSON(): Record<string, unknown> {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
      timestamp: this.timestamp.toISOString(),
    };
  }

  /**
   * Check if error is of a specific code
   */
  is(code: ErrorCode): boolean {
    return this.code === code;
  }

  /**
   * Check if error is in a category
   */
  isCategory(prefix: string): boolean {
    return this.code.startsWith(prefix);
  }
}

// ============================================
// Error Factory Functions
// ============================================

export function createAuthError(
  code: ErrorCode,
  message: string,
  details?: unknown
): ForgeError {
  return new ForgeError({
    code,
    message,
    statusCode: 401,
    details,
  });
}

export function createAuthzError(
  code: ErrorCode,
  message: string,
  details?: unknown
): ForgeError {
  return new ForgeError({
    code,
    message,
    statusCode: 403,
    details,
  });
}

export function createValidationError(
  code: ErrorCode,
  message: string,
  details?: unknown
): ForgeError {
  return new ForgeError({
    code,
    message,
    statusCode: 400,
    details,
  });
}

export function createNotFoundError(
  resource: string,
  id: string
): ForgeError {
  return new ForgeError({
    code: ErrorCode.NOT_FOUND,
    message: `${resource} with id ${id} not found`,
    statusCode: 404,
    details: { resource, id },
  });
}

export function createConflictError(
  message: string,
  details?: unknown
): ForgeError {
  return new ForgeError({
    code: ErrorCode.CONFLICT,
    message,
    statusCode: 409,
    details,
  });
}

export function createRateLimitError(
  message = 'Rate limit exceeded'
): ForgeError {
  return new ForgeError({
    code: ErrorCode.RATE_LIMIT_EXCEEDED,
    message,
    statusCode: 429,
  });
}

export function createInternalError(
  message = 'Internal server error',
  details?: unknown
): ForgeError {
  return new ForgeError({
    code: ErrorCode.INTERNAL_SERVER_ERROR,
    message,
    statusCode: 500,
    details,
  });
}

// ============================================
// Error Type Guards
// ============================================

export function isForgeError(error: unknown): error is ForgeError {
  return error instanceof ForgeError;
}

export function isAuthError(error: unknown): boolean {
  return isForgeError(error) && error.isCategory('AUTH_');
}

export function isAuthzError(error: unknown): boolean {
  return isForgeError(error) && error.isCategory('AUTHZ_');
}

export function isValidationError(error: unknown): boolean {
  return isForgeError(error) && error.isCategory('VAL_');
}

export function isNotFoundError(error: unknown): boolean {
  return isForgeError(error) && error.is(ErrorCode.NOT_FOUND);
}

// ============================================
// Error Handler Utility
// ============================================

export function handleError(error: unknown): ForgeError {
  if (isForgeError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return createInternalError(error.message, {
      originalError: error.name,
      stack: error.stack,
    });
  }

  return createInternalError('Unknown error occurred', { error });
}

// ============================================
// Error Messages
// ============================================

export const ErrorMessages = {
  // Authentication
  UNAUTHENTICATED: 'You must be authenticated to access this resource',
  INVALID_CREDENTIALS: 'Invalid email or password',
  SESSION_EXPIRED: 'Your session has expired. Please log in again',
  MFA_REQUIRED: 'Multi-factor authentication is required',
  TOKEN_EXPIRED: 'Authentication token has expired',

  // Authorization
  FORBIDDEN: 'You do not have permission to perform this action',
  INSUFFICIENT_PERMISSIONS: 'You do not have the required permissions',
  TENANT_MISMATCH: 'Access denied: resource belongs to a different tenant',
  APPROVAL_REQUIRED: 'This action requires approval from an administrator',
  IP_NOT_ALLOWED: 'Access denied: your IP address is not on the allowlist',

  // Validation
  VALIDATION_FAILED: 'Validation failed',
  INVALID_INPUT: 'Invalid input provided',
  MISSING_REQUIRED_FIELD: 'Required field is missing',

  // Resource
  NOT_FOUND: 'Resource not found',
  ALREADY_EXISTS: 'Resource already exists',
  CONFLICT: 'Request conflicts with current state',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded. Please try again later',
  QUOTA_EXCEEDED: 'Quota exceeded for this resource',

  // Internal
  INTERNAL_SERVER_ERROR: 'An internal error occurred. Please try again later',
} as const;
