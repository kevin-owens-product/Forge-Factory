/**
 * @package @forge/storage
 * @description S3-compatible client wrapper for Forge Factory
 */

import { Readable } from 'stream';
import { ErrorCode, ForgeError } from '@forge/errors';
import {
  S3Config,
  DEFAULT_S3_CONFIG,
  ConnectionStatus,
  FileMetadata,
  BucketInfo,
  CompletedPart,
} from './storage.types';

/**
 * S3 client command types (from @aws-sdk/client-s3)
 */
export interface S3ClientCommand<T = unknown> {
  input: unknown;
  middlewareStack?: unknown;
  resolveMiddleware?: unknown;
  output?: T;
}

/**
 * S3 client interface for dependency injection
 */
export interface S3ClientInterface {
  send<T>(command: S3ClientCommand<T>): Promise<T>;
  destroy(): void;
}

/**
 * S3 presigner interface
 */
export interface S3PresignerInterface {
  presign(request: unknown, options?: { expiresIn?: number }): Promise<{ url: string }>;
}

/**
 * S3 command factory interface
 */
export interface S3CommandFactory {
  createHeadBucketCommand(bucket: string): S3ClientCommand;
  createListBucketsCommand(): S3ClientCommand;
  createCreateBucketCommand(bucket: string, region?: string): S3ClientCommand;
  createDeleteBucketCommand(bucket: string): S3ClientCommand;
  createPutObjectCommand(params: PutObjectParams): S3ClientCommand;
  createGetObjectCommand(params: GetObjectParams): S3ClientCommand;
  createHeadObjectCommand(params: HeadObjectParams): S3ClientCommand;
  createDeleteObjectCommand(params: DeleteObjectParams): S3ClientCommand;
  createDeleteObjectsCommand(params: DeleteObjectsParams): S3ClientCommand;
  createListObjectsV2Command(params: ListObjectsParams): S3ClientCommand;
  createCopyObjectCommand(params: CopyObjectParams): S3ClientCommand;
  createCreateMultipartUploadCommand(params: CreateMultipartParams): S3ClientCommand;
  createUploadPartCommand(params: UploadPartParams): S3ClientCommand;
  createCompleteMultipartUploadCommand(params: CompleteMultipartParams): S3ClientCommand;
  createAbortMultipartUploadCommand(params: AbortMultipartParams): S3ClientCommand;
}

/**
 * Put object parameters
 */
export interface PutObjectParams {
  bucket: string;
  key: string;
  body: Buffer | Readable | string;
  contentType?: string;
  metadata?: Record<string, string>;
  storageClass?: string;
  cacheControl?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  serverSideEncryption?: string;
  kmsKeyId?: string;
  acl?: string;
  tagging?: string;
}

/**
 * Get object parameters
 */
export interface GetObjectParams {
  bucket: string;
  key: string;
  versionId?: string;
  range?: string;
}

/**
 * Head object parameters
 */
export interface HeadObjectParams {
  bucket: string;
  key: string;
  versionId?: string;
}

/**
 * Delete object parameters
 */
export interface DeleteObjectParams {
  bucket: string;
  key: string;
  versionId?: string;
}

/**
 * Delete multiple objects parameters
 */
export interface DeleteObjectsParams {
  bucket: string;
  keys: Array<{ key: string; versionId?: string }>;
}

/**
 * List objects parameters
 */
export interface ListObjectsParams {
  bucket: string;
  prefix?: string;
  delimiter?: string;
  maxKeys?: number;
  continuationToken?: string;
}

/**
 * Copy object parameters
 */
export interface CopyObjectParams {
  sourceBucket: string;
  sourceKey: string;
  destinationBucket: string;
  destinationKey: string;
  contentType?: string;
  metadata?: Record<string, string>;
  metadataDirective?: 'COPY' | 'REPLACE';
  acl?: string;
}

/**
 * Create multipart upload parameters
 */
