/**
 * @package @forge/cache
 * @description Serialization utilities for cache values
 */

import { SerializedValue } from './cache.types';

/** Current serialization version */
const SERIALIZATION_VERSION = 1;

/**
 * Detect the type of a value for serialization
 */
export function detectValueType(value: unknown): SerializedValue['type'] {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'string') {
    return 'string';
  }
  if (typeof value === 'number') {
    return 'number';
  }
  if (typeof value === 'boolean') {
    return 'boolean';
  }
  if (value instanceof Date) {
    return 'date';
  }
  if (Buffer.isBuffer(value)) {
    return 'buffer';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  if (typeof value === 'object') {
    return 'object';
  }
  return 'object';
}

/**
 * Serialize a value for storage in Redis
 */
export function serialize(value: unknown, compress = false): SerializedValue {
  const type = detectValueType(value);
  let data: string;

  switch (type) {
    case 'string':
      data = value as string;
      break;
    case 'number':
      data = String(value);
      break;
    case 'boolean':
      data = String(value);
      break;
    case 'null':
      data = 'null';
      break;
    case 'undefined':
      data = 'undefined';
      break;
    case 'date':
      data = (value as Date).toISOString();
      break;
    case 'buffer':
      data = (value as Buffer).toString('base64');
      break;
    case 'array':
    case 'object':
      data = JSON.stringify(value, replacer);
      break;
    default:
      data = JSON.stringify(value, replacer);
  }

  return {
    data,
    type,
    compressed: compress,
    version: SERIALIZATION_VERSION,
  };
}

/**
 * Deserialize a value from Redis storage
 */
export function deserialize<T = unknown>(serialized: SerializedValue): T {
  const { data, type } = serialized;

  switch (type) {
    case 'string':
      return data as T;
    case 'number':
      return Number(data) as T;
    case 'boolean':
      return (data === 'true') as T;
    case 'null':
      return null as T;
    case 'undefined':
      return undefined as T;
    case 'date':
      return new Date(data) as T;
    case 'buffer':
      return Buffer.from(data, 'base64') as T;
    case 'array':
    case 'object':
      return JSON.parse(data, reviver) as T;
    default:
      return JSON.parse(data, reviver) as T;
  }
}

/**
 * Encode a SerializedValue to a string for Redis storage
 */
export function encode(serialized: SerializedValue): string {
  return JSON.stringify(serialized);
}

/**
 * Decode a string from Redis storage to SerializedValue
 */
export function decode(encoded: string): SerializedValue {
  try {
    const parsed = JSON.parse(encoded);

    // Handle legacy format (direct value storage)
    if (!('version' in parsed) || !('type' in parsed) || !('data' in parsed)) {
      return {
        data: encoded,
        type: detectValueType(parsed),
        compressed: false,
        version: SERIALIZATION_VERSION,
      };
    }

    return parsed as SerializedValue;
  } catch {
    // If parsing fails, treat as raw string
    return {
      data: encoded,
      type: 'string',
      compressed: false,
      version: SERIALIZATION_VERSION,
    };
  }
}

/**
 * JSON replacer for handling special types
 * Note: Uses `this` to access the original object because Date.prototype.toJSON
 * converts Date to string before the replacer sees it
 */
function replacer(this: Record<string, unknown>, key: string, value: unknown): unknown {
  // Access the original value from the parent object
  const originalValue = key === '' ? value : this[key];

  if (originalValue instanceof Date) {
    return { __type: 'Date', __value: originalValue.toISOString() };
  }
  if (Buffer.isBuffer(originalValue)) {
    return { __type: 'Buffer', __value: originalValue.toString('base64') };
  }
  if (originalValue instanceof Set) {
    return { __type: 'Set', __value: Array.from(originalValue) };
  }
  if (originalValue instanceof Map) {
    return { __type: 'Map', __value: Array.from(originalValue.entries()) };
  }
  if (typeof originalValue === 'bigint') {
    return { __type: 'BigInt', __value: originalValue.toString() };
  }
  return value;
}

/**
 * JSON reviver for handling special types
 */
function reviver(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && '__type' in value && '__value' in value) {
    const typedValue = value as { __type: string; __value: unknown };
    switch (typedValue.__type) {
      case 'Date':
        return new Date(typedValue.__value as string);
      case 'Buffer':
        return Buffer.from(typedValue.__value as string, 'base64');
      case 'Set':
        return new Set(typedValue.__value as unknown[]);
      case 'Map':
        return new Map(typedValue.__value as [unknown, unknown][]);
      case 'BigInt':
        return BigInt(typedValue.__value as string);
    }
  }
  return value;
}

/**
 * Calculate approximate size of a value in bytes
 */
export function calculateSize(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'string') {
    return Buffer.byteLength(value, 'utf8');
  }
  if (typeof value === 'number') {
    return 8;
  }
  if (typeof value === 'boolean') {
    return 4;
  }
  if (Buffer.isBuffer(value)) {
    return value.length;
  }
  if (value instanceof Date) {
    return 24;
  }
  // For objects and arrays, serialize and measure
  try {
    const serialized = JSON.stringify(value);
    return Buffer.byteLength(serialized, 'utf8');
  } catch {
    return 0;
  }
}

/**
 * Build a namespaced key
 */
export function buildKey(prefix: string, namespace: string | undefined, key: string): string {
  const parts = [prefix];
  if (namespace) {
    parts.push(namespace);
  }
  parts.push(key);
  return parts.join('');
}

/**
 * Extract the original key from a namespaced key
 */
export function extractKey(prefix: string, namespace: string | undefined, fullKey: string): string {
  let prefixToRemove = prefix;
  if (namespace) {
    prefixToRemove += namespace;
  }
  if (fullKey.startsWith(prefixToRemove)) {
    return fullKey.slice(prefixToRemove.length);
  }
  return fullKey;
}

/**
 * Validate a cache key
 */
export function validateKey(key: string): void {
  if (!key || typeof key !== 'string') {
    throw new Error('Cache key must be a non-empty string');
  }
  if (key.length > 512) {
    throw new Error('Cache key must be 512 characters or less');
  }
  // Redis keys can contain any bytes, but we restrict to printable characters
  if (!/^[\x20-\x7E]+$/.test(key)) {
    throw new Error('Cache key must contain only printable ASCII characters');
  }
}

/**
 * Generate a unique lock token
 */
export function generateLockToken(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${random}`;
}
