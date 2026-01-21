/**
 * @package @forge/roles
 * @description External dependency type declarations
 */

// Re-export types from @forge/errors
declare module '@forge/errors' {
  export class ForgeError extends Error {
    code: string;
    statusCode: number;
    details?: unknown;

    constructor(options: {
      code: string;
      message: string;
      statusCode: number;
      details?: unknown;
    });
  }

  export enum ErrorCode {
    // General errors
    INTERNAL_ERROR = 'INTERNAL_ERROR',
    VALIDATION_FAILED = 'VALIDATION_FAILED',
    NOT_FOUND = 'NOT_FOUND',
    UNAUTHORIZED = 'UNAUTHORIZED',
    FORBIDDEN = 'FORBIDDEN',
    CONFLICT = 'CONFLICT',

    // RBAC specific errors
    ROLE_NOT_FOUND = 'ROLE_NOT_FOUND',
    ROLE_ALREADY_EXISTS = 'ROLE_ALREADY_EXISTS',
    PERMISSION_NOT_FOUND = 'PERMISSION_NOT_FOUND',
    PERMISSION_DENIED = 'PERMISSION_DENIED',
    INVALID_POLICY = 'INVALID_POLICY',
    CIRCULAR_INHERITANCE = 'CIRCULAR_INHERITANCE',
  }
}

// Re-export types from @forge/cache (optional peer dependency)
declare module '@forge/cache' {
  export interface CacheService {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttlMs?: number): Promise<void>;
    delete(key: string): Promise<boolean>;
    deleteMany(keys: string[]): Promise<number>;
  }
}
