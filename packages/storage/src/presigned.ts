/**
 * @package @forge/storage
 * @description Presigned URL generation for S3/R2 storage
 */

import { ErrorCode, ForgeError } from '@forge/errors';
import { S3Client } from './s3-client';
import {
  PresignedUrlOptions,
  PresignedUrlResult,
  DEFAULT_STORAGE_CONFIG,
} from './storage.types';
import { buildTenantKey, normalizeKey } from './file-utils';

/**
 * Presigned URL generator class
 */
export class PresignedUrlGenerator {
  private s3Client: S3Client;
  private defaultBucket: string;
  private defaultExpirySeconds: number;

  constructor(
    s3Client: S3Client,
    defaultBucket: string,
    defaultExpirySeconds: number = DEFAULT_STORAGE_CONFIG.defaultPresignedExpirySeconds
  ) {
    this.s3Client = s3Client;
    this.defaultBucket = defaultBucket;
    this.defaultExpirySeconds = defaultExpirySeconds;
  }

  /**
   * Generate a presigned URL for downloading an object
   */
  async getDownloadUrl(
    key: string,
    options: PresignedUrlOptions = {}
  ): Promise<PresignedUrlResult> {
    const bucket = options.bucket || this.defaultBucket;
    const expiresIn = options.expiresIn || this.defaultExpirySeconds;

    // Build the key with tenant prefix if provided
    const resolvedKey = options.tenantId
      ? buildTenantKey(options.tenantId, key)
      : normalizeKey(key);

    try {
      const factory = this.s3Client.getCommandFactory();
      const commandParams: {
        bucket: string;
        key: string;
        versionId?: string;
      } = {
        bucket,
        key: resolvedKey,
      };

      if (options.versionId) {
        commandParams.versionId = options.versionId;
      }

      // Create GetObject command with response overrides
      const command = factory.createGetObjectCommand(commandParams);

      // Add response overrides to command input
      if (options.responseContentType || options.responseContentDisposition) {
        const input = command as { input?: Record<string, unknown> };
        if (input.input) {
          if (options.responseContentType) {
            input.input.ResponseContentType = options.responseContentType;
          }
          if (options.responseContentDisposition) {
            input.input.ResponseContentDisposition = options.responseContentDisposition;
          }
        }
      }

      const url = await this.s3Client.getPresignedUrl(command, expiresIn);
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      return {
        url,
        expiresAt,
        method: 'GET',
      };
    } catch (error) {
      throw this.wrapError(error, `Failed to generate download URL for: ${resolvedKey}`);
    }
  }

  /**
   * Generate a presigned URL for uploading an object
   */
  async getUploadUrl(
    key: string,
    options: PresignedUrlOptions = {}
  ): Promise<PresignedUrlResult> {
    const bucket = options.bucket || this.defaultBucket;
    const expiresIn = options.expiresIn || this.defaultExpirySeconds;

    // Build the key with tenant prefix if provided
    const resolvedKey = options.tenantId
      ? buildTenantKey(options.tenantId, key)
      : normalizeKey(key);

    try {
      const factory = this.s3Client.getCommandFactory();

      // Create PutObject command
      const commandParams: {
        bucket: string;
        key: string;
        body: Buffer;
        contentType?: string;
      } = {
        bucket,
        key: resolvedKey,
        body: Buffer.alloc(0), // Empty body for presigned URL
      };

      if (options.contentType) {
        commandParams.contentType = options.contentType;
      }

      const command = factory.createPutObjectCommand(commandParams);

      // Add content disposition to command input if provided
      if (options.contentDisposition) {
        const input = command as { input?: Record<string, unknown> };
        if (input.input) {
          input.input.ContentDisposition = options.contentDisposition;
        }
      }

      const url = await this.s3Client.getPresignedUrl(command, expiresIn);
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      const result: PresignedUrlResult = {
        url,
        expiresAt,
        method: 'PUT',
      };

      // Include required headers if content type specified
      if (options.contentType) {
        result.headers = {
          'Content-Type': options.contentType,
        };
      }

      return result;
    } catch (error) {
      throw this.wrapError(error, `Failed to generate upload URL for: ${resolvedKey}`);
    }
  }

