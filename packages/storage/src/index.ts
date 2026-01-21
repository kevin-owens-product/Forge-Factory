/**
 * @package @forge/storage
 * @description S3/R2 object storage wrapper for Forge Factory
 */

// Types
export {
  // Provider
  StorageProvider,

  // Configuration
  S3Config,
  DEFAULT_S3_CONFIG,
  StorageConfig,
  DEFAULT_STORAGE_CONFIG,

  // Status and Events
  ConnectionStatus,
  StorageEvent,
  StorageEventListener,

  // File and Bucket
  FileMetadata,
  BucketInfo,

  // Options
  UploadOptions,
  UploadProgress,
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

  // Statistics and Health
  StorageStats,
  HealthCheckResult,

  // Tenant
  TenantContext,

  // Shutdown
  ShutdownOptions,
  DEFAULT_SHUTDOWN_OPTIONS,

  // Upload/Download
  UploadSource,
  DownloadResult,
  StreamDownloadResult,
} from './storage.types';

// S3 Client
export {
  S3Client,
  S3ClientInterface,
  S3CommandFactory,
  S3PresignerInterface,
  S3ClientCommand,
  PutObjectParams,
  GetObjectParams,
  HeadObjectParams,
  DeleteObjectParams,
  DeleteObjectsParams,
  ListObjectsParams,
  CopyObjectParams,
  CreateMultipartParams,
  UploadPartParams,
  CompleteMultipartParams,
  AbortMultipartParams,
  getS3Client,
  resetS3Client,
} from './s3-client';

// Presigned URL Generator
export {
  PresignedUrlGenerator,
  createPresignedUrlGenerator,
} from './presigned';

// Storage Service
export {
  StorageService,
  TenantStorage,
  getStorageService,
  resetStorageService,
} from './storage.service';

// File Utilities
export {
  getMimeTypeFromExtension,
  getMimeTypeFromBuffer,
  detectMimeType,
  getFileExtension,
  getBaseName,
  getDirectory,
  normalizeKey,
  buildTenantKey,
  extractKeyFromTenantKey,
  validateKey,
  generateUniqueKey,
  calculateSize,
  formatFileSize,
  parseFileSize,
  isImageMimeType,
  isVideoMimeType,
  isAudioMimeType,
  isTextMimeType,
  splitBuffer,
  streamToBuffer,
  bufferToStream,
  getContentDisposition,
  buildTagsString,
  parseTagsString,
} from './file-utils';
