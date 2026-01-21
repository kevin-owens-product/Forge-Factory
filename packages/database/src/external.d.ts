/**
 * @package @forge/database
 * @description External module declarations for workspace dependencies
 */

declare module '@forge/errors' {
  export enum ErrorCode {
    DATABASE_ERROR = 'INT_9002',
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

declare module '@forge/prisma' {
  export interface PrismaClient {
    $queryRaw: <T>(query: TemplateStringsArray | unknown, ...values: unknown[]) => Promise<T>;
    $transaction: <T>(fn: (tx: unknown) => Promise<T>, options?: {
      isolationLevel?: string;
      timeout?: number;
    }) => Promise<T>;
    $disconnect: () => Promise<void>;
    user: unknown;
    organization: unknown;
  }

  export function getPrismaClient(): PrismaClient;
  export function disconnectPrisma(): Promise<void>;

  export interface TenantClient {
    user: {
      findMany: (args?: unknown) => Promise<unknown[]>;
      findUnique: (args: unknown) => Promise<unknown | null>;
      create: (args: unknown) => Promise<unknown>;
      update: (args: unknown) => Promise<unknown>;
      delete: (args: unknown) => Promise<unknown>;
    };
    organization: {
      findMany: (args?: unknown) => Promise<unknown[]>;
      findUnique: (args: unknown) => Promise<unknown | null>;
      create: (args: unknown) => Promise<unknown>;
      update: (args: unknown) => Promise<unknown>;
      delete: (args: unknown) => Promise<unknown>;
    };
  }

  export function createTenantClient(tenantId: string): TenantClient;
}
