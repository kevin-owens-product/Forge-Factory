/**
 * @package @forge/storage
 * @description Main storage service for S3/R2 object storage
 */

import { ErrorCode, ForgeError } from '@forge/errors';
import { S3Client, getS3Client, resetS3Client } from './s3-client';
import { PresignedUrlGenerator, createPresignedUrlGenerator } from './presigned';
import {
  StorageConfig,
  DEFAULT_STORAGE_CONFIG,
  FileMetadata,
  BucketInfo,
  UploadOptions,
  DownloadOptions,
  DeleteOptions,
  ListOptions,
  ListResult,
  CopyOptions,
  PresignedUrlOptions,
  PresignedUrlResult,
  MultipartUploadOptions,
  MultipartUploadState,
  CompletedPart,
  CreateBucketOptions,
  StorageStats,
  HealthCheckResult,
  TenantContext,
  StorageEvent,
  StorageEventListener,
  ShutdownOptions,
  DEFAULT_SHUTDOWN_OPTIONS,
  UploadSource,
  DownloadResult,
  StreamDownloadResult,
  ConnectionStatus,
} from './storage.types';
import {
  detectMimeType,
  normalizeKey,
  buildTenantKey,
  extractKeyFromTenantKey,
  validateKey,
  splitBuffer,
  streamToBuffer,
  buildTagsString,
} from './file-utils';

/**
 * Storage Service class
 */
export class StorageService {
  private s3Client: S3Client;
  private presignedGenerator: PresignedUrlGenerator;
  private config: StorageConfig;
  private stats: StorageStats;
  private listeners: Map<StorageEvent, Set<StorageEventListener>> = new Map();
  private activeMultipartUploads: Map<string, MultipartUploadState> = new Map();
  private operationStartTimes: Map<string, number> = new Map();
  private totalLatency: number = 0;

  constructor(config: Partial<StorageConfig> = {}) {
    this.config = { ...DEFAULT_STORAGE_CONFIG, ...config };
    this.s3Client = getS3Client(this.config.s3);
    this.presignedGenerator = createPresignedUrlGenerator(
      this.s3Client,
      this.config.defaultBucket,
      this.config.defaultPresignedExpirySeconds
    );
    this.stats = this.initializeStats();
  }

  /**
   * Initialize statistics
   */
  private initializeStats(): StorageStats {
    return {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      bytesUploaded: 0,
      bytesDownloaded: 0,
      avgLatencyMs: 0,
      status: 'disconnected',
    };
  }

  /**
   * Connect to storage
   */
  async connect(): Promise<void> {
    await this.s3Client.connect();
    this.stats.status = this.s3Client.getStatus();
    this.emit('connected');
  }

  /**
   * Disconnect from storage
   */
  async disconnect(options: ShutdownOptions = DEFAULT_SHUTDOWN_OPTIONS): Promise<void> {
    // Abort pending multipart uploads if configured
    if (options.abortPendingUploads && this.activeMultipartUploads.size > 0) {
      const abortPromises = Array.from(this.activeMultipartUploads.values()).map((upload) =>
        this.abortMultipartUpload(upload.key, upload.uploadId, { bucket: upload.bucket }).catch(() => {
          // Ignore abort errors during shutdown
        })
      );

      await Promise.race([
        Promise.all(abortPromises),
        new Promise((resolve) => setTimeout(resolve, options.timeoutMs)),
      ]);
    }

    await this.s3Client.disconnect();
    this.stats.status = 'disconnected';
    this.emit('disconnected');
  }

  /**
   * Get connection status
   */
  getStatus(): ConnectionStatus {
    return this.s3Client.getStatus();
  }

  /**
   * Get statistics
   */
  getStats(): StorageStats {
    return { ...this.stats };
  }

  // ============================================
  // Upload Operations
  // ============================================

