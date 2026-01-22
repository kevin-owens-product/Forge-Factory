/**
 * @package @forge/analysis
 * @description External type declarations for dependencies
 */

declare module '@forge/errors' {
  export class ForgeError extends Error {
    constructor(message: string, code?: string);
    code: string;
  }
}

declare module '@forge/cache' {
  export interface CacheService {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttl?: number): Promise<void>;
    delete(key: string): Promise<void>;
  }
}