export interface CreateMultipartParams {
  bucket: string;
  key: string;
  contentType?: string;
  metadata?: Record<string, string>;
  storageClass?: string;
  serverSideEncryption?: string;
  kmsKeyId?: string;
  acl?: string;
}

/**
 * Upload part parameters
 */
export interface UploadPartParams {
  bucket: string;
  key: string;
  uploadId: string;
  partNumber: number;
  body: Buffer | Readable;
}

/**
 * Complete multipart upload parameters
 */
export interface CompleteMultipartParams {
  bucket: string;
  key: string;
  uploadId: string;
  parts: CompletedPart[];
}

/**
 * Abort multipart upload parameters
 */
export interface AbortMultipartParams {
  bucket: string;
  key: string;
  uploadId: string;
}

/**
 * S3 Client wrapper class
 */
export class S3Client {
  private client: S3ClientInterface | null = null;
  private commandFactory: S3CommandFactory | null = null;
  private presigner: S3PresignerInterface | null = null;
  private config: S3Config;
  private status: ConnectionStatus = 'disconnected';
  private listeners: Map<string, Set<(data?: unknown) => void>> = new Map();

  constructor(config: Partial<S3Config> = {}) {
    this.config = { ...DEFAULT_S3_CONFIG, ...config };
  }

  /**
   * Initialize the S3 client
   */
  async connect(): Promise<void> {
    if (this.status === 'connected' && this.client) {
      return;
    }

    this.status = 'connecting';
    this.emit('connecting');

    try {
      // Dynamic import of AWS SDK
      const { S3Client: AwsS3Client } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

      const clientConfig: Record<string, unknown> = {
        region: this.config.region,
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        },
        maxAttempts: this.config.maxRetries,
        requestHandler: {
          requestTimeout: this.config.requestTimeoutMs,
          connectionTimeout: this.config.connectTimeoutMs,
        },
      };

      if (this.config.endpoint) {
        clientConfig.endpoint = this.config.endpoint;
      }

      if (this.config.forcePathStyle) {
        clientConfig.forcePathStyle = true;
      }

      const awsClient = new AwsS3Client(clientConfig);

      // Create adapter for S3ClientInterface
      this.client = {
        send: async <T>(command: S3ClientCommand<T>): Promise<T> => {
          return awsClient.send(command as Parameters<typeof awsClient.send>[0]) as Promise<T>;
        },
        destroy: () => awsClient.destroy(),
      };

      // Create command factory
      this.commandFactory = await this.createCommandFactory();

      // Create presigner wrapper
      this.presigner = {
        presign: async (command: unknown, options?: { expiresIn?: number }): Promise<{ url: string }> => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const url = await getSignedUrl(awsClient, command as any, options);
          return { url };
        },
      };

