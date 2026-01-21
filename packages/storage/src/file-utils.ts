/**
 * @package @forge/storage
 * @description File utilities and helpers for storage operations
 */

import { Readable } from 'stream';

/**
 * MIME type mappings by file extension
 */
const MIME_TYPES: Record<string, string> = {
  // Text
  '.txt': 'text/plain',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.csv': 'text/csv',
  '.xml': 'text/xml',
  '.md': 'text/markdown',

  // JavaScript/TypeScript
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.cjs': 'application/javascript',
  '.ts': 'application/typescript',
  '.tsx': 'application/typescript',
  '.jsx': 'application/javascript',

  // JSON/YAML
  '.json': 'application/json',
  '.yaml': 'application/x-yaml',
  '.yml': 'application/x-yaml',

  // Images
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.avif': 'image/avif',

  // Audio
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',

  // Video
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.wmv': 'video/x-ms-wmv',

  // Documents
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.odp': 'application/vnd.oasis.opendocument.presentation',
  '.rtf': 'application/rtf',

  // Archives
  '.zip': 'application/zip',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  '.bz2': 'application/x-bzip2',
  '.7z': 'application/x-7z-compressed',
  '.rar': 'application/vnd.rar',

  // Fonts
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',

  // Other
  '.wasm': 'application/wasm',
  '.map': 'application/json',
};

/**
 * Magic byte signatures for file type detection
 */
const MAGIC_SIGNATURES: Array<{ bytes: number[]; mimeType: string; offset?: number }> = [
  // Images
  { bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], mimeType: 'image/png' },
  { bytes: [0xFF, 0xD8, 0xFF], mimeType: 'image/jpeg' },
  { bytes: [0x47, 0x49, 0x46, 0x38], mimeType: 'image/gif' },
  { bytes: [0x52, 0x49, 0x46, 0x46], mimeType: 'image/webp', offset: 8 }, // Check WEBP at offset 8
  { bytes: [0x00, 0x00, 0x01, 0x00], mimeType: 'image/x-icon' },

  // Documents
  { bytes: [0x25, 0x50, 0x44, 0x46], mimeType: 'application/pdf' },
  { bytes: [0x50, 0x4B, 0x03, 0x04], mimeType: 'application/zip' }, // Also docx, xlsx, pptx

  // Archives
  { bytes: [0x1F, 0x8B], mimeType: 'application/gzip' },
  { bytes: [0x42, 0x5A, 0x68], mimeType: 'application/x-bzip2' },
  { bytes: [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C], mimeType: 'application/x-7z-compressed' },
  { bytes: [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07], mimeType: 'application/vnd.rar' },

  // Audio/Video
  { bytes: [0x49, 0x44, 0x33], mimeType: 'audio/mpeg' }, // ID3v2
  { bytes: [0xFF, 0xFB], mimeType: 'audio/mpeg' }, // MP3 frame sync
  { bytes: [0xFF, 0xFA], mimeType: 'audio/mpeg' }, // MP3 frame sync
  { bytes: [0x4F, 0x67, 0x67, 0x53], mimeType: 'audio/ogg' },
  { bytes: [0x52, 0x49, 0x46, 0x46], mimeType: 'audio/wav' }, // Also needs AVI check
  { bytes: [0x1A, 0x45, 0xDF, 0xA3], mimeType: 'video/webm' },

  // WebAssembly
  { bytes: [0x00, 0x61, 0x73, 0x6D], mimeType: 'application/wasm' },
];

/**
 * Get MIME type from file extension
 */
export function getMimeTypeFromExtension(filename: string): string {
  const ext = getFileExtension(filename).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Get MIME type from buffer content using magic bytes
 */
export function getMimeTypeFromBuffer(buffer: Buffer): string | null {
  for (const sig of MAGIC_SIGNATURES) {
    const offset = sig.offset || 0;
    if (buffer.length >= sig.bytes.length + offset) {
      const match = sig.bytes.every((byte, index) => buffer[offset + index] === byte);
      if (match) {
        return sig.mimeType;
      }
    }
  }
  return null;
}

/**
 * Detect MIME type from filename and optional buffer content
 */
export function detectMimeType(filename: string, buffer?: Buffer): string {
  // Try magic bytes first if buffer provided
  if (buffer && buffer.length > 0) {
    const magicType = getMimeTypeFromBuffer(buffer);
    if (magicType) {
      return magicType;
    }
  }

  // Fall back to extension
  return getMimeTypeFromExtension(filename);
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0) {
    return '';
  }
  return filename.slice(lastDot);
}

/**
 * Get filename without extension
 */
export function getBaseName(filename: string): string {
  const lastSlash = Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\'));
  const name = lastSlash === -1 ? filename : filename.slice(lastSlash + 1);
  const lastDot = name.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0) {
    return name;
  }
  return name.slice(0, lastDot);
}

/**
 * Get directory path from full path
 */
