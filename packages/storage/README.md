# @forge/storage

S3/R2 object storage wrapper for Forge Factory.

## Features

- **S3-Compatible**: Works with AWS S3, Cloudflare R2, and MinIO
- **Upload/Download**: Full support for file operations with streams and buffers
- **Multipart Upload**: Automatic chunking for large files
- **Presigned URLs**: Generate secure URLs for direct uploads/downloads
- **Multi-Tenant**: Built-in tenant isolation with prefix-based namespacing
- **MIME Detection**: Automatic content type detection from file extensions and magic bytes
- **Health Checks**: Monitor storage connectivity and statistics
- **TypeScript**: Full type safety with comprehensive interfaces

## Installation

```bash
pnpm add @forge/storage
```

### Peer Dependencies

```bash
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

## Quick Start

```typescript
import { StorageService, getStorageService } from '@forge/storage';

// Get singleton instance
const storage = getStorageService({
  defaultBucket: 'my-bucket',
  s3: {
    region: 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Connect
await storage.connect();

// Upload a file
const metadata = await storage.upload('documents/report.pdf', fileBuffer, {
  contentType: 'application/pdf',
  metadata: { author: 'John Doe' },
});

// Download a file
const { data, metadata: fileMeta } = await storage.download('documents/report.pdf');

// Generate presigned URL
const { url, expiresAt } = await storage.getDownloadUrl('documents/report.pdf', {
  expiresIn: 3600,
});

// Disconnect
await storage.disconnect();
```

## Configuration

```typescript
interface StorageConfig {
  s3: {
    region: string;
    endpoint?: string; // Required for R2/MinIO
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle: boolean;
    connectTimeoutMs: number;
    requestTimeoutMs: number;
    maxRetries: number;
  };
  defaultBucket: string;
  provider: 's3' | 'r2' | 'minio';
  enableLogging: boolean;
  environment: 'development' | 'production' | 'test';
  defaultPresignedExpirySeconds: number;
  maxSingleUploadBytes: number;
  multipartPartSizeBytes: number;
  maxConcurrentUploads: number;
}
```

### Cloudflare R2 Configuration

```typescript
const storage = getStorageService({
  provider: 'r2',
  defaultBucket: 'my-r2-bucket',
  s3: {
    region: 'auto',
    endpoint: 'https://<account_id>.r2.cloudflarestorage.com',
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    forcePathStyle: true,
  },
});
```

### MinIO Configuration

```typescript
const storage = getStorageService({
  provider: 'minio',
  defaultBucket: 'my-minio-bucket',
  s3: {
    region: 'us-east-1',
    endpoint: 'http://localhost:9000',
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin',
    forcePathStyle: true,
  },
});
```

## Multi-Tenant Support

### Using TenantStorage

```typescript
import { TenantStorage } from '@forge/storage';

const tenantStorage = new TenantStorage(storage, {
  tenantId: 'tenant-123',
  userId: 'user-456',
});

// All operations are automatically prefixed with tenant ID
await tenantStorage.upload('documents/file.txt', data);
// Stored at: tenants/tenant-123/documents/file.txt

await tenantStorage.list();
// Lists only: tenants/tenant-123/*
```

### Manual Tenant Prefix

```typescript
await storage.upload('file.txt', data, { tenantId: 'tenant-123' });
await storage.download('file.txt', { tenantId: 'tenant-123' });
await storage.list({ tenantId: 'tenant-123' });
```

## File Operations

### Upload

```typescript
// Upload buffer
await storage.upload('path/to/file.txt', Buffer.from('content'));

// Upload string
await storage.upload('path/to/file.txt', 'text content');

// Upload stream
await storage.upload('path/to/file.txt', readableStream);

// Upload with options
await storage.upload('path/to/file.pdf', data, {
  contentType: 'application/pdf',
  metadata: { version: '1.0' },
  storageClass: 'STANDARD_IA',
  serverSideEncryption: 'AES256',
  cacheControl: 'max-age=31536000',
  onProgress: (progress) => {
    console.log(`Uploaded ${progress.percentage}%`);
  },
});
```

### Download

```typescript
// Download as buffer
const { data, metadata } = await storage.download('path/to/file.txt');

// Download as stream
const { stream, metadata } = await storage.downloadStream('path/to/file.txt');

// Download with byte range
const { data } = await storage.download('path/to/large-file.bin', {
  rangeStart: 0,
  rangeEnd: 1023,
});
```

### Delete

```typescript
// Delete single file
await storage.delete('path/to/file.txt');

// Delete multiple files
const { deleted, errors } = await storage.deleteMany([
  'file1.txt',
  'file2.txt',
  'file3.txt',
]);
```

### Copy and Move

```typescript
// Copy file
await storage.copy('source/file.txt', 'destination/file.txt');

// Move file (copy + delete)
await storage.move('old/location.txt', 'new/location.txt');

// Copy between buckets
await storage.copy('file.txt', 'file.txt', {
  sourceBucket: 'source-bucket',
  destinationBucket: 'dest-bucket',
});
```

### List

```typescript
// List all files
const { files, prefixes, isTruncated, continuationToken } = await storage.list();

// List with prefix
const result = await storage.list({ prefix: 'documents/' });

// List with pagination
let token: string | undefined;
do {
  const result = await storage.list({
    maxKeys: 100,
    continuationToken: token,
  });
  token = result.continuationToken;
} while (result.isTruncated);

// List "folders" using delimiter
const result = await storage.list({
  prefix: 'documents/',
  delimiter: '/',
});
// result.prefixes contains "folders"
// result.files contains files at this level
```

### Metadata

```typescript
// Get file metadata
const metadata = await storage.getMetadata('path/to/file.txt');
console.log(metadata.sizeBytes, metadata.contentType, metadata.lastModified);

// Check if file exists
const exists = await storage.exists('path/to/file.txt');
```

## Presigned URLs

```typescript
// Generate download URL
const { url, expiresAt, method } = await storage.getDownloadUrl('file.txt', {
  expiresIn: 3600, // 1 hour
  responseContentDisposition: 'attachment; filename="download.txt"',
});

// Generate upload URL
const { url, headers } = await storage.getUploadUrl('file.txt', {
  expiresIn: 3600,
  contentType: 'image/png',
});

// Batch generate URLs
const downloadUrls = await storage.getBatchDownloadUrls(['file1.txt', 'file2.txt']);
const uploadUrls = await storage.getBatchUploadUrls(['file1.txt', 'file2.txt']);
```

## Multipart Upload

```typescript
// Automatic multipart upload (for large files)
await storage.upload('large-file.zip', largeBuffer); // Uses multipart automatically

// Manual multipart upload
const uploadId = await storage.initiateMultipartUpload('large-file.zip', {
  contentType: 'application/zip',
});

const parts: CompletedPart[] = [];
for (let i = 0; i < chunks.length; i++) {
  const part = await storage.uploadPart('large-file.zip', uploadId, i + 1, chunks[i]);
  parts.push(part);
}

await storage.completeMultipartUpload('large-file.zip', uploadId, parts);

// Or abort if needed
await storage.abortMultipartUpload('large-file.zip', uploadId);
```

## Bucket Operations

```typescript
// Check if bucket exists
const exists = await storage.bucketExists('my-bucket');

// List all buckets
const buckets = await storage.listBuckets();

// Create bucket
await storage.createBucket('new-bucket', { region: 'us-west-2' });

// Delete bucket
await storage.deleteBucket('old-bucket');
```

## Health Check

```typescript
const health = await storage.healthCheck();
console.log({
  healthy: health.healthy,
  status: health.status,
  responseTimeMs: health.responseTimeMs,
  bucketAccessible: health.bucketAccessible,
  stats: health.stats,
});
```

## File Utilities

```typescript
import {
  detectMimeType,
  formatFileSize,
  parseFileSize,
  validateKey,
  generateUniqueKey,
  isImageMimeType,
} from '@forge/storage';

// Detect MIME type
const mimeType = detectMimeType('file.png', buffer);

// Format file size
formatFileSize(1048576); // "1.00 MB"

// Parse file size
parseFileSize('1.5 GB'); // 1610612736

// Validate storage key
const { valid, error } = validateKey('../invalid/path');

// Generate unique key
const key = generateUniqueKey('uploads', 'png');
// "uploads/1705432800000-a1b2c3d4.png"

// Check MIME type categories
isImageMimeType('image/png'); // true
isVideoMimeType('video/mp4'); // true
isTextMimeType('application/json'); // true
```

## Events

```typescript
storage.on('connected', () => console.log('Connected'));
storage.on('disconnected', () => console.log('Disconnected'));
storage.on('error', (event, data) => console.error('Error:', data));
storage.on('upload:start', (event, data) => console.log('Upload started:', data.key));
storage.on('upload:progress', (event, data) => console.log('Progress:', data.percentage));
storage.on('upload:complete', (event, data) => console.log('Upload complete:', data.key));
storage.on('upload:error', (event, data) => console.error('Upload failed:', data.error));
storage.on('download:start', (event, data) => console.log('Download started'));
storage.on('download:complete', (event, data) => console.log('Download complete'));
storage.on('download:error', (event, data) => console.error('Download failed'));
```

## Statistics

```typescript
const stats = storage.getStats();
console.log({
  totalOperations: stats.totalOperations,
  successfulOperations: stats.successfulOperations,
  failedOperations: stats.failedOperations,
  bytesUploaded: stats.bytesUploaded,
  bytesDownloaded: stats.bytesDownloaded,
  avgLatencyMs: stats.avgLatencyMs,
});
```

## Error Handling

```typescript
import { ForgeError, ErrorCode } from '@forge/errors';

try {
  await storage.download('nonexistent.txt');
} catch (error) {
  if (error instanceof ForgeError && error.code === ErrorCode.STORAGE_ERROR) {
    console.error('Storage error:', error.message);
  }
}
```

## License

ISC
