/**
 * @package @forge/storage
 * @description TypeScript interfaces for S3/R2 object storage management
 */

import type { Readable } from 'stream';

/**
 * Supported storage providers
 */
export type StorageProvider = 's3' | 'r2' | 'minio';

/**
 * S3-compatible storage configuration
 */
export interface S3Config {
  /** AWS region or R2 account region */
  region: string;
  /** S3/R2 endpoint URL (required for R2 and MinIO) */
  endpoint?: string;
  /** AWS access key ID */
  accessKeyId: string;
  /** AWS secret access key */
  secretAccessKey: string;
  /** Force path-style URLs (required for MinIO) */
  forcePathStyle: boolean;
  /** Connection timeout in milliseconds */
  connectTimeoutMs: number;
  /** Request timeout in milliseconds */
  requestTimeoutMs: number;
  /** Maximum retry attempts */
  maxRetries: number;
}

/**
 * Default S3 configuration values
 */
export const DEFAULT_S3_CONFIG: S3Config = {
  region: 'us-east-1',
  accessKeyId: '',
  secretAccessKey: '',
  forcePathStyle: false,
  connectTimeoutMs: 10000,
  requestTimeoutMs: 30000,
  maxRetries: 3,
};

/**
 * Storage service configuration
 */
export interface StorageConfig {
  /** S3-compatible client configuration */
  s3: S3Config;
  /** Default bucket name */
  defaultBucket: string;
  /** Storage provider type */
  provider: StorageProvider;
  /** Enable logging */
  enableLogging: boolean;
  /** Environment */
  environment: 'development' | 'production' | 'test';
  /** Default presigned URL expiration in seconds */
  defaultPresignedExpirySeconds: number;
  /** Maximum file size for single upload in bytes (5GB) */
  maxSingleUploadBytes: number;
  /** Minimum part size for multipart upload in bytes (5MB) */
  multipartPartSizeBytes: number;
  /** Maximum concurrent uploads for multipart */
  maxConcurrentUploads: number;
}

/**
 * Default storage configuration
 */
export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
  s3: DEFAULT_S3_CONFIG,
  defaultBucket: 'forge-storage',
  provider: 's3',
  enableLogging: false,
  environment: 'production',
  defaultPresignedExpirySeconds: 3600, // 1 hour
  maxSingleUploadBytes: 5 * 1024 * 1024 * 1024, // 5GB
  multipartPartSizeBytes: 5 * 1024 * 1024, // 5MB
  maxConcurrentUploads: 4,
};

/**
 * Connection status
 */
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

/**
 * File metadata
 */
export interface FileMetadata {
  /** Object key (path) */
  key: string;
  /** File size in bytes */
  sizeBytes: number;
  /** Content type (MIME type) */
  contentType: string;
  /** Last modified date */
  lastModified: Date;
  /** ETag (entity tag) */
  etag: string;
  /** Custom metadata */
  metadata?: Record<string, string>;
  /** Storage class (e.g., STANDARD, GLACIER) */
  storageClass?: string;
  /** Version ID (if versioning enabled) */
  versionId?: string;
}

/**
 * Bucket information
 */
export interface BucketInfo {
  /** Bucket name */
  name: string;
  /** Creation date */
  createdAt?: Date;
  /** Region */
  region?: string;
}

/**
 * Upload options
 */
