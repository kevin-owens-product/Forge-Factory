/**
 * External module declarations for @forge/design-system
 */

declare module '@forge/errors' {
  export enum ErrorCode {
    INTERNAL_ERROR = 'INTERNAL_ERROR',
    VALIDATION_FAILED = 'VALIDATION_FAILED',
    NOT_FOUND = 'NOT_FOUND',
    CONFLICT = 'CONFLICT',
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