  /**
   * Upload a file
   */
  async upload(
    key: string,
    data: UploadSource,
    options: UploadOptions = {}
  ): Promise<FileMetadata> {
    const operationId = this.startOperation();
    const bucket = options.bucket || this.config.defaultBucket;

    // Build key with tenant prefix if provided
    const resolvedKey = options.tenantId
      ? buildTenantKey(options.tenantId, key)
      : normalizeKey(key);

    // Validate key
    const validation = validateKey(resolvedKey);
    if (!validation.valid) {
      throw new ForgeError({
        code: ErrorCode.STORAGE_ERROR,
        message: validation.error || 'Invalid key',
        statusCode: 400,
      });
    }

    this.emit('upload:start', { key: resolvedKey, bucket });

    try {
      // Convert stream to buffer if needed for size calculation
      let buffer: Buffer;
      if (Buffer.isBuffer(data)) {
        buffer = data;
      } else if (typeof data === 'string') {
        buffer = Buffer.from(data, 'utf-8');
      } else {
        buffer = await streamToBuffer(data);
      }

      const size = buffer.length;

      // Determine content type
      const contentType = options.contentType || detectMimeType(key, buffer);

      // Check if multipart upload is needed
      if (size > this.config.maxSingleUploadBytes) {
        return this.multipartUpload(resolvedKey, buffer, {
          ...options,
          bucket,
          contentType,
        });
      }

      // Build tags string if provided
      const tagging = options.tags ? buildTagsString(options.tags) : undefined;

      // Upload the object
      const result = await this.s3Client.putObject({
        bucket,
        key: resolvedKey,
        body: buffer,
        contentType,
        metadata: options.metadata,
        storageClass: options.storageClass,
        cacheControl: options.cacheControl,
        contentDisposition: options.contentDisposition,
        contentEncoding: options.contentEncoding,
        serverSideEncryption: options.serverSideEncryption,
        kmsKeyId: options.kmsKeyId,
        acl: options.acl,
        tagging,
      });

      this.stats.bytesUploaded += size;
      this.completeOperation(operationId, true);

      const metadata: FileMetadata = {
        key: resolvedKey,
        sizeBytes: size,
        contentType,
        lastModified: new Date(),
        etag: result.etag,
        metadata: options.metadata,
        versionId: result.versionId,
      };

      this.emit('upload:complete', { key: resolvedKey, metadata });

      // Report progress
      if (options.onProgress) {
        options.onProgress({
          uploadedBytes: size,
          totalBytes: size,
          percentage: 100,
        });
      }

      return metadata;
    } catch (error) {
      this.completeOperation(operationId, false);
      this.emit('upload:error', { key: resolvedKey, error });
      throw this.wrapError(error, `Failed to upload: ${resolvedKey}`);
    }
  }

  /**
   * Multipart upload for large files
   */
  private async multipartUpload(
    key: string,
    data: Buffer,
    options: MultipartUploadOptions
  ): Promise<FileMetadata> {
    const bucket = options.bucket || this.config.defaultBucket;
    const partSize = options.partSizeBytes || this.config.multipartPartSizeBytes;
    const concurrency = options.concurrency || this.config.maxConcurrentUploads;

    // Create multipart upload
    const uploadId = await this.s3Client.createMultipartUpload({
      bucket,
      key,
      contentType: options.contentType,
      metadata: options.metadata,
      storageClass: options.storageClass,
      serverSideEncryption: options.serverSideEncryption,
      kmsKeyId: options.kmsKeyId,
      acl: options.acl,
    });

    // Track active upload
    const uploadState: MultipartUploadState = {
      uploadId,
      key,
      bucket,
      completedParts: [],
      initiatedAt: new Date(),
    };
    this.activeMultipartUploads.set(uploadId, uploadState);

    try {
      // Split buffer into parts
      const parts = Array.from(splitBuffer(data, partSize));
      const totalParts = parts.length;

      // Upload parts with concurrency limit
      const completedParts: CompletedPart[] = [];
      let uploadedBytes = 0;

      for (let i = 0; i < parts.length; i += concurrency) {
        const batch = parts.slice(i, i + concurrency);
        const batchResults = await Promise.all(
          batch.map(async ({ chunk, partNumber }) => {
            const result = await this.s3Client.uploadPart({
              bucket,
              key,
              uploadId,
              partNumber,
              body: chunk,
            });

            uploadedBytes += chunk.length;

            // Report progress
            if (options.onProgress) {
              options.onProgress({
                uploadedBytes,
                totalBytes: data.length,
                percentage: Math.round((uploadedBytes / data.length) * 100),
                partNumber,
                totalParts,
              });
            }

            return { partNumber, etag: result.etag };
          })
        );

        completedParts.push(...batchResults);
        uploadState.completedParts = completedParts;
      }

      // Sort parts by part number
      completedParts.sort((a, b) => a.partNumber - b.partNumber);

      // Complete multipart upload
      const result = await this.s3Client.completeMultipartUpload({
        bucket,
        key,
        uploadId,
        parts: completedParts,
      });

      // Remove from active uploads
      this.activeMultipartUploads.delete(uploadId);

      this.stats.bytesUploaded += data.length;

      return {
        key,
        sizeBytes: data.length,
        contentType: options.contentType || 'application/octet-stream',
        lastModified: new Date(),
        etag: result.etag,
        metadata: options.metadata,
        versionId: result.versionId,
      };
    } catch (error) {
      // Abort the upload on failure
      try {
        await this.s3Client.abortMultipartUpload({ bucket, key, uploadId });
      } catch {
        // Ignore abort errors
      }
      this.activeMultipartUploads.delete(uploadId);
      throw error;
    }
  }