export interface UploadOptions {
  /** Target bucket (overrides default) */
  bucket?: string;
  /** Content type (MIME type) - auto-detected if not provided */
  contentType?: string;
  /** Custom metadata */
  metadata?: Record<string, string>;
  /** Storage class */
  storageClass?: 'STANDARD' | 'REDUCED_REDUNDANCY' | 'STANDARD_IA' | 'ONEZONE_IA' | 'INTELLIGENT_TIERING' | 'GLACIER' | 'DEEP_ARCHIVE';
  /** Cache control header */
  cacheControl?: string;
  /** Content disposition header */
  contentDisposition?: string;
  /** Content encoding header */
  contentEncoding?: string;
  /** Server-side encryption */
  serverSideEncryption?: 'AES256' | 'aws:kms';
  /** KMS key ID for server-side encryption */
  kmsKeyId?: string;
  /** ACL for the object */
  acl?: 'private' | 'public-read' | 'public-read-write' | 'authenticated-read' | 'bucket-owner-read' | 'bucket-owner-full-control';
  /** Tags for the object */
  tags?: Record<string, string>;
  /** Tenant ID for multi-tenant isolation */
  tenantId?: string;
  /** Callback for upload progress */
  onProgress?: (progress: UploadProgress) => void;
}

/**
 * Upload progress information
 */
export interface UploadProgress {
  /** Bytes uploaded so far */
  uploadedBytes: number;
  /** Total bytes to upload */
  totalBytes: number;
  /** Upload percentage (0-100) */
  percentage: number;
  /** Part number for multipart uploads */
  partNumber?: number;
  /** Total parts for multipart uploads */
  totalParts?: number;
}

/**
 * Download options
 */
export interface DownloadOptions {
  /** Source bucket (overrides default) */
  bucket?: string;
  /** Specific version to download */
  versionId?: string;
  /** Byte range start */
  rangeStart?: number;
  /** Byte range end */
  rangeEnd?: number;
  /** Tenant ID for multi-tenant isolation */
  tenantId?: string;
}

/**
 * Delete options
 */
export interface DeleteOptions {
  /** Target bucket (overrides default) */
  bucket?: string;
  /** Specific version to delete */
  versionId?: string;
  /** Tenant ID for multi-tenant isolation */
  tenantId?: string;
}

/**
 * List options
 */
export interface ListOptions {
  /** Target bucket (overrides default) */
  bucket?: string;
  /** Prefix to filter objects */
  prefix?: string;
  /** Delimiter for hierarchical listing */
  delimiter?: string;
  /** Maximum number of objects to return */
  maxKeys?: number;
  /** Continuation token for pagination */
  continuationToken?: string;
  /** Tenant ID for multi-tenant isolation */
  tenantId?: string;
}

/**
 * List result
 */
export interface ListResult {
  /** Array of file metadata */
  files: FileMetadata[];
  /** Common prefixes (folders) when using delimiter */
  prefixes: string[];
  /** Whether there are more results */
  isTruncated: boolean;
  /** Token for next page */
  continuationToken?: string;
  /** Number of keys returned */
  keyCount: number;
}

/**
 * Copy options
 */
export interface CopyOptions {
  /** Source bucket */
  sourceBucket?: string;
  /** Destination bucket */
  destinationBucket?: string;
  /** New content type */
  contentType?: string;
  /** New metadata (replaces existing) */
  metadata?: Record<string, string>;
  /** Metadata directive */
  metadataDirective?: 'COPY' | 'REPLACE';
  /** ACL for the copied object */
  acl?: 'private' | 'public-read' | 'public-read-write' | 'authenticated-read' | 'bucket-owner-read' | 'bucket-owner-full-control';
  /** Tenant ID for multi-tenant isolation */
  tenantId?: string;
}

/**
 * Presigned URL options
 */
export interface PresignedUrlOptions {
  /** Target bucket (overrides default) */
  bucket?: string;
  /** Expiry time in seconds (overrides default) */
  expiresIn?: number;
  /** Content type for upload URLs */
  contentType?: string;
  /** Content disposition */
  contentDisposition?: string;
  /** Specific version ID */
  versionId?: string;
  /** Tenant ID for multi-tenant isolation */
  tenantId?: string;
  /** Response content type for download URLs */
  responseContentType?: string;
  /** Response content disposition for download URLs */
  responseContentDisposition?: string;
}

/**
 * Presigned URL result
 */