  /**
   * Generate multiple download URLs in batch
   */
  async getBatchDownloadUrls(
    keys: string[],
    options: PresignedUrlOptions = {}
  ): Promise<Map<string, PresignedUrlResult>> {
    const results = new Map<string, PresignedUrlResult>();

    await Promise.all(
      keys.map(async (key) => {
        try {
          const result = await this.getDownloadUrl(key, options);
          results.set(key, result);
        } catch (error) {
          // Include error in result for failed URLs
          results.set(key, {
            url: '',
            expiresAt: new Date(),
            method: 'GET',
            headers: { error: error instanceof Error ? error.message : 'Unknown error' },
          });
        }
      })
    );

    return results;
  }

  /**
   * Generate multiple upload URLs in batch
   */
  async getBatchUploadUrls(
    keys: string[],
    options: PresignedUrlOptions = {}
  ): Promise<Map<string, PresignedUrlResult>> {
    const results = new Map<string, PresignedUrlResult>();

    await Promise.all(
      keys.map(async (key) => {
        try {
          const result = await this.getUploadUrl(key, options);
          results.set(key, result);
        } catch (error) {
          // Include error in result for failed URLs
          results.set(key, {
            url: '',
            expiresAt: new Date(),
            method: 'PUT',
            headers: { error: error instanceof Error ? error.message : 'Unknown error' },
          });
        }
      })
    );

    return results;
  }

  /**
   * Generate a presigned URL for multipart upload part
   */
  async getMultipartPartUploadUrl(
    key: string,
    uploadId: string,
    partNumber: number,
    options: PresignedUrlOptions = {}
  ): Promise<PresignedUrlResult> {
    const bucket = options.bucket || this.defaultBucket;
    const expiresIn = options.expiresIn || this.defaultExpirySeconds;

    // Build the key with tenant prefix if provided
    const resolvedKey = options.tenantId
      ? buildTenantKey(options.tenantId, key)
      : normalizeKey(key);

    try {
      const factory = this.s3Client.getCommandFactory();

      // Create UploadPart command
      const command = factory.createUploadPartCommand({
        bucket,
        key: resolvedKey,
        uploadId,
        partNumber,
        body: Buffer.alloc(0), // Empty body for presigned URL
      });

      const url = await this.s3Client.getPresignedUrl(command, expiresIn);
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      return {
        url,
        expiresAt,
        method: 'PUT',
      };
    } catch (error) {
      throw this.wrapError(error, `Failed to generate multipart upload URL for part ${partNumber}: ${resolvedKey}`);
    }
  }

  /**
   * Validate a presigned URL (check if it's still valid)
   */
  isUrlExpired(expiresAt: Date): boolean {
    return new Date() >= expiresAt;
  }

  /**
   * Calculate remaining TTL for a presigned URL
   */
  getRemainingTtl(expiresAt: Date): number {
    const remaining = expiresAt.getTime() - Date.now();
    return Math.max(0, Math.floor(remaining / 1000));
  }

  /**
   * Wrap error in ForgeError
   */
  private wrapError(error: unknown, message: string): ForgeError {
    if (error instanceof ForgeError) {
      return error;
    }
    return new ForgeError({
      code: ErrorCode.STORAGE_ERROR,
      message: `${message}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      statusCode: 500,
      details: { error },
    });
  }
}

/**
 * Create a presigned URL generator instance
 */
export function createPresignedUrlGenerator(
  s3Client: S3Client,
  defaultBucket: string,
  defaultExpirySeconds?: number
): PresignedUrlGenerator {
  return new PresignedUrlGenerator(s3Client, defaultBucket, defaultExpirySeconds);
}