  // ============================================
  // Download Operations
  // ============================================

  /**
   * Download a file as buffer
   */
  async download(key: string, options: DownloadOptions = {}): Promise<DownloadResult> {
    const operationId = this.startOperation();
    const bucket = options.bucket || this.config.defaultBucket;

    // Build key with tenant prefix if provided
    const resolvedKey = options.tenantId
      ? buildTenantKey(options.tenantId, key)
      : normalizeKey(key);

    this.emit('download:start', { key: resolvedKey, bucket });

    try {
      // Build range header if specified
      let range: string | undefined;
      if (options.rangeStart !== undefined || options.rangeEnd !== undefined) {
        const start = options.rangeStart ?? 0;
        const end = options.rangeEnd ?? '';
        range = `bytes=${start}-${end}`;
      }

      const result = await this.s3Client.getObject({
        bucket,
        key: resolvedKey,
        versionId: options.versionId,
        range,
      });

      const buffer = await streamToBuffer(result.body);

      this.stats.bytesDownloaded += buffer.length;
      this.completeOperation(operationId, true);

      this.emit('download:complete', { key: resolvedKey, metadata: result.metadata });

      return {
        data: buffer,
        metadata: result.metadata,
      };
    } catch (error) {
      this.completeOperation(operationId, false);
      this.emit('download:error', { key: resolvedKey, error });
      throw this.wrapError(error, `Failed to download: ${resolvedKey}`);
    }
  }

  /**
   * Download a file as stream
   */
  async downloadStream(key: string, options: DownloadOptions = {}): Promise<StreamDownloadResult> {
    const operationId = this.startOperation();
    const bucket = options.bucket || this.config.defaultBucket;

    // Build key with tenant prefix if provided
    const resolvedKey = options.tenantId
      ? buildTenantKey(options.tenantId, key)
      : normalizeKey(key);

    this.emit('download:start', { key: resolvedKey, bucket });

    try {
      // Build range header if specified
      let range: string | undefined;
      if (options.rangeStart !== undefined || options.rangeEnd !== undefined) {
        const start = options.rangeStart ?? 0;
        const end = options.rangeEnd ?? '';
        range = `bytes=${start}-${end}`;
      }

      const result = await this.s3Client.getObject({
        bucket,
        key: resolvedKey,
        versionId: options.versionId,
        range,
      });

      this.completeOperation(operationId, true);

      this.emit('download:complete', { key: resolvedKey, metadata: result.metadata });

      return {
        stream: result.body,
        metadata: result.metadata,
      };
    } catch (error) {
      this.completeOperation(operationId, false);
      this.emit('download:error', { key: resolvedKey, error });
      throw this.wrapError(error, `Failed to download stream: ${resolvedKey}`);
    }
  }

  // ============================================
  // Delete Operations
  // ============================================

  /**
   * Delete a file
   */
  async delete(key: string, options: DeleteOptions = {}): Promise<void> {
    const operationId = this.startOperation();
    const bucket = options.bucket || this.config.defaultBucket;

    // Build key with tenant prefix if provided
    const resolvedKey = options.tenantId
      ? buildTenantKey(options.tenantId, key)
      : normalizeKey(key);

    try {
      await this.s3Client.deleteObject({
        bucket,
        key: resolvedKey,
        versionId: options.versionId,
      });

      this.completeOperation(operationId, true);
    } catch (error) {
      this.completeOperation(operationId, false);
      throw this.wrapError(error, `Failed to delete: ${resolvedKey}`);
    }
  }