export interface PresignedUrlResult {
  /** The presigned URL */
  url: string;
  /** Expiry time */
  expiresAt: Date;
  /** HTTP method to use */
  method: 'GET' | 'PUT';
  /** Headers required for the request */
  headers?: Record<string, string>;
}

/**
 * Multipart upload options
 */
export interface MultipartUploadOptions extends UploadOptions {
  /** Part size in bytes (minimum 5MB) */
  partSizeBytes?: number;
  /** Maximum concurrent part uploads */
  concurrency?: number;
}

/**
 * Multipart upload state
 */
export interface MultipartUploadState {
  /** Upload ID from S3 */
  uploadId: string;
  /** Object key */
  key: string;
  /** Bucket name */
  bucket: string;
  /** Completed parts */
  completedParts: CompletedPart[];
  /** Initiated at timestamp */
  initiatedAt: Date;
}

/**
 * Completed multipart part
 */
export interface CompletedPart {
  /** Part number (1-10000) */
  partNumber: number;
  /** ETag of the part */
  etag: string;
}

/**
 * Bucket options for creation
 */
export interface CreateBucketOptions {
  /** Region for the bucket */
  region?: string;
  /** ACL for the bucket */
  acl?: 'private' | 'public-read' | 'public-read-write' | 'authenticated-read';
  /** Enable versioning */
  versioning?: boolean;
}

/**
 * Storage statistics
 */
export interface StorageStats {
  /** Total operations performed */
  totalOperations: number;
  /** Successful operations */
  successfulOperations: number;
  /** Failed operations */
  failedOperations: number;
  /** Total bytes uploaded */
  bytesUploaded: number;
  /** Total bytes downloaded */
  bytesDownloaded: number;
  /** Average operation latency in milliseconds */
  avgLatencyMs: number;
  /** Connection status */
  status: ConnectionStatus;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Whether storage is healthy */
  healthy: boolean;
  /** Current connection status */
  status: ConnectionStatus;
  /** Response time in milliseconds */
  responseTimeMs: number;
  /** Storage statistics */
  stats: StorageStats;
  /** Timestamp of health check */
  timestamp: Date;
  /** Error message if unhealthy */
  error?: string;
  /** Bucket accessibility */
  bucketAccessible?: boolean;
  /** Provider information */
  providerInfo?: {
    provider: StorageProvider;
    region: string;
    endpoint?: string;
  };
}

/**
 * Tenant context for multi-tenant operations
 */
export interface TenantContext {
  /** Tenant identifier */
  tenantId: string;
  /** Optional user identifier */
  userId?: string;
  /** Request correlation ID for tracing */
  correlationId?: string;
}

/**
 * Storage events
 */
export type StorageEvent =
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'upload:start'
  | 'upload:progress'
  | 'upload:complete'
  | 'upload:error'
  | 'download:start'
  | 'download:complete'
  | 'download:error';

/**
 * Event listener callback type
 */
export type StorageEventListener = (event: StorageEvent, data?: Record<string, unknown>) => void;

/**
 * Shutdown options
 */
export interface ShutdownOptions {
  /** Timeout for graceful shutdown in milliseconds */
  timeoutMs: number;
  /** Abort pending uploads on shutdown */
  abortPendingUploads: boolean;
}

/**
 * Default shutdown options
 */
export const DEFAULT_SHUTDOWN_OPTIONS: ShutdownOptions = {
  timeoutMs: 5000,
  abortPendingUploads: true,
};

/**
 * Stream upload source
 */
export type UploadSource = Buffer | Readable | string;

/**
 * Download result
 */
export interface DownloadResult {
  /** File content as buffer */
  data: Buffer;
  /** File metadata */
  metadata: FileMetadata;
}

/**
 * Stream download result
 */
export interface StreamDownloadResult {
  /** Readable stream of file content */
  stream: Readable;
  /** File metadata */
  metadata: FileMetadata;
}