      this.status = 'connected';
      this.emit('connected');
    } catch (error) {
      this.status = 'error';
      this.emit('error', { error });
      throw new ForgeError({
        code: ErrorCode.STORAGE_ERROR,
        message: `Failed to connect to S3: ${error instanceof Error ? error.message : 'Unknown error'}`,
        statusCode: 500,
        details: { error },
      });
    }
  }

  /**
   * Create command factory with AWS SDK commands
   */
  private async createCommandFactory(): Promise<S3CommandFactory> {
    const {
      HeadBucketCommand,
      ListBucketsCommand,
      CreateBucketCommand,
      DeleteBucketCommand,
      PutObjectCommand,
      GetObjectCommand,
      HeadObjectCommand,
      DeleteObjectCommand,
      DeleteObjectsCommand,
      ListObjectsV2Command,
      CopyObjectCommand,
      CreateMultipartUploadCommand,
      UploadPartCommand,
      CompleteMultipartUploadCommand,
      AbortMultipartUploadCommand,
    } = await import('@aws-sdk/client-s3');

    return {
      createHeadBucketCommand: (bucket: string) => new HeadBucketCommand({ Bucket: bucket }),
      createListBucketsCommand: () => new ListBucketsCommand({}),
      createCreateBucketCommand: (bucket: string, region?: string) =>
        new CreateBucketCommand({
          Bucket: bucket,
          ...(region && region !== 'us-east-1' && {
            CreateBucketConfiguration: { LocationConstraint: region as 'eu-west-1' },
          }),
        }),
      createDeleteBucketCommand: (bucket: string) => new DeleteBucketCommand({ Bucket: bucket }),
      createPutObjectCommand: (params: PutObjectParams) =>
        new PutObjectCommand({
          Bucket: params.bucket,
          Key: params.key,
          Body: params.body,
          ContentType: params.contentType,
          Metadata: params.metadata,
          StorageClass: params.storageClass as 'STANDARD' | undefined,
          CacheControl: params.cacheControl,
          ContentDisposition: params.contentDisposition,
          ContentEncoding: params.contentEncoding,
          ServerSideEncryption: params.serverSideEncryption as 'AES256' | undefined,
          SSEKMSKeyId: params.kmsKeyId,
          ACL: params.acl as 'private' | undefined,
          Tagging: params.tagging,
        }),
      createGetObjectCommand: (params: GetObjectParams) =>
        new GetObjectCommand({
          Bucket: params.bucket,
          Key: params.key,
          VersionId: params.versionId,
          Range: params.range,
        }),
      createHeadObjectCommand: (params: HeadObjectParams) =>
        new HeadObjectCommand({
          Bucket: params.bucket,
          Key: params.key,
          VersionId: params.versionId,
        }),
      createDeleteObjectCommand: (params: DeleteObjectParams) =>
        new DeleteObjectCommand({
          Bucket: params.bucket,
          Key: params.key,
          VersionId: params.versionId,
        }),
      createDeleteObjectsCommand: (params: DeleteObjectsParams) =>
        new DeleteObjectsCommand({
          Bucket: params.bucket,
          Delete: {
            Objects: params.keys.map((k) => ({ Key: k.key, VersionId: k.versionId })),
          },
        }),
      createListObjectsV2Command: (params: ListObjectsParams) =>
        new ListObjectsV2Command({
          Bucket: params.bucket,
          Prefix: params.prefix,
          Delimiter: params.delimiter,
          MaxKeys: params.maxKeys,
          ContinuationToken: params.continuationToken,
        }),
      createCopyObjectCommand: (params: CopyObjectParams) =>
        new CopyObjectCommand({
          Bucket: params.destinationBucket,
          Key: params.destinationKey,
          CopySource: `${params.sourceBucket}/${params.sourceKey}`,
          ContentType: params.contentType,
          Metadata: params.metadata,
          MetadataDirective: params.metadataDirective,
          ACL: params.acl as 'private' | undefined,
        }),
      createCreateMultipartUploadCommand: (params: CreateMultipartParams) =>
        new CreateMultipartUploadCommand({
          Bucket: params.bucket,
          Key: params.key,
          ContentType: params.contentType,
          Metadata: params.metadata,
          StorageClass: params.storageClass as 'STANDARD' | undefined,
          ServerSideEncryption: params.serverSideEncryption as 'AES256' | undefined,
          SSEKMSKeyId: params.kmsKeyId,
          ACL: params.acl as 'private' | undefined,
        }),
      createUploadPartCommand: (params: UploadPartParams) =>
        new UploadPartCommand({
          Bucket: params.bucket,
          Key: params.key,
          UploadId: params.uploadId,
          PartNumber: params.partNumber,
          Body: params.body,
        }),
      createCompleteMultipartUploadCommand: (params: CompleteMultipartParams) =>
        new CompleteMultipartUploadCommand({
          Bucket: params.bucket,
          Key: params.key,
          UploadId: params.uploadId,
          MultipartUpload: {
            Parts: params.parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
          },
        }),
      createAbortMultipartUploadCommand: (params: AbortMultipartParams) =>
        new AbortMultipartUploadCommand({
          Bucket: params.bucket,
          Key: params.key,
          UploadId: params.uploadId,
        }),
    };
  }

  /**
   * Disconnect from S3
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.destroy();
      this.client = null;
      this.commandFactory = null;
      this.presigner = null;
    }
    this.status = 'disconnected';
    this.emit('disconnected');
  }

  /**
   * Get the underlying S3 client
   */
  getClient(): S3ClientInterface {
    if (!this.client) {
      throw new ForgeError({
        code: ErrorCode.STORAGE_ERROR,
        message: 'S3 client not connected',
        statusCode: 500,
      });
    }
    return this.client;
  }

  /**
   * Get command factory
   */
  getCommandFactory(): S3CommandFactory {
    if (!this.commandFactory) {
      throw new ForgeError({
        code: ErrorCode.STORAGE_ERROR,
        message: 'S3 client not connected',
        statusCode: 500,
      });
    }
    return this.commandFactory;
  }

  /**
   * Get presigner
   */
  getPresigner(): S3PresignerInterface {
    if (!this.presigner) {
      throw new ForgeError({
        code: ErrorCode.STORAGE_ERROR,
        message: 'S3 client not connected',
        statusCode: 500,
      });
    }
    return this.presigner;
  }

  /**
   * Get connection status
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Get configuration
   */
  getConfig(): S3Config {
    return { ...this.config };
  }

  /**
   * Check if bucket exists
   */
  async bucketExists(bucket: string): Promise<boolean> {
    const client = this.getClient();
    const factory = this.getCommandFactory();

    try {
      await client.send(factory.createHeadBucketCommand(bucket));
      return true;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return false;
      }
      throw this.wrapError(error, `Failed to check bucket: ${bucket}`);
    }
  }

  /**
   * List all buckets
   */
  async listBuckets(): Promise<BucketInfo[]> {
    const client = this.getClient();
    const factory = this.getCommandFactory();

    try {
      const response = await client.send(factory.createListBucketsCommand()) as { Buckets?: Array<{ Name?: string; CreationDate?: Date }> };
      return (response.Buckets || []).map((b) => ({
        name: b.Name || '',
        createdAt: b.CreationDate,
      }));
    } catch (error) {
      throw this.wrapError(error, 'Failed to list buckets');
    }
  }

  /**
   * Create a bucket
   */
  async createBucket(bucket: string, region?: string): Promise<void> {
    const client = this.getClient();
    const factory = this.getCommandFactory();

    try {
      await client.send(factory.createCreateBucketCommand(bucket, region));
    } catch (error) {
      throw this.wrapError(error, `Failed to create bucket: ${bucket}`);
    }
  }

  /**
   * Delete a bucket
   */
  async deleteBucket(bucket: string): Promise<void> {
    const client = this.getClient();
    const factory = this.getCommandFactory();

    try {
      await client.send(factory.createDeleteBucketCommand(bucket));
    } catch (error) {
      throw this.wrapError(error, `Failed to delete bucket: ${bucket}`);
    }
  }

  /**
   * Upload an object
   */
  async putObject(params: PutObjectParams): Promise<{ etag: string; versionId?: string }> {
    const client = this.getClient();
    const factory = this.getCommandFactory();

    try {
      const response = await client.send(factory.createPutObjectCommand(params)) as { ETag?: string; VersionId?: string };
      return {
        etag: response.ETag || '',
        versionId: response.VersionId,
      };
    } catch (error) {
      throw this.wrapError(error, `Failed to upload object: ${params.key}`);
    }
  }

  /**
   * Get an object
   */
  async getObject(params: GetObjectParams): Promise<{ body: Readable; metadata: FileMetadata }> {
    const client = this.getClient();
    const factory = this.getCommandFactory();

    try {
      const response = await client.send(factory.createGetObjectCommand(params)) as {
        Body?: Readable;
        ContentLength?: number;
        ContentType?: string;
        LastModified?: Date;
        ETag?: string;
        Metadata?: Record<string, string>;
        StorageClass?: string;
        VersionId?: string;
      };

      if (!response.Body) {
        throw new Error('Empty response body');
      }

      return {
        body: response.Body as Readable,
        metadata: {
          key: params.key,
          sizeBytes: response.ContentLength || 0,
          contentType: response.ContentType || 'application/octet-stream',
          lastModified: response.LastModified || new Date(),
          etag: response.ETag || '',
          metadata: response.Metadata,
          storageClass: response.StorageClass,
          versionId: response.VersionId,
        },
      };
    } catch (error) {
      throw this.wrapError(error, `Failed to get object: ${params.key}`);
    }
  }

  /**
   * Get object metadata
   */
  async headObject(params: HeadObjectParams): Promise<FileMetadata> {
    const client = this.getClient();
    const factory = this.getCommandFactory();

    try {
      const response = await client.send(factory.createHeadObjectCommand(params)) as {
        ContentLength?: number;
        ContentType?: string;
        LastModified?: Date;
        ETag?: string;
        Metadata?: Record<string, string>;
        StorageClass?: string;
        VersionId?: string;
      };

      return {
        key: params.key,
        sizeBytes: response.ContentLength || 0,
        contentType: response.ContentType || 'application/octet-stream',
        lastModified: response.LastModified || new Date(),
        etag: response.ETag || '',
        metadata: response.Metadata,
        storageClass: response.StorageClass,
        versionId: response.VersionId,
      };
    } catch (error) {
      throw this.wrapError(error, `Failed to get object metadata: ${params.key}`);
    }
  }

  /**
   * Delete an object
   */
  async deleteObject(params: DeleteObjectParams): Promise<void> {
    const client = this.getClient();
    const factory = this.getCommandFactory();

    try {
      await client.send(factory.createDeleteObjectCommand(params));
    } catch (error) {
      throw this.wrapError(error, `Failed to delete object: ${params.key}`);
    }
  }

  /**
   * Delete multiple objects
   */
  async deleteObjects(params: DeleteObjectsParams): Promise<{ deleted: string[]; errors: Array<{ key: string; error: string }> }> {
    const client = this.getClient();
    const factory = this.getCommandFactory();

    try {
      const response = await client.send(factory.createDeleteObjectsCommand(params)) as {
        Deleted?: Array<{ Key?: string }>;
        Errors?: Array<{ Key?: string; Message?: string }>;
      };

      return {
        deleted: (response.Deleted || []).map((d) => d.Key || ''),
        errors: (response.Errors || []).map((e) => ({ key: e.Key || '', error: e.Message || 'Unknown error' })),
      };
    } catch (error) {
      throw this.wrapError(error, 'Failed to delete objects');
    }
  }

  /**
   * List objects in a bucket
   */
  async listObjects(params: ListObjectsParams): Promise<{
    contents: FileMetadata[];
    prefixes: string[];
    isTruncated: boolean;
    continuationToken?: string;
  }> {
    const client = this.getClient();
    const factory = this.getCommandFactory();

    try {
      const response = await client.send(factory.createListObjectsV2Command(params)) as {
        Contents?: Array<{
          Key?: string;
          Size?: number;
          LastModified?: Date;
          ETag?: string;
          StorageClass?: string;
        }>;
        CommonPrefixes?: Array<{ Prefix?: string }>;
        IsTruncated?: boolean;
        NextContinuationToken?: string;
      };

      return {
        contents: (response.Contents || []).map((obj) => ({
          key: obj.Key || '',
          sizeBytes: obj.Size || 0,
          contentType: 'application/octet-stream', // Not available in list response
          lastModified: obj.LastModified || new Date(),
          etag: obj.ETag || '',
          storageClass: obj.StorageClass,
        })),
        prefixes: (response.CommonPrefixes || []).map((p) => p.Prefix || ''),
        isTruncated: response.IsTruncated || false,
        continuationToken: response.NextContinuationToken,
      };
    } catch (error) {
      throw this.wrapError(error, `Failed to list objects in bucket: ${params.bucket}`);
    }
  }

  /**
   * Copy an object
   */
  async copyObject(params: CopyObjectParams): Promise<{ etag: string; versionId?: string }> {
    const client = this.getClient();
    const factory = this.getCommandFactory();

    try {
      const response = await client.send(factory.createCopyObjectCommand(params)) as {
        CopyObjectResult?: { ETag?: string };
        VersionId?: string;
      };

      return {
        etag: response.CopyObjectResult?.ETag || '',
        versionId: response.VersionId,
      };
    } catch (error) {
      throw this.wrapError(error, `Failed to copy object from ${params.sourceKey} to ${params.destinationKey}`);
    }
  }

  /**
   * Create a multipart upload
   */
  async createMultipartUpload(params: CreateMultipartParams): Promise<string> {
    const client = this.getClient();
    const factory = this.getCommandFactory();

    try {
      const response = await client.send(factory.createCreateMultipartUploadCommand(params)) as { UploadId?: string };
      if (!response.UploadId) {
        throw new Error('No upload ID returned');
      }
      return response.UploadId;
    } catch (error) {
      throw this.wrapError(error, `Failed to create multipart upload for: ${params.key}`);
    }
  }

  /**
   * Upload a part
   */
  async uploadPart(params: UploadPartParams): Promise<{ etag: string }> {
    const client = this.getClient();
    const factory = this.getCommandFactory();

    try {
      const response = await client.send(factory.createUploadPartCommand(params)) as { ETag?: string };
      return {
        etag: response.ETag || '',
      };
    } catch (error) {
      throw this.wrapError(error, `Failed to upload part ${params.partNumber} for: ${params.key}`);
    }
  }

  /**
   * Complete a multipart upload
   */
  async completeMultipartUpload(params: CompleteMultipartParams): Promise<{ etag: string; versionId?: string }> {
    const client = this.getClient();
    const factory = this.getCommandFactory();

    try {
      const response = await client.send(factory.createCompleteMultipartUploadCommand(params)) as { ETag?: string; VersionId?: string };
      return {
        etag: response.ETag || '',
        versionId: response.VersionId,
      };
    } catch (error) {
      throw this.wrapError(error, `Failed to complete multipart upload for: ${params.key}`);
    }
  }

  /**
   * Abort a multipart upload
   */
  async abortMultipartUpload(params: AbortMultipartParams): Promise<void> {
    const client = this.getClient();
    const factory = this.getCommandFactory();

    try {
      await client.send(factory.createAbortMultipartUploadCommand(params));
    } catch (error) {
      throw this.wrapError(error, `Failed to abort multipart upload for: ${params.key}`);
    }
  }

  /**
   * Generate a presigned URL
   */
  async getPresignedUrl(
    command: S3ClientCommand,
    expiresIn: number
  ): Promise<string> {
    const presigner = this.getPresigner();

    try {
      const result = await presigner.presign(command, { expiresIn });
      return result.url;
    } catch (error) {
      throw this.wrapError(error, 'Failed to generate presigned URL');
    }
  }

  /**
   * Add event listener
   */
  on(event: string, listener: (data?: unknown) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  /**
   * Remove event listener
   */
  off(event: string, listener: (data?: unknown) => void): void {
    this.listeners.get(event)?.delete(listener);
  }

  /**
   * Emit event
   */
  private emit(event: string, data?: unknown): void {
    this.listeners.get(event)?.forEach((listener) => listener(data));
  }

  /**
   * Check if error is a not found error
   */
  private isNotFoundError(error: unknown): boolean {
    if (error instanceof Error) {
      const name = (error as { name?: string }).name;
      return name === 'NotFound' || name === 'NoSuchBucket' || name === 'NoSuchKey';
    }
    return false;
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

// Singleton instance
let s3ClientInstance: S3Client | null = null;

/**
 * Get the singleton S3 client instance
 */
export function getS3Client(config?: Partial<S3Config>): S3Client {
  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client(config);
  }
  return s3ClientInstance;
}

/**
 * Reset the singleton S3 client instance (for testing)
 */
export function resetS3Client(): void {
  if (s3ClientInstance) {
    s3ClientInstance.disconnect();
    s3ClientInstance = null;
  }
}