  /**
   * Delete multiple files
   */
  async deleteMany(
    keys: string[],
    options: DeleteOptions = {}
  ): Promise<{ deleted: string[]; errors: Array<{ key: string; error: string }> }> {
    const operationId = this.startOperation();
    const bucket = options.bucket || this.config.defaultBucket;

    // Build keys with tenant prefix if provided
    const resolvedKeys = keys.map((key) =>
      options.tenantId ? buildTenantKey(options.tenantId, key) : normalizeKey(key)
    );

    try {
      const result = await this.s3Client.deleteObjects({
        bucket,
        keys: resolvedKeys.map((key) => ({ key })),
      });

      this.completeOperation(operationId, true);

      // Map back to original keys
      return {
        deleted: result.deleted.map((key) =>
          options.tenantId ? extractKeyFromTenantKey(key, options.tenantId) : key
        ),
        errors: result.errors.map((e) => ({
          key: options.tenantId ? extractKeyFromTenantKey(e.key, options.tenantId) : e.key,
          error: e.error,
        })),
      };
    } catch (error) {
      this.completeOperation(operationId, false);
      throw this.wrapError(error, 'Failed to delete files');
    }
  }

  // ============================================
  // Metadata Operations
  // ============================================

  /**
   * Get file metadata
   */
  async getMetadata(key: string, options: DownloadOptions = {}): Promise<FileMetadata> {
    const operationId = this.startOperation();
    const bucket = options.bucket || this.config.defaultBucket;

    // Build key with tenant prefix if provided
    const resolvedKey = options.tenantId
      ? buildTenantKey(options.tenantId, key)
      : normalizeKey(key);

    try {
      const metadata = await this.s3Client.headObject({
        bucket,
        key: resolvedKey,
        versionId: options.versionId,
      });

      this.completeOperation(operationId, true);
      return metadata;
    } catch (error) {
      this.completeOperation(operationId, false);
      throw this.wrapError(error, `Failed to get metadata: ${resolvedKey}`);
    }
  }

