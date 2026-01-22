/**
 * External module declarations for @forge/compliance
 */

declare module '@forge/errors' {
  export enum ErrorCode {
    // Generic errors
    INTERNAL_ERROR = 'INTERNAL_ERROR',
    VALIDATION_FAILED = 'VALIDATION_FAILED',
    NOT_FOUND = 'NOT_FOUND',
    CONFLICT = 'CONFLICT',
    FORBIDDEN = 'FORBIDDEN',
    UNAUTHORIZED = 'UNAUTHORIZED',

    // Compliance-specific errors
    AUDIT_WRITE_FAILED = 'AUDIT_WRITE_FAILED',
    AUDIT_READ_FAILED = 'AUDIT_READ_FAILED',
    RETENTION_POLICY_INVALID = 'RETENTION_POLICY_INVALID',
    EXPORT_FAILED = 'EXPORT_FAILED',
    INTEGRITY_CHECK_FAILED = 'INTEGRITY_CHECK_FAILED',
  }

  export interface ForgeErrorOptions {
    code: ErrorCode;
    message: string;
    statusCode?: number;
    details?: Record<string, unknown>;
    cause?: Error;
  }

  export class ForgeError extends Error {
    code: ErrorCode;
    statusCode: number;
    details?: Record<string, unknown>;
    cause?: Error;
    timestamp: Date;

    constructor(options: ForgeErrorOptions);
    toJSON(): Record<string, unknown>;
  }
}

declare module '@forge/storage' {
  export interface StorageService {
    upload(key: string, data: Buffer | string, options?: UploadOptions): Promise<UploadResult>;
    download(key: string): Promise<Buffer>;
    delete(key: string): Promise<boolean>;
    exists(key: string): Promise<boolean>;
    list(prefix: string): Promise<ListResult>;
  }

  export interface UploadOptions {
    contentType?: string;
    metadata?: Record<string, string>;
  }

  export interface UploadResult {
    key: string;
    size: number;
    etag?: string;
  }

  export interface ListResult {
    objects: Array<{
      key: string;
      size: number;
      lastModified: Date;
    }>;
    isTruncated: boolean;
    continuationToken?: string;
  }

  export function createStorageService(config: unknown): StorageService;
}
