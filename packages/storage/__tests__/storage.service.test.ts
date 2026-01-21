/**
 * @package @forge/storage
 * @description Tests for storage service and related utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Readable } from 'stream';
import {
  DEFAULT_S3_CONFIG,
  DEFAULT_STORAGE_CONFIG,
  DEFAULT_SHUTDOWN_OPTIONS,
  StorageStats,
  FileMetadata,
  BucketInfo,
  ListResult,
  PresignedUrlResult,
} from '../src/storage.types';
import {
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
} from '../src/file-utils';
import {
  S3Client,
  S3ClientInterface,
  S3CommandFactory,
  getS3Client,
  resetS3Client,
} from '../src/s3-client';
import {
  PresignedUrlGenerator,
  createPresignedUrlGenerator,
} from '../src/presigned';
import {
  StorageService,
  TenantStorage,
  getStorageService,
  resetStorageService,
} from '../src/storage.service';

// Mock @forge/errors
vi.mock('@forge/errors', () => ({
  ErrorCode: {
    STORAGE_ERROR: 'INT_9005',
  },
  ForgeError: class ForgeError extends Error {
    code: string;
    statusCode: number;
    details?: unknown;
    metadata?: Record<string, unknown>;

    constructor(params: {
      code: string;
      message: string;
      statusCode: number;
      details?: unknown;
      metadata?: Record<string, unknown>;
    }) {
      super(params.message);
      this.code = params.code;
      this.statusCode = params.statusCode;
      this.details = params.details;
      this.metadata = params.metadata;
    }
  },
}));

// ============================================
// Storage Types Tests
// ============================================

describe('Storage Types', () => {
  describe('DEFAULT_S3_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_S3_CONFIG).toEqual({
        region: 'us-east-1',
        accessKeyId: '',
        secretAccessKey: '',
        forcePathStyle: false,
        connectTimeoutMs: 10000,
        requestTimeoutMs: 30000,
        maxRetries: 3,
      });
    });
  });

  describe('DEFAULT_STORAGE_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_STORAGE_CONFIG.defaultBucket).toBe('forge-storage');
      expect(DEFAULT_STORAGE_CONFIG.provider).toBe('s3');
      expect(DEFAULT_STORAGE_CONFIG.enableLogging).toBe(false);
      expect(DEFAULT_STORAGE_CONFIG.environment).toBe('production');
      expect(DEFAULT_STORAGE_CONFIG.defaultPresignedExpirySeconds).toBe(3600);
      expect(DEFAULT_STORAGE_CONFIG.maxSingleUploadBytes).toBe(5 * 1024 * 1024 * 1024);
      expect(DEFAULT_STORAGE_CONFIG.multipartPartSizeBytes).toBe(5 * 1024 * 1024);
      expect(DEFAULT_STORAGE_CONFIG.maxConcurrentUploads).toBe(4);
    });
  });

  describe('DEFAULT_SHUTDOWN_OPTIONS', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_SHUTDOWN_OPTIONS).toEqual({
        timeoutMs: 5000,
        abortPendingUploads: true,
      });
    });
  });
});

// ============================================
// File Utils Tests
// ============================================

describe('File Utils', () => {
  describe('getMimeTypeFromExtension', () => {
    it('should return correct MIME type for common extensions', () => {
      expect(getMimeTypeFromExtension('file.txt')).toBe('text/plain');
      expect(getMimeTypeFromExtension('file.html')).toBe('text/html');
      expect(getMimeTypeFromExtension('file.css')).toBe('text/css');
      expect(getMimeTypeFromExtension('file.js')).toBe('application/javascript');
      expect(getMimeTypeFromExtension('file.json')).toBe('application/json');
      expect(getMimeTypeFromExtension('file.png')).toBe('image/png');
      expect(getMimeTypeFromExtension('file.jpg')).toBe('image/jpeg');
      expect(getMimeTypeFromExtension('file.jpeg')).toBe('image/jpeg');
      expect(getMimeTypeFromExtension('file.gif')).toBe('image/gif');
      expect(getMimeTypeFromExtension('file.svg')).toBe('image/svg+xml');
      expect(getMimeTypeFromExtension('file.pdf')).toBe('application/pdf');
      expect(getMimeTypeFromExtension('file.zip')).toBe('application/zip');
      expect(getMimeTypeFromExtension('file.mp4')).toBe('video/mp4');
      expect(getMimeTypeFromExtension('file.mp3')).toBe('audio/mpeg');
    });

    it('should return octet-stream for unknown extensions', () => {
      expect(getMimeTypeFromExtension('file.xyz')).toBe('application/octet-stream');
      expect(getMimeTypeFromExtension('file')).toBe('application/octet-stream');
    });

    it('should be case-insensitive', () => {
      expect(getMimeTypeFromExtension('FILE.TXT')).toBe('text/plain');
      expect(getMimeTypeFromExtension('file.PNG')).toBe('image/png');
    });
  });

  describe('getMimeTypeFromBuffer', () => {
    it('should detect PNG from magic bytes', () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]);
      expect(getMimeTypeFromBuffer(pngBuffer)).toBe('image/png');
    });

    it('should detect JPEG from magic bytes', () => {
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
      expect(getMimeTypeFromBuffer(jpegBuffer)).toBe('image/jpeg');
    });

    it('should detect GIF from magic bytes', () => {
      const gifBuffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
      expect(getMimeTypeFromBuffer(gifBuffer)).toBe('image/gif');
    });

    it('should detect PDF from magic bytes', () => {
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E]);
      expect(getMimeTypeFromBuffer(pdfBuffer)).toBe('application/pdf');
    });

    it('should detect ZIP from magic bytes', () => {
      const zipBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x00, 0x00]);
      expect(getMimeTypeFromBuffer(zipBuffer)).toBe('application/zip');
    });

    it('should return null for unknown content', () => {
      const unknownBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      expect(getMimeTypeFromBuffer(unknownBuffer)).toBeNull();
    });

    it('should return null for empty buffer', () => {
      expect(getMimeTypeFromBuffer(Buffer.alloc(0))).toBeNull();
    });
  });

  describe('detectMimeType', () => {
    it('should prefer magic bytes over extension when available', () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]);
      expect(detectMimeType('file.jpg', pngBuffer)).toBe('image/png');
    });

    it('should fall back to extension when buffer has no magic bytes', () => {
      const unknownBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      expect(detectMimeType('file.txt', unknownBuffer)).toBe('text/plain');
    });

    it('should use extension when no buffer provided', () => {
      expect(detectMimeType('file.json')).toBe('application/json');
    });
  });

  describe('getFileExtension', () => {
    it('should extract extension correctly', () => {
      expect(getFileExtension('file.txt')).toBe('.txt');
      expect(getFileExtension('file.tar.gz')).toBe('.gz');
      expect(getFileExtension('path/to/file.json')).toBe('.json');
    });

    it('should return empty string for files without extension', () => {
      expect(getFileExtension('file')).toBe('');
      expect(getFileExtension('.hidden')).toBe('');
    });
  });

  describe('getBaseName', () => {
    it('should extract base name correctly', () => {
      expect(getBaseName('file.txt')).toBe('file');
      expect(getBaseName('path/to/file.json')).toBe('file');
      expect(getBaseName('path\\to\\file.json')).toBe('file');
    });

    it('should handle files without extension', () => {
      expect(getBaseName('file')).toBe('file');
      expect(getBaseName('path/to/file')).toBe('file');
    });
  });

  describe('getDirectory', () => {
    it('should extract directory correctly', () => {
      expect(getDirectory('path/to/file.txt')).toBe('path/to');
      expect(getDirectory('path\\to\\file.txt')).toBe('path\\to');
    });

    it('should return empty string for files without directory', () => {
      expect(getDirectory('file.txt')).toBe('');
    });
  });

  describe('normalizeKey', () => {
    it('should normalize key correctly', () => {
      expect(normalizeKey('/path/to/file/')).toBe('path/to/file');
      expect(normalizeKey('path//to//file')).toBe('path/to/file');
      expect(normalizeKey('path\\to\\file')).toBe('path/to/file');
    });

    it('should handle already normalized keys', () => {
      expect(normalizeKey('path/to/file')).toBe('path/to/file');
    });
  });

  describe('buildTenantKey', () => {
    it('should build tenant key correctly', () => {
      expect(buildTenantKey('tenant1', 'file.txt')).toBe('tenants/tenant1/file.txt');
      expect(buildTenantKey('tenant1', '/path/to/file.txt')).toBe('tenants/tenant1/path/to/file.txt');
    });
  });

  describe('extractKeyFromTenantKey', () => {
    it('should extract key correctly', () => {
      expect(extractKeyFromTenantKey('tenants/tenant1/file.txt', 'tenant1')).toBe('file.txt');
      expect(extractKeyFromTenantKey('tenants/tenant1/path/to/file.txt', 'tenant1')).toBe('path/to/file.txt');
    });

    it('should return original key if not matching prefix', () => {
      expect(extractKeyFromTenantKey('other/path/file.txt', 'tenant1')).toBe('other/path/file.txt');
    });
  });

  describe('validateKey', () => {
    it('should validate valid keys', () => {
      expect(validateKey('file.txt')).toEqual({ valid: true });
      expect(validateKey('path/to/file.txt')).toEqual({ valid: true });
      expect(validateKey('a'.repeat(1024))).toEqual({ valid: true });
    });

    it('should reject empty keys', () => {
      expect(validateKey('')).toEqual({ valid: false, error: 'Key cannot be empty' });
    });

    it('should reject keys over 1024 characters', () => {
      expect(validateKey('a'.repeat(1025))).toEqual({
        valid: false,
        error: 'Key cannot exceed 1024 characters',
      });
    });

    it('should reject keys with path traversal', () => {
      expect(validateKey('../etc/passwd')).toEqual({
        valid: false,
        error: 'Key cannot contain path traversal (..)',
      });
    });

    it('should reject keys with control characters', () => {
      expect(validateKey('file\x00.txt')).toEqual({
        valid: false,
        error: 'Key contains invalid control characters',
      });
    });
  });

  describe('generateUniqueKey', () => {
    it('should generate unique keys', () => {
      const key1 = generateUniqueKey('uploads');
      const key2 = generateUniqueKey('uploads');
      expect(key1).not.toBe(key2);
      expect(key1).toMatch(/^uploads\/\d+-[a-z0-9]+$/);
    });

    it('should include extension when provided', () => {
      const key = generateUniqueKey('images', 'png');
      expect(key).toMatch(/^images\/\d+-[a-z0-9]+\.png$/);
    });

    it('should handle extension with leading dot', () => {
      const key = generateUniqueKey('images', '.png');
      expect(key).toMatch(/^images\/\d+-[a-z0-9]+\.png$/);
    });
  });

  describe('calculateSize', () => {
    it('should calculate buffer size', () => {
      expect(calculateSize(Buffer.from('hello'))).toBe(5);
    });

    it('should calculate string size in UTF-8', () => {
      expect(calculateSize('hello')).toBe(5);
      expect(calculateSize('こんにちは')).toBe(15); // 5 characters * 3 bytes each
    });

    it('should return null for streams', () => {
      const stream = new Readable();
      expect(calculateSize(stream)).toBeNull();
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(500)).toBe('500 B');
      expect(formatFileSize(1024)).toBe('1.00 KB');
      expect(formatFileSize(1536)).toBe('1.50 KB');
      expect(formatFileSize(1048576)).toBe('1.00 MB');
      expect(formatFileSize(1073741824)).toBe('1.00 GB');
    });
  });

  describe('parseFileSize', () => {
    it('should parse size strings correctly', () => {
      expect(parseFileSize('500')).toBe(500);
      expect(parseFileSize('500B')).toBe(500);
      expect(parseFileSize('1KB')).toBe(1024);
      expect(parseFileSize('1.5 MB')).toBe(1572864);
      expect(parseFileSize('1GB')).toBe(1073741824);
    });

    it('should return null for invalid strings', () => {
      expect(parseFileSize('invalid')).toBeNull();
      expect(parseFileSize('')).toBeNull();
    });
  });

  describe('MIME type checks', () => {
    it('isImageMimeType should return correct values', () => {
      expect(isImageMimeType('image/png')).toBe(true);
      expect(isImageMimeType('image/jpeg')).toBe(true);
      expect(isImageMimeType('text/plain')).toBe(false);
    });

    it('isVideoMimeType should return correct values', () => {
      expect(isVideoMimeType('video/mp4')).toBe(true);
      expect(isVideoMimeType('video/webm')).toBe(true);
      expect(isVideoMimeType('image/png')).toBe(false);
    });

    it('isAudioMimeType should return correct values', () => {
      expect(isAudioMimeType('audio/mpeg')).toBe(true);
      expect(isAudioMimeType('audio/wav')).toBe(true);
      expect(isAudioMimeType('video/mp4')).toBe(false);
    });

    it('isTextMimeType should return correct values', () => {
      expect(isTextMimeType('text/plain')).toBe(true);
      expect(isTextMimeType('text/html')).toBe(true);
      expect(isTextMimeType('application/json')).toBe(true);
      expect(isTextMimeType('application/javascript')).toBe(true);
      expect(isTextMimeType('image/png')).toBe(false);
    });
  });

  describe('splitBuffer', () => {
    it('should split buffer into chunks', () => {
      const buffer = Buffer.from('hello world');
      const chunks = Array.from(splitBuffer(buffer, 5));
      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toEqual({ chunk: Buffer.from('hello'), partNumber: 1 });
      expect(chunks[1]).toEqual({ chunk: Buffer.from(' worl'), partNumber: 2 });
      expect(chunks[2]).toEqual({ chunk: Buffer.from('d'), partNumber: 3 });
    });

    it('should handle buffer smaller than chunk size', () => {
      const buffer = Buffer.from('hi');
      const chunks = Array.from(splitBuffer(buffer, 10));
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toEqual({ chunk: Buffer.from('hi'), partNumber: 1 });
    });
  });

  describe('streamToBuffer', () => {
    it('should convert stream to buffer', async () => {
      const stream = Readable.from(['hello', ' ', 'world']);
      const buffer = await streamToBuffer(stream);
      expect(buffer.toString()).toBe('hello world');
    });
  });

  describe('bufferToStream', () => {
    it('should convert buffer to stream', async () => {
      const buffer = Buffer.from('hello');
      const stream = bufferToStream(buffer);
      const result = await streamToBuffer(stream);
      expect(result.toString()).toBe('hello');
    });
  });

  describe('getContentDisposition', () => {
    it('should return attachment disposition by default', () => {
      const result = getContentDisposition('file.txt');
      expect(result).toContain('attachment');
      expect(result).toContain('filename="file.txt"');
    });

    it('should return inline disposition when specified', () => {
      const result = getContentDisposition('file.txt', true);
      expect(result).toContain('inline');
    });

    it('should encode filenames with special characters', () => {
      const result = getContentDisposition('файл.txt');
      expect(result).toContain("filename*=UTF-8''");
    });
  });

  describe('buildTagsString', () => {
    it('should build tags string correctly', () => {
      const tags = { key1: 'value1', key2: 'value2' };
      expect(buildTagsString(tags)).toBe('key1=value1&key2=value2');
    });

    it('should encode special characters', () => {
      const tags = { 'key name': 'value&value' };
      expect(buildTagsString(tags)).toBe('key%20name=value%26value');
    });
  });

  describe('parseTagsString', () => {
    it('should parse tags string correctly', () => {
      const result = parseTagsString('key1=value1&key2=value2');
      expect(result).toEqual({ key1: 'value1', key2: 'value2' });
    });

    it('should decode special characters', () => {
      const result = parseTagsString('key%20name=value%26value');
      expect(result).toEqual({ 'key name': 'value&value' });
    });
  });
});

// ============================================
// S3 Client Tests
// ============================================

describe('S3Client', () => {
  beforeEach(() => {
    resetS3Client();
  });

  afterEach(() => {
    resetS3Client();
  });

  describe('constructor', () => {
    it('should create client with default config', () => {
      const client = new S3Client();
      expect(client.getStatus()).toBe('disconnected');
      expect(client.getConfig()).toEqual(DEFAULT_S3_CONFIG);
    });

    it('should merge custom config', () => {
      const client = new S3Client({
        region: 'eu-west-1',
        accessKeyId: 'test-key',
      });
      const config = client.getConfig();
      expect(config.region).toBe('eu-west-1');
      expect(config.accessKeyId).toBe('test-key');
      expect(config.port).toBe(DEFAULT_S3_CONFIG.port);
    });
  });

  describe('getS3Client', () => {
    it('should return singleton instance', () => {
      const client1 = getS3Client();
      const client2 = getS3Client();
      expect(client1).toBe(client2);
    });
  });

  describe('resetS3Client', () => {
    it('should reset singleton instance', () => {
      const client1 = getS3Client();
      resetS3Client();
      const client2 = getS3Client();
      expect(client1).not.toBe(client2);
    });
  });

  describe('event handling', () => {
    it('should register and trigger event listeners', () => {
      const client = new S3Client();
      const listener = vi.fn();
      client.on('connecting', listener);

      // Manually trigger status change for testing
      (client as unknown as { status: string }).status = 'connecting';
      (client as unknown as { emit: (event: string, data?: unknown) => void }).emit('connecting');

      expect(listener).toHaveBeenCalled();
    });

    it('should remove event listeners', () => {
      const client = new S3Client();
      const listener = vi.fn();
      client.on('connecting', listener);
      client.off('connecting', listener);

      (client as unknown as { emit: (event: string, data?: unknown) => void }).emit('connecting');

      expect(listener).not.toHaveBeenCalled();
    });
  });
});

// ============================================
// Presigned URL Generator Tests
// ============================================

describe('PresignedUrlGenerator', () => {
  let mockS3Client: S3Client;
  let mockCommandFactory: S3CommandFactory;
  let generator: PresignedUrlGenerator;

  beforeEach(() => {
    mockCommandFactory = {
      createGetObjectCommand: vi.fn().mockReturnValue({ input: {} }),
      createPutObjectCommand: vi.fn().mockReturnValue({ input: {} }),
      createUploadPartCommand: vi.fn().mockReturnValue({ input: {} }),
      createHeadBucketCommand: vi.fn(),
      createListBucketsCommand: vi.fn(),
      createCreateBucketCommand: vi.fn(),
      createDeleteBucketCommand: vi.fn(),
      createHeadObjectCommand: vi.fn(),
      createDeleteObjectCommand: vi.fn(),
      createDeleteObjectsCommand: vi.fn(),
      createListObjectsV2Command: vi.fn(),
      createCopyObjectCommand: vi.fn(),
      createCreateMultipartUploadCommand: vi.fn(),
      createCompleteMultipartUploadCommand: vi.fn(),
      createAbortMultipartUploadCommand: vi.fn(),
    };

    mockS3Client = {
      getCommandFactory: vi.fn().mockReturnValue(mockCommandFactory),
      getPresignedUrl: vi.fn().mockResolvedValue('https://presigned-url.example.com'),
    } as unknown as S3Client;

    generator = new PresignedUrlGenerator(mockS3Client, 'test-bucket', 3600);
  });

  describe('getDownloadUrl', () => {
    it('should generate download URL', async () => {
      const result = await generator.getDownloadUrl('test-key');
      expect(result.url).toBe('https://presigned-url.example.com');
      expect(result.method).toBe('GET');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should apply tenant prefix when provided', async () => {
      await generator.getDownloadUrl('test-key', { tenantId: 'tenant1' });
      expect(mockCommandFactory.createGetObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'tenants/tenant1/test-key',
        })
      );
    });
  });

  describe('getUploadUrl', () => {
    it('should generate upload URL', async () => {
      const result = await generator.getUploadUrl('test-key');
      expect(result.url).toBe('https://presigned-url.example.com');
      expect(result.method).toBe('PUT');
    });

    it('should include headers for content type', async () => {
      const result = await generator.getUploadUrl('test-key', { contentType: 'image/png' });
      expect(result.headers).toEqual({ 'Content-Type': 'image/png' });
    });
  });

  describe('getBatchDownloadUrls', () => {
    it('should generate multiple download URLs', async () => {
      const result = await generator.getBatchDownloadUrls(['key1', 'key2']);
      expect(result.size).toBe(2);
      expect(result.get('key1')?.url).toBe('https://presigned-url.example.com');
    });
  });

  describe('getBatchUploadUrls', () => {
    it('should generate multiple upload URLs', async () => {
      const result = await generator.getBatchUploadUrls(['key1', 'key2']);
      expect(result.size).toBe(2);
    });
  });

  describe('getMultipartPartUploadUrl', () => {
    it('should generate part upload URL', async () => {
      const result = await generator.getMultipartPartUploadUrl('test-key', 'upload-id', 1);
      expect(result.url).toBe('https://presigned-url.example.com');
      expect(result.method).toBe('PUT');
    });
  });

  describe('isUrlExpired', () => {
    it('should return false for future date', () => {
      const futureDate = new Date(Date.now() + 3600000);
      expect(generator.isUrlExpired(futureDate)).toBe(false);
    });

    it('should return true for past date', () => {
      const pastDate = new Date(Date.now() - 1000);
      expect(generator.isUrlExpired(pastDate)).toBe(true);
    });
  });

  describe('getRemainingTtl', () => {
    it('should return remaining seconds', () => {
      const futureDate = new Date(Date.now() + 3600000);
      const ttl = generator.getRemainingTtl(futureDate);
      expect(ttl).toBeGreaterThan(3500);
      expect(ttl).toBeLessThanOrEqual(3600);
    });

    it('should return 0 for expired URL', () => {
      const pastDate = new Date(Date.now() - 1000);
      expect(generator.getRemainingTtl(pastDate)).toBe(0);
    });
  });
});

// ============================================
// Storage Service Tests
// ============================================

describe('StorageService', () => {
  let service: StorageService;
  let mockS3Client: {
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    getStatus: ReturnType<typeof vi.fn>;
    getCommandFactory: ReturnType<typeof vi.fn>;
    getPresignedUrl: ReturnType<typeof vi.fn>;
    bucketExists: ReturnType<typeof vi.fn>;
    listBuckets: ReturnType<typeof vi.fn>;
    createBucket: ReturnType<typeof vi.fn>;
    deleteBucket: ReturnType<typeof vi.fn>;
    putObject: ReturnType<typeof vi.fn>;
    getObject: ReturnType<typeof vi.fn>;
    headObject: ReturnType<typeof vi.fn>;
    deleteObject: ReturnType<typeof vi.fn>;
    deleteObjects: ReturnType<typeof vi.fn>;
    listObjects: ReturnType<typeof vi.fn>;
    copyObject: ReturnType<typeof vi.fn>;
    createMultipartUpload: ReturnType<typeof vi.fn>;
    uploadPart: ReturnType<typeof vi.fn>;
    completeMultipartUpload: ReturnType<typeof vi.fn>;
    abortMultipartUpload: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    resetStorageService();

    mockS3Client = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      getStatus: vi.fn().mockReturnValue('connected'),
      getCommandFactory: vi.fn().mockReturnValue({
        createGetObjectCommand: vi.fn().mockReturnValue({ input: {} }),
        createPutObjectCommand: vi.fn().mockReturnValue({ input: {} }),
      }),
      getPresignedUrl: vi.fn().mockResolvedValue('https://presigned-url.example.com'),
      bucketExists: vi.fn().mockResolvedValue(true),
      listBuckets: vi.fn().mockResolvedValue([{ name: 'bucket1' }]),
      createBucket: vi.fn().mockResolvedValue(undefined),
      deleteBucket: vi.fn().mockResolvedValue(undefined),
      putObject: vi.fn().mockResolvedValue({ etag: 'test-etag' }),
      getObject: vi.fn().mockResolvedValue({
        body: Readable.from(['test content']),
        metadata: {
          key: 'test-key',
          sizeBytes: 12,
          contentType: 'text/plain',
          lastModified: new Date(),
          etag: 'test-etag',
        },
      }),
      headObject: vi.fn().mockResolvedValue({
        key: 'test-key',
        sizeBytes: 12,
        contentType: 'text/plain',
        lastModified: new Date(),
        etag: 'test-etag',
      }),
      deleteObject: vi.fn().mockResolvedValue(undefined),
      deleteObjects: vi.fn().mockResolvedValue({ deleted: ['key1'], errors: [] }),
      listObjects: vi.fn().mockResolvedValue({
        contents: [{ key: 'file1.txt', sizeBytes: 100 }],
        prefixes: [],
        isTruncated: false,
      }),
      copyObject: vi.fn().mockResolvedValue({ etag: 'copy-etag' }),
      createMultipartUpload: vi.fn().mockResolvedValue('upload-id'),
      uploadPart: vi.fn().mockResolvedValue({ etag: 'part-etag' }),
      completeMultipartUpload: vi.fn().mockResolvedValue({ etag: 'complete-etag' }),
      abortMultipartUpload: vi.fn().mockResolvedValue(undefined),
    };

    // Create service and inject mock
    service = new StorageService();
    (service as unknown as { s3Client: typeof mockS3Client }).s3Client = mockS3Client as unknown as S3Client;
  });

  afterEach(() => {
    resetStorageService();
  });

  describe('constructor', () => {
    it('should create service with default config', () => {
      const svc = new StorageService();
      expect(svc.getStatus()).toBe('disconnected');
    });

    it('should merge custom config', () => {
      const svc = new StorageService({
        defaultBucket: 'custom-bucket',
        provider: 'r2',
      });
      expect(svc).toBeDefined();
    });
  });

  describe('connect and disconnect', () => {
    it('should connect to storage', async () => {
      await service.connect();
      expect(mockS3Client.connect).toHaveBeenCalled();
    });

    it('should disconnect from storage', async () => {
      await service.disconnect();
      expect(mockS3Client.disconnect).toHaveBeenCalled();
    });
  });

  describe('upload', () => {
    it('should upload buffer', async () => {
      const buffer = Buffer.from('test content');
      const result = await service.upload('test-key', buffer);
      expect(mockS3Client.putObject).toHaveBeenCalled();
      expect(result.key).toBe('test-key');
      expect(result.etag).toBe('test-etag');
    });

    it('should upload string', async () => {
      const result = await service.upload('test-key', 'test content');
      expect(mockS3Client.putObject).toHaveBeenCalled();
      expect(result.key).toBe('test-key');
    });

    it('should upload with custom content type', async () => {
      await service.upload('test-key', 'test', { contentType: 'text/plain' });
      expect(mockS3Client.putObject).toHaveBeenCalledWith(
        expect.objectContaining({ contentType: 'text/plain' })
      );
    });

    it('should upload with tenant prefix', async () => {
      await service.upload('test-key', 'test', { tenantId: 'tenant1' });
      expect(mockS3Client.putObject).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'tenants/tenant1/test-key' })
      );
    });

    it('should call onProgress callback', async () => {
      const onProgress = vi.fn();
      await service.upload('test-key', Buffer.from('test'), { onProgress });
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({ percentage: 100 })
      );
    });

    it('should reject invalid keys', async () => {
      await expect(service.upload('../invalid', 'test')).rejects.toThrow();
    });
  });

  describe('download', () => {
    it('should download file as buffer', async () => {
      const result = await service.download('test-key');
      expect(mockS3Client.getObject).toHaveBeenCalled();
      expect(result.data.toString()).toBe('test content');
    });

    it('should download with tenant prefix', async () => {
      await service.download('test-key', { tenantId: 'tenant1' });
      expect(mockS3Client.getObject).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'tenants/tenant1/test-key' })
      );
    });
  });

  describe('downloadStream', () => {
    it('should download file as stream', async () => {
      const result = await service.downloadStream('test-key');
      expect(result.stream).toBeDefined();
      const buffer = await streamToBuffer(result.stream);
      expect(buffer.toString()).toBe('test content');
    });
  });

  describe('delete', () => {
    it('should delete file', async () => {
      await service.delete('test-key');
      expect(mockS3Client.deleteObject).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'test-key' })
      );
    });

    it('should delete with tenant prefix', async () => {
      await service.delete('test-key', { tenantId: 'tenant1' });
      expect(mockS3Client.deleteObject).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'tenants/tenant1/test-key' })
      );
    });
  });

  describe('deleteMany', () => {
    it('should delete multiple files', async () => {
      const result = await service.deleteMany(['key1', 'key2']);
      expect(mockS3Client.deleteObjects).toHaveBeenCalled();
      expect(result.deleted).toContain('key1');
    });
  });

  describe('getMetadata', () => {
    it('should get file metadata', async () => {
      const result = await service.getMetadata('test-key');
      expect(mockS3Client.headObject).toHaveBeenCalled();
      expect(result.key).toBe('test-key');
    });
  });

  describe('exists', () => {
    it('should return true for existing file', async () => {
      const result = await service.exists('test-key');
      expect(result).toBe(true);
    });

    it('should return false for non-existing file', async () => {
      const error = new Error('NotFound');
      (error as { name: string }).name = 'NotFound';
      mockS3Client.headObject.mockRejectedValueOnce(error);
      const result = await service.exists('test-key');
      expect(result).toBe(false);
    });
  });

  describe('list', () => {
    it('should list files', async () => {
      const result = await service.list();
      expect(mockS3Client.listObjects).toHaveBeenCalled();
      expect(result.files).toHaveLength(1);
    });

    it('should list with prefix', async () => {
      await service.list({ prefix: 'folder/' });
      expect(mockS3Client.listObjects).toHaveBeenCalledWith(
        expect.objectContaining({ prefix: 'folder' })
      );
    });

    it('should list with tenant prefix', async () => {
      await service.list({ tenantId: 'tenant1' });
      expect(mockS3Client.listObjects).toHaveBeenCalledWith(
        expect.objectContaining({ prefix: 'tenants/tenant1/' })
      );
    });
  });

  describe('copy', () => {
    it('should copy file', async () => {
      const result = await service.copy('source-key', 'dest-key');
      expect(mockS3Client.copyObject).toHaveBeenCalled();
      expect(result.etag).toBe('copy-etag');
    });
  });

  describe('move', () => {
    it('should move file (copy + delete)', async () => {
      await service.move('source-key', 'dest-key');
      expect(mockS3Client.copyObject).toHaveBeenCalled();
      expect(mockS3Client.deleteObject).toHaveBeenCalled();
    });
  });

  describe('bucket operations', () => {
    it('should check if bucket exists', async () => {
      const result = await service.bucketExists();
      expect(mockS3Client.bucketExists).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should list buckets', async () => {
      const result = await service.listBuckets();
      expect(mockS3Client.listBuckets).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('should create bucket', async () => {
      await service.createBucket('new-bucket');
      expect(mockS3Client.createBucket).toHaveBeenCalledWith('new-bucket', expect.any(String));
    });

    it('should delete bucket', async () => {
      await service.deleteBucket('old-bucket');
      expect(mockS3Client.deleteBucket).toHaveBeenCalledWith('old-bucket');
    });
  });

  describe('presigned URLs', () => {
    it('should get download URL', async () => {
      const mockPresignedGenerator = {
        getDownloadUrl: vi.fn().mockResolvedValue({
          url: 'https://download-url',
          expiresAt: new Date(),
          method: 'GET' as const,
        }),
        getUploadUrl: vi.fn(),
        getBatchDownloadUrls: vi.fn(),
        getBatchUploadUrls: vi.fn(),
        getMultipartPartUploadUrl: vi.fn(),
      };
      (service as unknown as { presignedGenerator: typeof mockPresignedGenerator }).presignedGenerator = mockPresignedGenerator as unknown as PresignedUrlGenerator;

      const result = await service.getDownloadUrl('test-key');
      expect(result.url).toBe('https://download-url');
    });

    it('should get upload URL', async () => {
      const mockPresignedGenerator = {
        getDownloadUrl: vi.fn(),
        getUploadUrl: vi.fn().mockResolvedValue({
          url: 'https://upload-url',
          expiresAt: new Date(),
          method: 'PUT' as const,
        }),
        getBatchDownloadUrls: vi.fn(),
        getBatchUploadUrls: vi.fn(),
        getMultipartPartUploadUrl: vi.fn(),
      };
      (service as unknown as { presignedGenerator: typeof mockPresignedGenerator }).presignedGenerator = mockPresignedGenerator as unknown as PresignedUrlGenerator;

      const result = await service.getUploadUrl('test-key');
      expect(result.url).toBe('https://upload-url');
    });
  });

  describe('multipart upload', () => {
    it('should initiate multipart upload', async () => {
      const uploadId = await service.initiateMultipartUpload('test-key');
      expect(mockS3Client.createMultipartUpload).toHaveBeenCalled();
      expect(uploadId).toBe('upload-id');
    });

    it('should upload part', async () => {
      const result = await service.uploadPart('test-key', 'upload-id', 1, Buffer.from('data'));
      expect(mockS3Client.uploadPart).toHaveBeenCalled();
      expect(result.etag).toBe('part-etag');
    });

    it('should complete multipart upload', async () => {
      const result = await service.completeMultipartUpload(
        'test-key',
        'upload-id',
        [{ partNumber: 1, etag: 'etag1' }]
      );
      expect(mockS3Client.completeMultipartUpload).toHaveBeenCalled();
      expect(result.etag).toBe('complete-etag');
    });

    it('should abort multipart upload', async () => {
      await service.abortMultipartUpload('test-key', 'upload-id');
      expect(mockS3Client.abortMultipartUpload).toHaveBeenCalled();
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status', async () => {
      const result = await service.healthCheck();
      expect(result.healthy).toBe(true);
      expect(result.status).toBe('connected');
      expect(result.bucketAccessible).toBe(true);
    });

    it('should return unhealthy status on error', async () => {
      mockS3Client.bucketExists.mockRejectedValueOnce(new Error('Connection failed'));
      const result = await service.healthCheck();
      expect(result.healthy).toBe(false);
      expect(result.error).toBe('Connection failed');
    });
  });

  describe('event handling', () => {
    it('should register and trigger event listeners', () => {
      const listener = vi.fn();
      service.on('upload:start', listener);

      (service as unknown as { emit: (event: string, data?: Record<string, unknown>) => void }).emit('upload:start', { key: 'test' });

      expect(listener).toHaveBeenCalledWith('upload:start', { key: 'test' });
    });

    it('should remove event listeners', () => {
      const listener = vi.fn();
      service.on('upload:start', listener);
      service.off('upload:start', listener);

      (service as unknown as { emit: (event: string, data?: Record<string, unknown>) => void }).emit('upload:start', { key: 'test' });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('statistics', () => {
    it('should track statistics', async () => {
      await service.upload('test-key', Buffer.from('test'));
      const stats = service.getStats();
      expect(stats.totalOperations).toBeGreaterThan(0);
      expect(stats.successfulOperations).toBeGreaterThan(0);
      expect(stats.bytesUploaded).toBeGreaterThan(0);
    });
  });
});

// ============================================
// TenantStorage Tests
// ============================================

describe('TenantStorage', () => {
  let service: StorageService;
  let tenantStorage: TenantStorage;
  let mockS3Client: {
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    getStatus: ReturnType<typeof vi.fn>;
    getCommandFactory: ReturnType<typeof vi.fn>;
    getPresignedUrl: ReturnType<typeof vi.fn>;
    bucketExists: ReturnType<typeof vi.fn>;
    putObject: ReturnType<typeof vi.fn>;
    getObject: ReturnType<typeof vi.fn>;
    headObject: ReturnType<typeof vi.fn>;
    deleteObject: ReturnType<typeof vi.fn>;
    deleteObjects: ReturnType<typeof vi.fn>;
    listObjects: ReturnType<typeof vi.fn>;
    copyObject: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    resetStorageService();

    mockS3Client = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      getStatus: vi.fn().mockReturnValue('connected'),
      getCommandFactory: vi.fn().mockReturnValue({
        createGetObjectCommand: vi.fn().mockReturnValue({ input: {} }),
        createPutObjectCommand: vi.fn().mockReturnValue({ input: {} }),
      }),
      getPresignedUrl: vi.fn().mockResolvedValue('https://presigned-url.example.com'),
      bucketExists: vi.fn().mockResolvedValue(true),
      putObject: vi.fn().mockResolvedValue({ etag: 'test-etag' }),
      getObject: vi.fn().mockResolvedValue({
        body: Readable.from(['test content']),
        metadata: {
          key: 'tenants/tenant1/test-key',
          sizeBytes: 12,
          contentType: 'text/plain',
          lastModified: new Date(),
          etag: 'test-etag',
        },
      }),
      headObject: vi.fn().mockResolvedValue({
        key: 'tenants/tenant1/test-key',
        sizeBytes: 12,
        contentType: 'text/plain',
        lastModified: new Date(),
        etag: 'test-etag',
      }),
      deleteObject: vi.fn().mockResolvedValue(undefined),
      deleteObjects: vi.fn().mockResolvedValue({ deleted: ['key1'], errors: [] }),
      listObjects: vi.fn().mockResolvedValue({
        contents: [{ key: 'tenants/tenant1/file1.txt', sizeBytes: 100 }],
        prefixes: [],
        isTruncated: false,
      }),
      copyObject: vi.fn().mockResolvedValue({ etag: 'copy-etag' }),
    };

    service = new StorageService();
    (service as unknown as { s3Client: typeof mockS3Client }).s3Client = mockS3Client as unknown as S3Client;
    tenantStorage = new TenantStorage(service, { tenantId: 'tenant1' });
  });

  afterEach(() => {
    resetStorageService();
  });

  describe('getTenantId', () => {
    it('should return tenant ID', () => {
      expect(tenantStorage.getTenantId()).toBe('tenant1');
    });
  });

  describe('upload', () => {
    it('should upload with tenant prefix automatically', async () => {
      await tenantStorage.upload('test-key', Buffer.from('test'));
      expect(mockS3Client.putObject).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'tenants/tenant1/test-key' })
      );
    });
  });

  describe('download', () => {
    it('should download with tenant prefix automatically', async () => {
      await tenantStorage.download('test-key');
      expect(mockS3Client.getObject).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'tenants/tenant1/test-key' })
      );
    });
  });

  describe('delete', () => {
    it('should delete with tenant prefix automatically', async () => {
      await tenantStorage.delete('test-key');
      expect(mockS3Client.deleteObject).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'tenants/tenant1/test-key' })
      );
    });
  });

  describe('list', () => {
    it('should list with tenant prefix automatically', async () => {
      await tenantStorage.list();
      expect(mockS3Client.listObjects).toHaveBeenCalledWith(
        expect.objectContaining({ prefix: 'tenants/tenant1/' })
      );
    });
  });

  describe('exists', () => {
    it('should check existence with tenant prefix', async () => {
      const result = await tenantStorage.exists('test-key');
      expect(mockS3Client.headObject).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'tenants/tenant1/test-key' })
      );
      expect(result).toBe(true);
    });
  });

  describe('copy', () => {
    it('should copy with tenant prefix', async () => {
      await tenantStorage.copy('source', 'dest');
      expect(mockS3Client.copyObject).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceKey: 'tenants/tenant1/source',
          destinationKey: 'tenants/tenant1/dest',
        })
      );
    });
  });

  describe('move', () => {
    it('should move with tenant prefix', async () => {
      await tenantStorage.move('source', 'dest');
      expect(mockS3Client.copyObject).toHaveBeenCalled();
      expect(mockS3Client.deleteObject).toHaveBeenCalled();
    });
  });
});

// ============================================
// Singleton Tests
// ============================================

describe('Singleton Functions', () => {
  beforeEach(() => {
    resetStorageService();
  });

  afterEach(() => {
    resetStorageService();
  });

  describe('getStorageService', () => {
    it('should return singleton instance', () => {
      const service1 = getStorageService();
      const service2 = getStorageService();
      expect(service1).toBe(service2);
    });
  });

  describe('resetStorageService', () => {
    it('should reset singleton instance', () => {
      const service1 = getStorageService();
      resetStorageService();
      const service2 = getStorageService();
      expect(service1).not.toBe(service2);
    });
  });
});

// ============================================
// Additional S3Client Tests for Coverage
// ============================================

describe('S3Client Additional Tests', () => {
  beforeEach(() => {
    resetS3Client();
  });

  afterEach(() => {
    resetS3Client();
  });

  describe('getClient without connection', () => {
    it('should throw error when getting client without connection', () => {
      const client = new S3Client();
      expect(() => client.getClient()).toThrow('S3 client not connected');
    });
  });

  describe('getCommandFactory without connection', () => {
    it('should throw error when getting command factory without connection', () => {
      const client = new S3Client();
      expect(() => client.getCommandFactory()).toThrow('S3 client not connected');
    });
  });

  describe('getPresigner without connection', () => {
    it('should throw error when getting presigner without connection', () => {
      const client = new S3Client();
      expect(() => client.getPresigner()).toThrow('S3 client not connected');
    });
  });

  describe('S3Client with mocked internals', () => {
    let s3Client: S3Client;
    let mockInternalClient: S3ClientInterface;
    let mockCommandFactory: S3CommandFactory;

    beforeEach(() => {
      s3Client = new S3Client({ region: 'us-east-1', accessKeyId: 'test', secretAccessKey: 'test' });

      mockInternalClient = {
        send: vi.fn().mockResolvedValue({}),
        destroy: vi.fn(),
      };

      mockCommandFactory = {
        createHeadBucketCommand: vi.fn().mockReturnValue({}),
        createListBucketsCommand: vi.fn().mockReturnValue({}),
        createCreateBucketCommand: vi.fn().mockReturnValue({}),
        createDeleteBucketCommand: vi.fn().mockReturnValue({}),
        createPutObjectCommand: vi.fn().mockReturnValue({}),
        createGetObjectCommand: vi.fn().mockReturnValue({}),
        createHeadObjectCommand: vi.fn().mockReturnValue({}),
        createDeleteObjectCommand: vi.fn().mockReturnValue({}),
        createDeleteObjectsCommand: vi.fn().mockReturnValue({}),
        createListObjectsV2Command: vi.fn().mockReturnValue({}),
        createCopyObjectCommand: vi.fn().mockReturnValue({}),
        createCreateMultipartUploadCommand: vi.fn().mockReturnValue({}),
        createUploadPartCommand: vi.fn().mockReturnValue({}),
        createCompleteMultipartUploadCommand: vi.fn().mockReturnValue({}),
        createAbortMultipartUploadCommand: vi.fn().mockReturnValue({}),
      };

      // Inject mocks
      (s3Client as unknown as { client: S3ClientInterface }).client = mockInternalClient;
      (s3Client as unknown as { commandFactory: S3CommandFactory }).commandFactory = mockCommandFactory;
      (s3Client as unknown as { status: string }).status = 'connected';
    });

    describe('bucketExists', () => {
      it('should return true when bucket exists', async () => {
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
        const result = await s3Client.bucketExists('test-bucket');
        expect(result).toBe(true);
      });

      it('should return false when bucket not found', async () => {
        const error = new Error('NotFound');
        (error as unknown as { name: string }).name = 'NotFound';
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);
        const result = await s3Client.bucketExists('test-bucket');
        expect(result).toBe(false);
      });

      it('should return false for NoSuchBucket error', async () => {
        const error = new Error('NoSuchBucket');
        (error as unknown as { name: string }).name = 'NoSuchBucket';
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);
        const result = await s3Client.bucketExists('test-bucket');
        expect(result).toBe(false);
      });

      it('should throw for other errors', async () => {
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Other error'));
        await expect(s3Client.bucketExists('test-bucket')).rejects.toThrow('Other error');
      });
    });

    describe('listBuckets', () => {
      it('should return bucket list', async () => {
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          Buckets: [{ Name: 'bucket1', CreationDate: new Date() }],
        });
        const result = await s3Client.listBuckets();
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('bucket1');
      });

      it('should return empty array when no buckets', async () => {
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ Buckets: undefined });
        const result = await s3Client.listBuckets();
        expect(result).toHaveLength(0);
      });

      it('should throw on error', async () => {
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('List failed'));
        await expect(s3Client.listBuckets()).rejects.toThrow('List failed');
      });
    });

    describe('createBucket', () => {
      it('should create bucket', async () => {
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
        await expect(s3Client.createBucket('new-bucket')).resolves.not.toThrow();
      });

      it('should throw on error', async () => {
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Create failed'));
        await expect(s3Client.createBucket('new-bucket')).rejects.toThrow('Create failed');
      });
    });

    describe('deleteBucket', () => {
      it('should delete bucket', async () => {
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
        await expect(s3Client.deleteBucket('old-bucket')).resolves.not.toThrow();
      });

      it('should throw on error', async () => {
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Delete failed'));
        await expect(s3Client.deleteBucket('old-bucket')).rejects.toThrow('Delete failed');
      });
    });

    describe('putObject', () => {
      it('should upload object', async () => {
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ETag: 'etag123', VersionId: 'v1' });
        const result = await s3Client.putObject({ bucket: 'test', key: 'test.txt', body: Buffer.from('test') });
        expect(result.etag).toBe('etag123');
        expect(result.versionId).toBe('v1');
      });

      it('should throw on error', async () => {
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Upload failed'));
        await expect(s3Client.putObject({ bucket: 'test', key: 'test.txt', body: Buffer.from('test') })).rejects.toThrow('Upload failed');
      });
    });

    describe('getObject', () => {
      it('should download object', async () => {
        const mockBody = Readable.from(['test content']);
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          Body: mockBody,
          ContentLength: 12,
          ContentType: 'text/plain',
          LastModified: new Date(),
          ETag: 'etag123',
        });
        const result = await s3Client.getObject({ bucket: 'test', key: 'test.txt' });
        expect(result.metadata.etag).toBe('etag123');
      });

      it('should throw when body is empty', async () => {
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ Body: undefined });
        await expect(s3Client.getObject({ bucket: 'test', key: 'test.txt' })).rejects.toThrow('Empty response body');
      });

      it('should throw on error', async () => {
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Download failed'));
        await expect(s3Client.getObject({ bucket: 'test', key: 'test.txt' })).rejects.toThrow('Download failed');
      });
    });

    describe('headObject', () => {
      it('should get object metadata', async () => {
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          ContentLength: 12,
          ContentType: 'text/plain',
          LastModified: new Date(),
          ETag: 'etag123',
        });
        const result = await s3Client.headObject({ bucket: 'test', key: 'test.txt' });
        expect(result.etag).toBe('etag123');
      });

      it('should throw on error', async () => {
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Head failed'));
        await expect(s3Client.headObject({ bucket: 'test', key: 'test.txt' })).rejects.toThrow('Head failed');
      });
    });

    describe('deleteObject', () => {
      it('should delete object', async () => {
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
        await expect(s3Client.deleteObject({ bucket: 'test', key: 'test.txt' })).resolves.not.toThrow();
      });

      it('should throw on error', async () => {
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Delete failed'));
        await expect(s3Client.deleteObject({ bucket: 'test', key: 'test.txt' })).rejects.toThrow('Delete failed');
      });
    });

    describe('deleteObjects', () => {
      it('should delete multiple objects', async () => {
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          Deleted: [{ Key: 'key1' }],
          Errors: [{ Key: 'key2', Message: 'Error' }],
        });
        const result = await s3Client.deleteObjects({ bucket: 'test', keys: [{ key: 'key1' }, { key: 'key2' }] });
        expect(result.deleted).toContain('key1');
        expect(result.errors).toHaveLength(1);
      });

      it('should handle empty response', async () => {
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
        const result = await s3Client.deleteObjects({ bucket: 'test', keys: [{ key: 'key1' }] });
        expect(result.deleted).toHaveLength(0);
        expect(result.errors).toHaveLength(0);
      });

      it('should throw on error', async () => {
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Delete failed'));
        await expect(s3Client.deleteObjects({ bucket: 'test', keys: [{ key: 'key1' }] })).rejects.toThrow('Delete failed');
      });
    });

    describe('listObjects', () => {
      it('should list objects', async () => {
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          Contents: [{ Key: 'file1.txt', Size: 100, LastModified: new Date(), ETag: 'etag' }],
          CommonPrefixes: [{ Prefix: 'folder/' }],
          IsTruncated: true,
          NextContinuationToken: 'token',
        });
        const result = await s3Client.listObjects({ bucket: 'test' });
        expect(result.contents).toHaveLength(1);
        expect(result.prefixes).toContain('folder/');
        expect(result.isTruncated).toBe(true);
      });

      it('should handle empty response', async () => {
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
        const result = await s3Client.listObjects({ bucket: 'test' });
        expect(result.contents).toHaveLength(0);
      });

      it('should throw on error', async () => {
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('List failed'));
        await expect(s3Client.listObjects({ bucket: 'test' })).rejects.toThrow('List failed');
      });
    });

    describe('copyObject', () => {
      it('should copy object', async () => {
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          CopyObjectResult: { ETag: 'copy-etag' },
          VersionId: 'v1',
        });
        const result = await s3Client.copyObject({
          sourceBucket: 'src',
          sourceKey: 'src.txt',
          destinationBucket: 'dest',
          destinationKey: 'dest.txt',
        });
        expect(result.etag).toBe('copy-etag');
      });

      it('should throw on error', async () => {
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Copy failed'));
        await expect(s3Client.copyObject({
          sourceBucket: 'src',
          sourceKey: 'src.txt',
          destinationBucket: 'dest',
          destinationKey: 'dest.txt',
        })).rejects.toThrow('Copy failed');
      });
    });

    describe('multipart upload', () => {
      it('should create multipart upload', async () => {
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ UploadId: 'upload-123' });
        const result = await s3Client.createMultipartUpload({ bucket: 'test', key: 'large.bin' });
        expect(result).toBe('upload-123');
      });

      it('should throw when no upload ID returned', async () => {
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
        await expect(s3Client.createMultipartUpload({ bucket: 'test', key: 'large.bin' })).rejects.toThrow('No upload ID');
      });

      it('should upload part', async () => {
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ETag: 'part-etag' });
        const result = await s3Client.uploadPart({
          bucket: 'test',
          key: 'large.bin',
          uploadId: 'upload-123',
          partNumber: 1,
          body: Buffer.from('test'),
        });
        expect(result.etag).toBe('part-etag');
      });

      it('should complete multipart upload', async () => {
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ETag: 'complete-etag', VersionId: 'v1' });
        const result = await s3Client.completeMultipartUpload({
          bucket: 'test',
          key: 'large.bin',
          uploadId: 'upload-123',
          parts: [{ partNumber: 1, etag: 'part-etag' }],
        });
        expect(result.etag).toBe('complete-etag');
      });

      it('should abort multipart upload', async () => {
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
        await expect(s3Client.abortMultipartUpload({
          bucket: 'test',
          key: 'large.bin',
          uploadId: 'upload-123',
        })).resolves.not.toThrow();
      });

      it('should throw on upload part error', async () => {
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Part upload failed'));
        await expect(s3Client.uploadPart({
          bucket: 'test',
          key: 'large.bin',
          uploadId: 'upload-123',
          partNumber: 1,
          body: Buffer.from('test'),
        })).rejects.toThrow('Part upload failed');
      });

      it('should throw on complete error', async () => {
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Complete failed'));
        await expect(s3Client.completeMultipartUpload({
          bucket: 'test',
          key: 'large.bin',
          uploadId: 'upload-123',
          parts: [],
        })).rejects.toThrow('Complete failed');
      });

      it('should throw on abort error', async () => {
        (mockInternalClient.send as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Abort failed'));
        await expect(s3Client.abortMultipartUpload({
          bucket: 'test',
          key: 'large.bin',
          uploadId: 'upload-123',
        })).rejects.toThrow('Abort failed');
      });
    });

    describe('disconnect', () => {
      it('should disconnect and clean up', async () => {
        await s3Client.disconnect();
        expect(mockInternalClient.destroy).toHaveBeenCalled();
        expect(s3Client.getStatus()).toBe('disconnected');
      });
    });

    describe('getPresignedUrl', () => {
      it('should get presigned URL', async () => {
        const mockPresigner = {
          presign: vi.fn().mockResolvedValue({ url: 'https://presigned-url' }),
        };
        (s3Client as unknown as { presigner: typeof mockPresigner }).presigner = mockPresigner;

        const url = await s3Client.getPresignedUrl({} as any, 3600);
        expect(url).toBe('https://presigned-url');
      });

      it('should throw on presign error', async () => {
        const mockPresigner = {
          presign: vi.fn().mockRejectedValue(new Error('Presign failed')),
        };
        (s3Client as unknown as { presigner: typeof mockPresigner }).presigner = mockPresigner;

        await expect(s3Client.getPresignedUrl({} as any, 3600)).rejects.toThrow('Presign failed');
      });
    });
  });
});

// ============================================
// Additional StorageService Tests for Coverage
// ============================================

describe('StorageService Additional Coverage Tests', () => {
  let service: StorageService;
  let mockS3Client: {
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    getStatus: ReturnType<typeof vi.fn>;
    getCommandFactory: ReturnType<typeof vi.fn>;
    getPresignedUrl: ReturnType<typeof vi.fn>;
    bucketExists: ReturnType<typeof vi.fn>;
    listBuckets: ReturnType<typeof vi.fn>;
    createBucket: ReturnType<typeof vi.fn>;
    deleteBucket: ReturnType<typeof vi.fn>;
    putObject: ReturnType<typeof vi.fn>;
    getObject: ReturnType<typeof vi.fn>;
    headObject: ReturnType<typeof vi.fn>;
    deleteObject: ReturnType<typeof vi.fn>;
    deleteObjects: ReturnType<typeof vi.fn>;
    listObjects: ReturnType<typeof vi.fn>;
    copyObject: ReturnType<typeof vi.fn>;
    createMultipartUpload: ReturnType<typeof vi.fn>;
    uploadPart: ReturnType<typeof vi.fn>;
    completeMultipartUpload: ReturnType<typeof vi.fn>;
    abortMultipartUpload: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    resetStorageService();

    mockS3Client = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      getStatus: vi.fn().mockReturnValue('connected'),
      getCommandFactory: vi.fn().mockReturnValue({
        createGetObjectCommand: vi.fn().mockReturnValue({ input: {} }),
        createPutObjectCommand: vi.fn().mockReturnValue({ input: {} }),
      }),
      getPresignedUrl: vi.fn().mockResolvedValue('https://presigned-url.example.com'),
      bucketExists: vi.fn().mockResolvedValue(true),
      listBuckets: vi.fn().mockResolvedValue([{ name: 'bucket1' }]),
      createBucket: vi.fn().mockResolvedValue(undefined),
      deleteBucket: vi.fn().mockResolvedValue(undefined),
      putObject: vi.fn().mockResolvedValue({ etag: 'test-etag', versionId: 'v1' }),
      getObject: vi.fn().mockResolvedValue({
        body: Readable.from(['test content']),
        metadata: {
          key: 'test-key',
          sizeBytes: 12,
          contentType: 'text/plain',
          lastModified: new Date(),
          etag: 'test-etag',
        },
      }),
      headObject: vi.fn().mockResolvedValue({
        key: 'test-key',
        sizeBytes: 12,
        contentType: 'text/plain',
        lastModified: new Date(),
        etag: 'test-etag',
      }),
      deleteObject: vi.fn().mockResolvedValue(undefined),
      deleteObjects: vi.fn().mockResolvedValue({ deleted: ['key1'], errors: [] }),
      listObjects: vi.fn().mockResolvedValue({
        contents: [{ key: 'file1.txt', sizeBytes: 100 }],
        prefixes: ['folder/'],
        isTruncated: true,
        continuationToken: 'token123',
      }),
      copyObject: vi.fn().mockResolvedValue({ etag: 'copy-etag', versionId: 'v2' }),
      createMultipartUpload: vi.fn().mockResolvedValue('upload-id'),
      uploadPart: vi.fn().mockResolvedValue({ etag: 'part-etag' }),
      completeMultipartUpload: vi.fn().mockResolvedValue({ etag: 'complete-etag', versionId: 'v3' }),
      abortMultipartUpload: vi.fn().mockResolvedValue(undefined),
    };

    service = new StorageService();
    (service as unknown as { s3Client: typeof mockS3Client }).s3Client = mockS3Client as unknown as S3Client;
  });

  afterEach(() => {
    resetStorageService();
  });

  describe('upload with stream', () => {
    it('should upload stream', async () => {
      const stream = Readable.from(['test content']);
      const result = await service.upload('test-key', stream);
      expect(mockS3Client.putObject).toHaveBeenCalled();
      expect(result.key).toBe('test-key');
    });
  });

  describe('upload with all options', () => {
    it('should upload with all options', async () => {
      const result = await service.upload('test-key', 'test', {
        bucket: 'custom-bucket',
        contentType: 'text/plain',
        metadata: { custom: 'value' },
        storageClass: 'STANDARD_IA',
        cacheControl: 'max-age=3600',
        contentDisposition: 'attachment',
        contentEncoding: 'gzip',
        serverSideEncryption: 'AES256',
        acl: 'private',
        tags: { env: 'test' },
      });
      expect(result.etag).toBe('test-etag');
      expect(result.versionId).toBe('v1');
    });
  });

  describe('upload error handling', () => {
    it('should handle upload errors', async () => {
      mockS3Client.putObject.mockRejectedValueOnce(new Error('Upload failed'));
      await expect(service.upload('test-key', 'test')).rejects.toThrow('Upload failed');
    });
  });

  describe('download with byte range', () => {
    it('should download with byte range', async () => {
      await service.download('test-key', { rangeStart: 0, rangeEnd: 100 });
      expect(mockS3Client.getObject).toHaveBeenCalledWith(
        expect.objectContaining({ range: 'bytes=0-100' })
      );
    });

    it('should download with only start range', async () => {
      await service.download('test-key', { rangeStart: 50 });
      expect(mockS3Client.getObject).toHaveBeenCalledWith(
        expect.objectContaining({ range: 'bytes=50-' })
      );
    });
  });

  describe('download error handling', () => {
    it('should handle download errors', async () => {
      mockS3Client.getObject.mockRejectedValueOnce(new Error('Download failed'));
      await expect(service.download('test-key')).rejects.toThrow('Download failed');
    });
  });

  describe('downloadStream error handling', () => {
    it('should handle downloadStream errors', async () => {
      mockS3Client.getObject.mockRejectedValueOnce(new Error('Stream failed'));
      await expect(service.downloadStream('test-key')).rejects.toThrow('Stream failed');
    });
  });

  describe('delete error handling', () => {
    it('should handle delete errors', async () => {
      mockS3Client.deleteObject.mockRejectedValueOnce(new Error('Delete failed'));
      await expect(service.delete('test-key')).rejects.toThrow('Delete failed');
    });
  });

  describe('deleteMany error handling', () => {
    it('should handle deleteMany errors', async () => {
      mockS3Client.deleteObjects.mockRejectedValueOnce(new Error('Batch delete failed'));
      await expect(service.deleteMany(['key1', 'key2'])).rejects.toThrow('Batch delete failed');
    });
  });

  describe('getMetadata error handling', () => {
    it('should handle getMetadata errors', async () => {
      mockS3Client.headObject.mockRejectedValueOnce(new Error('Metadata fetch failed'));
      await expect(service.getMetadata('test-key')).rejects.toThrow('Metadata fetch failed');
    });
  });

  describe('list with pagination', () => {
    it('should return truncation info', async () => {
      const result = await service.list({ maxKeys: 100 });
      expect(result.isTruncated).toBe(true);
      expect(result.continuationToken).toBe('token123');
      expect(result.prefixes).toContain('folder/');
    });
  });

  describe('list error handling', () => {
    it('should handle list errors', async () => {
      mockS3Client.listObjects.mockRejectedValueOnce(new Error('List failed'));
      await expect(service.list()).rejects.toThrow('List failed');
    });
  });

  describe('copy error handling', () => {
    it('should handle copy errors', async () => {
      mockS3Client.copyObject.mockRejectedValueOnce(new Error('Copy failed'));
      await expect(service.copy('source', 'dest')).rejects.toThrow('Copy failed');
    });
  });

  describe('copy with options', () => {
    it('should copy with all options', async () => {
      await service.copy('source', 'dest', {
        sourceBucket: 'source-bucket',
        destinationBucket: 'dest-bucket',
        contentType: 'text/plain',
        metadata: { key: 'value' },
        metadataDirective: 'REPLACE',
        acl: 'public-read',
      });
      expect(mockS3Client.copyObject).toHaveBeenCalled();
    });
  });

  describe('exists with ForgeError', () => {
    it('should return false for NotFound in ForgeError message', async () => {
      const { ForgeError } = await import('@forge/errors');
      const error = new ForgeError({
        code: 'INT_9005' as any,
        message: 'NoSuchKey: Key not found',
        statusCode: 404,
      });
      mockS3Client.headObject.mockRejectedValueOnce(error);
      const result = await service.exists('test-key');
      expect(result).toBe(false);
    });
  });

  describe('disconnect with abort pending uploads', () => {
    it('should abort pending uploads on disconnect', async () => {
      // Start a multipart upload
      await service.initiateMultipartUpload('test-key');

      // Disconnect with abort
      await service.disconnect({ timeoutMs: 1000, abortPendingUploads: true });

      expect(mockS3Client.abortMultipartUpload).toHaveBeenCalled();
      expect(mockS3Client.disconnect).toHaveBeenCalled();
    });
  });
});

// ============================================
// Additional TenantStorage Tests for Coverage
// ============================================

describe('TenantStorage Additional Tests', () => {
  let service: StorageService;
  let tenantStorage: TenantStorage;
  let mockS3Client: {
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    getStatus: ReturnType<typeof vi.fn>;
    getCommandFactory: ReturnType<typeof vi.fn>;
    getPresignedUrl: ReturnType<typeof vi.fn>;
    bucketExists: ReturnType<typeof vi.fn>;
    putObject: ReturnType<typeof vi.fn>;
    getObject: ReturnType<typeof vi.fn>;
    headObject: ReturnType<typeof vi.fn>;
    deleteObject: ReturnType<typeof vi.fn>;
    deleteObjects: ReturnType<typeof vi.fn>;
    listObjects: ReturnType<typeof vi.fn>;
    copyObject: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    resetStorageService();

    mockS3Client = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      getStatus: vi.fn().mockReturnValue('connected'),
      getCommandFactory: vi.fn().mockReturnValue({
        createGetObjectCommand: vi.fn().mockReturnValue({ input: {} }),
        createPutObjectCommand: vi.fn().mockReturnValue({ input: {} }),
      }),
      getPresignedUrl: vi.fn().mockResolvedValue('https://presigned-url.example.com'),
      bucketExists: vi.fn().mockResolvedValue(true),
      putObject: vi.fn().mockResolvedValue({ etag: 'test-etag' }),
      getObject: vi.fn().mockResolvedValue({
        body: Readable.from(['test content']),
        metadata: {
          key: 'tenants/tenant1/test-key',
          sizeBytes: 12,
          contentType: 'text/plain',
          lastModified: new Date(),
          etag: 'test-etag',
        },
      }),
      headObject: vi.fn().mockResolvedValue({
        key: 'tenants/tenant1/test-key',
        sizeBytes: 12,
        contentType: 'text/plain',
        lastModified: new Date(),
        etag: 'test-etag',
      }),
      deleteObject: vi.fn().mockResolvedValue(undefined),
      deleteObjects: vi.fn().mockResolvedValue({ deleted: ['key1'], errors: [] }),
      listObjects: vi.fn().mockResolvedValue({
        contents: [{ key: 'tenants/tenant1/file1.txt', sizeBytes: 100 }],
        prefixes: [],
        isTruncated: false,
      }),
      copyObject: vi.fn().mockResolvedValue({ etag: 'copy-etag' }),
    };

    service = new StorageService();
    (service as unknown as { s3Client: typeof mockS3Client }).s3Client = mockS3Client as unknown as S3Client;
    tenantStorage = new TenantStorage(service, { tenantId: 'tenant1' });
  });

  afterEach(() => {
    resetStorageService();
  });

  describe('getMetadata', () => {
    it('should get metadata with tenant prefix', async () => {
      await tenantStorage.getMetadata('test-key');
      expect(mockS3Client.headObject).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'tenants/tenant1/test-key' })
      );
    });
  });

  describe('deleteMany', () => {
    it('should delete many with tenant prefix', async () => {
      await tenantStorage.deleteMany(['key1', 'key2']);
      expect(mockS3Client.deleteObjects).toHaveBeenCalled();
    });
  });

  describe('getDownloadUrl', () => {
    it('should get download URL with tenant prefix', async () => {
      const mockPresignedGenerator = {
        getDownloadUrl: vi.fn().mockResolvedValue({
          url: 'https://download-url',
          expiresAt: new Date(),
          method: 'GET' as const,
        }),
      };
      (service as unknown as { presignedGenerator: typeof mockPresignedGenerator }).presignedGenerator = mockPresignedGenerator as any;

      await tenantStorage.getDownloadUrl('test-key');
      expect(mockPresignedGenerator.getDownloadUrl).toHaveBeenCalledWith('test-key', { tenantId: 'tenant1' });
    });
  });

  describe('getUploadUrl', () => {
    it('should get upload URL with tenant prefix', async () => {
      const mockPresignedGenerator = {
        getUploadUrl: vi.fn().mockResolvedValue({
          url: 'https://upload-url',
          expiresAt: new Date(),
          method: 'PUT' as const,
        }),
      };
      (service as unknown as { presignedGenerator: typeof mockPresignedGenerator }).presignedGenerator = mockPresignedGenerator as any;

      await tenantStorage.getUploadUrl('test-key');
      expect(mockPresignedGenerator.getUploadUrl).toHaveBeenCalledWith('test-key', { tenantId: 'tenant1' });
    });
  });

  describe('downloadStream', () => {
    it('should download stream with tenant prefix', async () => {
      await tenantStorage.downloadStream('test-key');
      expect(mockS3Client.getObject).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'tenants/tenant1/test-key' })
      );
    });
  });
});

// ============================================
// PresignedUrlGenerator Error Tests
// ============================================

describe('PresignedUrlGenerator Error Tests', () => {
  let mockS3Client: S3Client;
  let mockCommandFactory: S3CommandFactory;
  let generator: PresignedUrlGenerator;

  beforeEach(() => {
    mockCommandFactory = {
      createGetObjectCommand: vi.fn().mockReturnValue({ input: {} }),
      createPutObjectCommand: vi.fn().mockReturnValue({ input: {} }),
      createUploadPartCommand: vi.fn().mockReturnValue({ input: {} }),
      createHeadBucketCommand: vi.fn(),
      createListBucketsCommand: vi.fn(),
      createCreateBucketCommand: vi.fn(),
      createDeleteBucketCommand: vi.fn(),
      createHeadObjectCommand: vi.fn(),
      createDeleteObjectCommand: vi.fn(),
      createDeleteObjectsCommand: vi.fn(),
      createListObjectsV2Command: vi.fn(),
      createCopyObjectCommand: vi.fn(),
      createCreateMultipartUploadCommand: vi.fn(),
      createCompleteMultipartUploadCommand: vi.fn(),
      createAbortMultipartUploadCommand: vi.fn(),
    };

    mockS3Client = {
      getCommandFactory: vi.fn().mockReturnValue(mockCommandFactory),
      getPresignedUrl: vi.fn().mockRejectedValue(new Error('Presign failed')),
    } as unknown as S3Client;

    generator = new PresignedUrlGenerator(mockS3Client, 'test-bucket', 3600);
  });

  describe('getDownloadUrl error', () => {
    it('should wrap errors in ForgeError', async () => {
      await expect(generator.getDownloadUrl('test-key')).rejects.toThrow('Presign failed');
    });
  });

  describe('getUploadUrl error', () => {
    it('should wrap errors in ForgeError', async () => {
      await expect(generator.getUploadUrl('test-key')).rejects.toThrow('Presign failed');
    });
  });

  describe('getMultipartPartUploadUrl error', () => {
    it('should wrap errors in ForgeError', async () => {
      await expect(generator.getMultipartPartUploadUrl('test-key', 'upload-id', 1)).rejects.toThrow('Presign failed');
    });
  });

  describe('batch URL errors', () => {
    it('should include error in batch download results', async () => {
      const results = await generator.getBatchDownloadUrls(['key1', 'key2']);
      expect(results.get('key1')?.url).toBe('');
      expect(results.get('key1')?.headers?.error).toContain('Presign failed');
    });

    it('should include error in batch upload results', async () => {
      const results = await generator.getBatchUploadUrls(['key1', 'key2']);
      expect(results.get('key1')?.url).toBe('');
      expect(results.get('key1')?.headers?.error).toContain('Presign failed');
    });
  });
});