  /**
   * Check if file exists
   */
  async exists(key: string, options: DownloadOptions = {}): Promise<boolean> {
    try {
      await this.getMetadata(key, options);
      return true;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return false;
      }
      throw error;
    }
  }

  // ============================================
  // List Operations
  // ============================================

  /**
   * List files
   */
  async list(options: ListOptions = {}): Promise<ListResult> {
    const operationId = this.startOperation();
    const bucket = options.bucket || this.config.defaultBucket;

    // Build prefix with tenant if provided
    let prefix = options.prefix ? normalizeKey(options.prefix) : undefined;
    if (options.tenantId) {
      prefix = prefix
        ? buildTenantKey(options.tenantId, prefix)
        : `tenants/${normalizeKey(options.tenantId)}/`;
    }

    try {
      const result = await this.s3Client.listObjects({
        bucket,
        prefix,
        delimiter: options.delimiter,
        maxKeys: options.maxKeys,
        continuationToken: options.continuationToken,
      });

      this.completeOperation(operationId, true);

      // Map keys back if tenant prefix was used
      const files = result.contents.map((file) => ({
        ...file,
        key: options.tenantId ? extractKeyFromTenantKey(file.key, options.tenantId) : file.key,
      }));

      const prefixes = result.prefixes.map((p) =>
        options.tenantId ? extractKeyFromTenantKey(p, options.tenantId) : p
      );

      return {
        files,
        prefixes,
        isTruncated: result.isTruncated,
        continuationToken: result.continuationToken,
        keyCount: files.length,
      };
    } catch (error) {
      this.completeOperation(operationId, false);
      throw this.wrapError(error, 'Failed to list files');
    }
  }

  // ============================================
  // Copy Operations
  // ============================================

  /**
   * Copy a file
   */
  async copy(
    sourceKey: string,
    destinationKey: string,
    options: CopyOptions = {}
  ): Promise<FileMetadata> {
    const operationId = this.startOperation();
    const sourceBucket = options.sourceBucket || this.config.defaultBucket;
    const destinationBucket = options.destinationBucket || this.config.defaultBucket;

    // Build keys with tenant prefix if provided
    const resolvedSourceKey = options.tenantId
      ? buildTenantKey(options.tenantId, sourceKey)
      : normalizeKey(sourceKey);
    const resolvedDestKey = options.tenantId
      ? buildTenantKey(options.tenantId, destinationKey)
      : normalizeKey(destinationKey);

    try {
      const result = await this.s3Client.copyObject({
        sourceBucket,
        sourceKey: resolvedSourceKey,
        destinationBucket,
        destinationKey: resolvedDestKey,
        contentType: options.contentType,
        metadata: options.metadata,
        metadataDirective: options.metadataDirective,
        acl: options.acl,
      });

      this.completeOperation(operationId, true);

      // Get metadata of copied object
      const metadata = await this.getMetadata(destinationKey, { bucket: destinationBucket, tenantId: options.tenantId });

      return {
        ...metadata,
        etag: result.etag,
        versionId: result.versionId,
      };
    } catch (error) {
      this.completeOperation(operationId, false);
      throw this.wrapError(error, `Failed to copy: ${resolvedSourceKey} -> ${resolvedDestKey}`);
    }
  }

  /**
   * Move a file (copy + delete)
   */
  async move(
    sourceKey: string,
    destinationKey: string,
    options: CopyOptions = {}
  ): Promise<FileMetadata> {
    const metadata = await this.copy(sourceKey, destinationKey, options);
    await this.delete(sourceKey, {
      bucket: options.sourceBucket,
      tenantId: options.tenantId,
    });
    return metadata;
  }

  // ============================================
  // Bucket Operations
  // ============================================

  /**
   * Check if bucket exists
   */
  async bucketExists(bucket?: string): Promise<boolean> {
    return this.s3Client.bucketExists(bucket || this.config.defaultBucket);
  }

  /**
   * List all buckets
   */
  async listBuckets(): Promise<BucketInfo[]> {
    return this.s3Client.listBuckets();
  }

  /**
   * Create a bucket
   */
  async createBucket(bucket: string, options: CreateBucketOptions = {}): Promise<void> {
    await this.s3Client.createBucket(bucket, options.region || this.config.s3.region);
  }

  /**
   * Delete a bucket
   */
  async deleteBucket(bucket: string): Promise<void> {
    await this.s3Client.deleteBucket(bucket);
  }

  // ============================================
  // Presigned URL Operations
  // ============================================

  /**
   * Get presigned download URL
   */
  async getDownloadUrl(key: string, options: PresignedUrlOptions = {}): Promise<PresignedUrlResult> {
    return this.presignedGenerator.getDownloadUrl(key, options);
  }

  /**
   * Get presigned upload URL
   */
  async getUploadUrl(key: string, options: PresignedUrlOptions = {}): Promise<PresignedUrlResult> {
    return this.presignedGenerator.getUploadUrl(key, options);
  }

  /**
   * Get batch download URLs
   */
  async getBatchDownloadUrls(
    keys: string[],
    options: PresignedUrlOptions = {}
  ): Promise<Map<string, PresignedUrlResult>> {
    return this.presignedGenerator.getBatchDownloadUrls(keys, options);
  }

  /**
   * Get batch upload URLs
   */
  async getBatchUploadUrls(
    keys: string[],
    options: PresignedUrlOptions = {}
  ): Promise<Map<string, PresignedUrlResult>> {
    return this.presignedGenerator.getBatchUploadUrls(keys, options);
  }

  // ============================================
  // Multipart Upload Management
  // ============================================

  /**
   * Initiate a multipart upload
   */
  async initiateMultipartUpload(
    key: string,
    options: UploadOptions = {}
  ): Promise<string> {
    const bucket = options.bucket || this.config.defaultBucket;
    const resolvedKey = options.tenantId
      ? buildTenantKey(options.tenantId, key)
      : normalizeKey(key);

    const uploadId = await this.s3Client.createMultipartUpload({
      bucket,
      key: resolvedKey,
      contentType: options.contentType,
      metadata: options.metadata,
      storageClass: options.storageClass,
      serverSideEncryption: options.serverSideEncryption,
      kmsKeyId: options.kmsKeyId,
      acl: options.acl,
    });

    // Track active upload
    this.activeMultipartUploads.set(uploadId, {
      uploadId,
      key: resolvedKey,
      bucket,
      completedParts: [],
      initiatedAt: new Date(),
    });

    return uploadId;
  }

  /**
   * Upload a part
   */
  async uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    data: Buffer,
    options: UploadOptions = {}
  ): Promise<CompletedPart> {
    const bucket = options.bucket || this.config.defaultBucket;
    const resolvedKey = options.tenantId
      ? buildTenantKey(options.tenantId, key)
      : normalizeKey(key);

    const result = await this.s3Client.uploadPart({
      bucket,
      key: resolvedKey,
      uploadId,
      partNumber,
      body: data,
    });

    // Update tracked upload state
    const uploadState = this.activeMultipartUploads.get(uploadId);
    if (uploadState) {
      uploadState.completedParts.push({ partNumber, etag: result.etag });
    }

    this.stats.bytesUploaded += data.length;

    return { partNumber, etag: result.etag };
  }

  /**
   * Complete a multipart upload
   */
  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: CompletedPart[],
    options: UploadOptions = {}
  ): Promise<FileMetadata> {
    const bucket = options.bucket || this.config.defaultBucket;
    const resolvedKey = options.tenantId
      ? buildTenantKey(options.tenantId, key)
      : normalizeKey(key);

    const result = await this.s3Client.completeMultipartUpload({
      bucket,
      key: resolvedKey,
      uploadId,
      parts: parts.sort((a, b) => a.partNumber - b.partNumber),
    });

    // Remove from active uploads
    this.activeMultipartUploads.delete(uploadId);

    // Get metadata
    const metadata = await this.getMetadata(key, { bucket, tenantId: options.tenantId });

    return {
      ...metadata,
      etag: result.etag,
      versionId: result.versionId,
    };
  }

  /**
   * Abort a multipart upload
   */
  async abortMultipartUpload(
    key: string,
    uploadId: string,
    options: DeleteOptions = {}
  ): Promise<void> {
    const bucket = options.bucket || this.config.defaultBucket;
    const resolvedKey = options.tenantId
      ? buildTenantKey(options.tenantId, key)
      : normalizeKey(key);

    await this.s3Client.abortMultipartUpload({
      bucket,
      key: resolvedKey,
      uploadId,
    });

    // Remove from active uploads
    this.activeMultipartUploads.delete(uploadId);
  }

  /**
   * Get presigned URL for multipart part upload
   */
  async getMultipartPartUploadUrl(
    key: string,
    uploadId: string,
    partNumber: number,
    options: PresignedUrlOptions = {}
  ): Promise<PresignedUrlResult> {
    return this.presignedGenerator.getMultipartPartUploadUrl(key, uploadId, partNumber, options);
  }

  // ============================================
  // Health Check
  // ============================================

  /**
   * Perform health check
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Check if bucket is accessible
      const bucketAccessible = await this.bucketExists();

      const responseTimeMs = Date.now() - startTime;

      return {
        healthy: true,
        status: this.s3Client.getStatus(),
        responseTimeMs,
        stats: this.getStats(),
        timestamp: new Date(),
        bucketAccessible,
        providerInfo: {
          provider: this.config.provider,
          region: this.config.s3.region,
          endpoint: this.config.s3.endpoint,
        },
      };
    } catch (error) {
      const responseTimeMs = Date.now() - startTime;

      return {
        healthy: false,
        status: 'error',
        responseTimeMs,
        stats: this.getStats(),
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
        bucketAccessible: false,
      };
    }
  }

  // ============================================
  // Event Handling
  // ============================================

  /**
   * Add event listener
   */
  on(event: StorageEvent, listener: StorageEventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  /**
   * Remove event listener
   */
  off(event: StorageEvent, listener: StorageEventListener): void {
    this.listeners.get(event)?.delete(listener);
  }

  /**
   * Emit event
   */
  private emit(event: StorageEvent, data?: Record<string, unknown>): void {
    this.listeners.get(event)?.forEach((listener) => listener(event, data));
  }

  // ============================================
  // Private Helpers
  // ============================================

  /**
   * Start tracking an operation
   */
  private startOperation(): string {
    const operationId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    this.operationStartTimes.set(operationId, Date.now());
    this.stats.totalOperations++;
    return operationId;
  }

  /**
   * Complete an operation
   */
  private completeOperation(operationId: string, success: boolean): void {
    const startTime = this.operationStartTimes.get(operationId);
    if (startTime) {
      const latency = Date.now() - startTime;
      this.totalLatency += latency;
      this.stats.avgLatencyMs = this.totalLatency / this.stats.totalOperations;
      this.operationStartTimes.delete(operationId);
    }

    if (success) {
      this.stats.successfulOperations++;
    } else {
      this.stats.failedOperations++;
    }
  }

  /**
   * Check if error is a not found error
   */
  private isNotFoundError(error: unknown): boolean {
    if (error instanceof ForgeError) {
      return error.message.includes('NoSuchKey') || error.message.includes('NotFound');
    }
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

/**
 * Tenant-scoped storage client
 */
export class TenantStorage {
  private service: StorageService;
  private tenantContext: TenantContext;

  constructor(service: StorageService, context: TenantContext) {
    this.service = service;
    this.tenantContext = context;
  }

  /**
   * Get tenant ID
   */
  getTenantId(): string {
    return this.tenantContext.tenantId;
  }

  /**
   * Upload a file
   */
  async upload(key: string, data: UploadSource, options: Omit<UploadOptions, 'tenantId'> = {}): Promise<FileMetadata> {
    return this.service.upload(key, data, { ...options, tenantId: this.tenantContext.tenantId });
  }

  /**
   * Download a file
   */
  async download(key: string, options: Omit<DownloadOptions, 'tenantId'> = {}): Promise<DownloadResult> {
    return this.service.download(key, { ...options, tenantId: this.tenantContext.tenantId });
  }

  /**
   * Download a file as stream
   */
  async downloadStream(key: string, options: Omit<DownloadOptions, 'tenantId'> = {}): Promise<StreamDownloadResult> {
    return this.service.downloadStream(key, { ...options, tenantId: this.tenantContext.tenantId });
  }

  /**
   * Delete a file
   */
  async delete(key: string, options: Omit<DeleteOptions, 'tenantId'> = {}): Promise<void> {
    return this.service.delete(key, { ...options, tenantId: this.tenantContext.tenantId });
  }

  /**
   * Delete multiple files
   */
  async deleteMany(keys: string[], options: Omit<DeleteOptions, 'tenantId'> = {}): Promise<{ deleted: string[]; errors: Array<{ key: string; error: string }> }> {
    return this.service.deleteMany(keys, { ...options, tenantId: this.tenantContext.tenantId });
  }

  /**
   * Get file metadata
   */
  async getMetadata(key: string, options: Omit<DownloadOptions, 'tenantId'> = {}): Promise<FileMetadata> {
    return this.service.getMetadata(key, { ...options, tenantId: this.tenantContext.tenantId });
  }

  /**
   * Check if file exists
   */
  async exists(key: string, options: Omit<DownloadOptions, 'tenantId'> = {}): Promise<boolean> {
    return this.service.exists(key, { ...options, tenantId: this.tenantContext.tenantId });
  }

  /**
   * List files
   */
  async list(options: Omit<ListOptions, 'tenantId'> = {}): Promise<ListResult> {
    return this.service.list({ ...options, tenantId: this.tenantContext.tenantId });
  }

  /**
   * Copy a file
   */
  async copy(sourceKey: string, destinationKey: string, options: Omit<CopyOptions, 'tenantId'> = {}): Promise<FileMetadata> {
    return this.service.copy(sourceKey, destinationKey, { ...options, tenantId: this.tenantContext.tenantId });
  }

  /**
   * Move a file
   */
  async move(sourceKey: string, destinationKey: string, options: Omit<CopyOptions, 'tenantId'> = {}): Promise<FileMetadata> {
    return this.service.move(sourceKey, destinationKey, { ...options, tenantId: this.tenantContext.tenantId });
  }

  /**
   * Get presigned download URL
   */
  async getDownloadUrl(key: string, options: Omit<PresignedUrlOptions, 'tenantId'> = {}): Promise<PresignedUrlResult> {
    return this.service.getDownloadUrl(key, { ...options, tenantId: this.tenantContext.tenantId });
  }

  /**
   * Get presigned upload URL
   */
  async getUploadUrl(key: string, options: Omit<PresignedUrlOptions, 'tenantId'> = {}): Promise<PresignedUrlResult> {
    return this.service.getUploadUrl(key, { ...options, tenantId: this.tenantContext.tenantId });
  }
}

// Singleton instance
let storageServiceInstance: StorageService | null = null;

/**
 * Get the singleton storage service instance
 */
export function getStorageService(config?: Partial<StorageConfig>): StorageService {
  if (!storageServiceInstance) {
    storageServiceInstance = new StorageService(config);
  }
  return storageServiceInstance;
}

/**
 * Reset the singleton storage service instance (for testing)
 */
export function resetStorageService(): void {
  if (storageServiceInstance) {
    storageServiceInstance.disconnect();
    storageServiceInstance = null;
  }
  resetS3Client();
}
