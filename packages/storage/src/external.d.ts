/**
 * @package @forge/storage
 * @description External module declarations for workspace dependencies
 */

// Node.js globals
declare function setTimeout(callback: () => void, ms?: number): ReturnType<typeof globalThis.setTimeout>;
declare function clearTimeout(id: ReturnType<typeof globalThis.setTimeout>): void;

declare const Buffer: {
  from(str: string, encoding?: string): Buffer;
  from(arr: number[]): Buffer;
  isBuffer(obj: unknown): obj is Buffer;
  byteLength(str: string, encoding?: string): number;
  alloc(size: number, fill?: number): Buffer;
  concat(list: Buffer[]): Buffer;
};

interface Buffer {
  length: number;
  toString(encoding?: string): string;
  slice(start?: number, end?: number): Buffer;
  [index: number]: number;
}

declare module '@forge/errors' {
  export enum ErrorCode {
    STORAGE_ERROR = 'INT_9005',
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