export function getDirectory(path: string): string {
  const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  if (lastSlash === -1) {
    return '';
  }
  return path.slice(0, lastSlash);
}

/**
 * Normalize storage key (path)
 */
export function normalizeKey(key: string): string {
  // Remove leading/trailing slashes
  let normalized = key.replace(/^\/+|\/+$/g, '');
  // Replace multiple slashes with single slash
  normalized = normalized.replace(/\/+/g, '/');
  // Replace backslashes with forward slashes
  normalized = normalized.replace(/\\/g, '/');
  return normalized;
}

/**
 * Build tenant-prefixed key
 */
export function buildTenantKey(tenantId: string, key: string): string {
  const normalizedKey = normalizeKey(key);
  const normalizedTenant = normalizeKey(tenantId);
  return `tenants/${normalizedTenant}/${normalizedKey}`;
}

/**
 * Extract key from tenant-prefixed key
 */
export function extractKeyFromTenantKey(tenantKey: string, tenantId: string): string {
  const prefix = `tenants/${normalizeKey(tenantId)}/`;
  if (tenantKey.startsWith(prefix)) {
    return tenantKey.slice(prefix.length);
  }
  return tenantKey;
}

/**
 * Validate storage key
 */
export function validateKey(key: string): { valid: boolean; error?: string } {
  if (!key || key.length === 0) {
    return { valid: false, error: 'Key cannot be empty' };
  }

  if (key.length > 1024) {
    return { valid: false, error: 'Key cannot exceed 1024 characters' };
  }

  // Check for invalid characters
  const invalidChars = /[\x00-\x1F\x7F]/;
  if (invalidChars.test(key)) {
    return { valid: false, error: 'Key contains invalid control characters' };
  }

  // Check for path traversal
  if (key.includes('..')) {
    return { valid: false, error: 'Key cannot contain path traversal (..)' };
  }

  return { valid: true };
}

/**
 * Generate a unique key with timestamp and random suffix
 */
export function generateUniqueKey(prefix: string, extension?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  const ext = extension ? `.${extension.replace(/^\./, '')}` : '';
  return `${normalizeKey(prefix)}/${timestamp}-${random}${ext}`;
}

/**
 * Calculate file size from various sources
 */
export function calculateSize(data: Buffer | string | Readable): number | null {
  if (Buffer.isBuffer(data)) {
    return data.length;
  }
  if (typeof data === 'string') {
    return Buffer.byteLength(data, 'utf-8');
  }
  // For streams, we can't determine size without consuming it
  return null;
}

/**
 * Format file size to human-readable string
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

/**
 * Parse file size string to bytes
 */
export function parseFileSize(sizeStr: string): number | null {
  const match = sizeStr.trim().match(/^([\d.]+)\s*(B|KB|MB|GB|TB|PB)?$/i);
  if (!match) {
    return null;
  }

  const value = parseFloat(match[1]);
  const unit = (match[2] || 'B').toUpperCase();

  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
    PB: 1024 * 1024 * 1024 * 1024 * 1024,
  };

  return Math.floor(value * (multipliers[unit] || 1));
}

/**
 * Check if MIME type is an image
 */
export function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * Check if MIME type is a video
 */
export function isVideoMimeType(mimeType: string): boolean {
  return mimeType.startsWith('video/');
}

/**
 * Check if MIME type is audio
 */
export function isAudioMimeType(mimeType: string): boolean {
  return mimeType.startsWith('audio/');
}

/**
 * Check if MIME type is text
 */
export function isTextMimeType(mimeType: string): boolean {
  return (
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    mimeType === 'application/javascript' ||
    mimeType === 'application/typescript' ||
    mimeType === 'application/xml' ||
    mimeType === 'application/x-yaml'
  );
}

/**
 * Split buffer into chunks for multipart upload
 */
export function* splitBuffer(buffer: Buffer, chunkSize: number): Generator<{ chunk: Buffer; partNumber: number }> {
  const totalChunks = Math.ceil(buffer.length / chunkSize);
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, buffer.length);
    yield { chunk: buffer.slice(start, end), partNumber: i + 1 };
  }
}

/**
 * Collect stream into buffer
 */
export async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Create a readable stream from a buffer
 */
export function bufferToStream(buffer: Buffer): Readable {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

/**
 * Get content disposition header value
 */
export function getContentDisposition(filename: string, inline: boolean = false): string {
  const disposition = inline ? 'inline' : 'attachment';
  // Encode filename for UTF-8 compatibility
  const encodedFilename = encodeURIComponent(filename);
  return `${disposition}; filename="${filename}"; filename*=UTF-8''${encodedFilename}`;
}

/**
 * Build tags string from object
 */
export function buildTagsString(tags: Record<string, string>): string {
  return Object.entries(tags)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

/**
 * Parse tags string to object
 */
export function parseTagsString(tagsString: string): Record<string, string> {
  const tags: Record<string, string> = {};
  const pairs = tagsString.split('&');
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key) {
      tags[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
    }
  }
  return tags;
}
