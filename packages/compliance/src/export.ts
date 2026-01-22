/**
 * @package @forge/compliance
 * @description Audit data export functionality
 */

import { createGzip } from 'zlib';
import { ErrorCode, ForgeError } from '@forge/errors';
import {
  AuditEvent,
  AuditQueryFilters,
  ExportOptions,
  ExportResult,
} from './compliance.types';
import { AuditLogManager } from './audit';

/**
 * Audit data exporter
 */
export class AuditExporter {
  private auditManager: AuditLogManager;

  constructor(auditManager: AuditLogManager) {
    this.auditManager = auditManager;
  }

  /**
   * Export audit events to a buffer
   */
  async export(
    filters: AuditQueryFilters,
    options: ExportOptions
  ): Promise<{ data: Buffer; result: ExportResult }> {
    const startTime = Date.now();
    const exportId = this.generateId();

    // Query events
    const queryResult = this.auditManager.query(filters, {
      limit: 100000, // Large limit for export
      includeExpired: true,
    });

    const events = queryResult.events;

    if (events.length === 0) {
      throw new ForgeError({
        code: ErrorCode.NOT_FOUND,
        message: 'No events found matching the filters',
        statusCode: 404,
      });
    }

    // Format data
    let data: Buffer;
    switch (options.format) {
      case 'JSON':
        data = this.formatAsJson(events, options);
        break;
      case 'CSV':
        data = this.formatAsCsv(events, options);
        break;
      case 'NDJSON':
        data = this.formatAsNdjson(events, options);
        break;
      default:
        throw new ForgeError({
          code: ErrorCode.VALIDATION_FAILED,
          message: `Unsupported export format: ${options.format}`,
          statusCode: 400,
        });
    }

    // Verify integrity if requested
    let integrityVerified: boolean | undefined;
    if (options.includeIntegrity && filters.tenantId) {
      const integrityResult = this.auditManager.verifyIntegrity(filters.tenantId);
      integrityVerified = integrityResult.valid;
    }

    // Compress if requested
    if (options.compress) {
      data = await this.compressData(data);
    }

    const result: ExportResult = {
      id: exportId,
      eventCount: events.length,
      sizeBytes: data.length,
      format: options.format,
      durationMs: Date.now() - startTime,
      integrityVerified,
      createdAt: new Date(),
    };

    return { data, result };
  }

  /**
   * Export events as a stream (for large exports)
   */
  async *exportStream(
    filters: AuditQueryFilters,
    options: ExportOptions,
    batchSize: number = 1000
  ): AsyncGenerator<Buffer, ExportResult, undefined> {
    const startTime = Date.now();
    const exportId = this.generateId();
    let totalEvents = 0;
    let totalBytes = 0;
    let offset = 0;
    let hasMore = true;

    // Write header for CSV
    if (options.format === 'CSV') {
      const header = this.getCsvHeader(options.fields);
      yield Buffer.from(header + '\n');
      totalBytes += header.length + 1;
    }

    // Write opening bracket for JSON array
    if (options.format === 'JSON') {
      const opening = options.prettyPrint ? '[\n' : '[';
      yield Buffer.from(opening);
      totalBytes += opening.length;
    }

    let isFirst = true;

    while (hasMore) {
      const queryResult = this.auditManager.query(filters, {
        limit: batchSize,
        offset,
        includeExpired: true,
      });

      for (const event of queryResult.events) {
        let chunk: Buffer;

        switch (options.format) {
          case 'JSON':
            const prefix = isFirst ? '' : ',';
            const jsonStr = options.prettyPrint
              ? JSON.stringify(this.filterFields(event, options.fields), null, 2)
              : JSON.stringify(this.filterFields(event, options.fields));
            chunk = Buffer.from(prefix + (options.prettyPrint ? '\n' : '') + jsonStr);
            isFirst = false;
            break;
          case 'CSV':
            chunk = Buffer.from(this.eventToCsvRow(event, options) + '\n');
            break;
          case 'NDJSON':
            chunk = Buffer.from(JSON.stringify(this.filterFields(event, options.fields)) + '\n');
            break;
          default:
            throw new ForgeError({
              code: ErrorCode.VALIDATION_FAILED,
              message: `Unsupported export format: ${options.format}`,
              statusCode: 400,
            });
        }

        yield chunk;
        totalBytes += chunk.length;
        totalEvents++;
      }

      offset += batchSize;
      hasMore = queryResult.hasMore;
    }

    // Write closing bracket for JSON array
    if (options.format === 'JSON') {
      const closing = options.prettyPrint ? '\n]' : ']';
      yield Buffer.from(closing);
      totalBytes += closing.length;
    }

    return {
      id: exportId,
      eventCount: totalEvents,
      sizeBytes: totalBytes,
      format: options.format,
      durationMs: Date.now() - startTime,
      createdAt: new Date(),
    };
  }

  /**
   * Format events as JSON
   */
  private formatAsJson(events: AuditEvent[], options: ExportOptions): Buffer {
    const filteredEvents = events.map((e) => this.filterFields(e, options.fields));

    const jsonStr = options.prettyPrint
      ? JSON.stringify(filteredEvents, null, 2)
      : JSON.stringify(filteredEvents);

    return Buffer.from(jsonStr);
  }

  /**
   * Format events as CSV
   */
  private formatAsCsv(events: AuditEvent[], options: ExportOptions): Buffer {
    const delimiter = options.csvDelimiter || ',';
    const rows: string[] = [];

    // Header row
    rows.push(this.getCsvHeader(options.fields, delimiter));

    // Data rows
    for (const event of events) {
      rows.push(this.eventToCsvRow(event, options, delimiter));
    }

    return Buffer.from(rows.join('\n'));
  }

  /**
   * Format events as NDJSON (Newline Delimited JSON)
   */
  private formatAsNdjson(events: AuditEvent[], options: ExportOptions): Buffer {
    const lines = events.map((event) =>
      JSON.stringify(this.filterFields(event, options.fields))
    );
    return Buffer.from(lines.join('\n'));
  }

  /**
   * Get CSV header row
   */
  private getCsvHeader(fields?: string[], delimiter: string = ','): string {
    const defaultFields = [
      'id',
      'type',
      'subtype',
      'severity',
      'outcome',
      'timestamp',
      'tenantId',
      'actorId',
      'actorType',
      'actorName',
      'actorEmail',
      'actorIpAddress',
      'targetId',
      'targetType',
      'targetName',
      'action',
      'message',
      'hash',
    ];

    const headerFields = fields || defaultFields;
    return headerFields.map((f) => this.escapeCsvValue(f)).join(delimiter);
  }

  /**
   * Convert event to CSV row
   */
  private eventToCsvRow(
    event: AuditEvent,
    options: ExportOptions,
    delimiter: string = ','
  ): string {
    const dateFormat = options.dateFormat || 'ISO';
    const formatDate = (date: Date) => {
      if (dateFormat === 'ISO') {
        return date.toISOString();
      }
      return date.toLocaleString();
    };

    const defaultValues: Record<string, string> = {
      id: event.id,
      type: event.type,
      subtype: event.subtype || '',
      severity: event.severity,
      outcome: event.outcome,
      timestamp: formatDate(event.timestamp),
      tenantId: event.tenantId,
      actorId: event.actor.id,
      actorType: event.actor.type,
      actorName: event.actor.name || '',
      actorEmail: event.actor.email || '',
      actorIpAddress: event.actor.ipAddress || '',
      targetId: event.target?.id || '',
      targetType: event.target?.type || '',
      targetName: event.target?.name || '',
      action: event.action,
      message: event.message || '',
      hash: event.hash,
    };

    const fields = options.fields || Object.keys(defaultValues);
    return fields
      .map((field) => this.escapeCsvValue(defaultValues[field] || ''))
      .join(delimiter);
  }

  /**
   * Escape CSV value
   */
  private escapeCsvValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Filter fields from event
   */
  private filterFields(
    event: AuditEvent,
    fields?: string[]
  ): Partial<AuditEvent> | AuditEvent {
    if (!fields) {
      return event;
    }

    const filtered: Record<string, unknown> = {};
    for (const field of fields) {
      if (field.includes('.')) {
        // Handle nested fields like 'actor.id'
        const parts = field.split('.');
        let value: unknown = event;
        for (const part of parts) {
          if (value && typeof value === 'object') {
            value = (value as Record<string, unknown>)[part];
          } else {
            value = undefined;
            break;
          }
        }
        filtered[field] = value;
      } else if (field in event) {
        filtered[field] = event[field as keyof AuditEvent];
      }
    }
    return filtered as Partial<AuditEvent>;
  }

  /**
   * Compress data using gzip
   */
  private async compressData(data: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const gzip = createGzip();
      const chunks: Buffer[] = [];

      gzip.on('data', (chunk) => chunks.push(chunk));
      gzip.on('end', () => resolve(Buffer.concat(chunks)));
      gzip.on('error', reject);

      gzip.write(data);
      gzip.end();
    });
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `export_${timestamp}_${random}`;
  }
}

/**
 * Create audit exporter instance
 */
export function createAuditExporter(auditManager: AuditLogManager): AuditExporter {
  return new AuditExporter(auditManager);
}
