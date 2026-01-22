/**
 * @package @forge/compliance
 * @description Tests for audit exporter
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuditExporter, createAuditExporter } from '../export';
import { AuditLogManager } from '../audit';
import { AuditEvent, ExportOptions } from '../compliance.types';

describe('AuditExporter', () => {
  let auditManager: AuditLogManager;
  let exporter: AuditExporter;

  beforeEach(async () => {
    auditManager = new AuditLogManager();
    exporter = new AuditExporter(auditManager);

    // Create test events
    await auditManager.log({
      type: 'AUTH',
      subtype: 'LOGIN',
      severity: 'LOW',
      outcome: 'SUCCESS',
      tenantId: 'tenant-1',
      actor: {
        id: 'user-1',
        type: 'USER',
        name: 'John Doe',
        email: 'john@example.com',
        ipAddress: '192.168.1.1',
      },
      action: 'User logged in',
      message: 'Successful login',
    });

    await auditManager.log({
      type: 'ACCESS',
      subtype: 'RESOURCE_READ',
      severity: 'MEDIUM',
      outcome: 'SUCCESS',
      tenantId: 'tenant-1',
      actor: {
        id: 'user-1',
        type: 'USER',
        name: 'John Doe',
        email: 'john@example.com',
      },
      target: {
        id: 'doc-123',
        type: 'DOCUMENT',
        name: 'Important File',
      },
      action: 'Read document',
      message: 'User accessed document',
    });

    await auditManager.log({
      type: 'SECURITY',
      subtype: 'SUSPICIOUS_ACTIVITY',
      severity: 'HIGH',
      outcome: 'FAILURE',
      tenantId: 'tenant-2',
      actor: {
        id: 'user-2',
        type: 'USER',
        name: 'Jane Smith',
        email: 'jane@example.com',
        ipAddress: '10.0.0.1',
      },
      action: 'Failed authentication attempt',
      message: 'Multiple failed login attempts detected',
      tags: ['security', 'alert'],
    });
  });

  afterEach(() => {
    auditManager.clear();
  });

  describe('export', () => {
    describe('JSON format', () => {
      it('should export events as JSON', async () => {
        const options: ExportOptions = { format: 'JSON' };
        const { data, result } = await exporter.export({ tenantId: 'tenant-1' }, options);

        const parsed = JSON.parse(data.toString());

        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed.length).toBe(2);
        expect(result.eventCount).toBe(2);
        expect(result.format).toBe('JSON');
      });

      it('should export with pretty print', async () => {
        const options: ExportOptions = { format: 'JSON', prettyPrint: true };
        const { data } = await exporter.export({ tenantId: 'tenant-1' }, options);

        const jsonStr = data.toString();

        expect(jsonStr).toContain('\n');
        expect(jsonStr).toContain('  ');
      });

      it('should filter fields', async () => {
        const options: ExportOptions = {
          format: 'JSON',
          fields: ['id', 'type', 'action'],
        };
        const { data } = await exporter.export({ tenantId: 'tenant-1' }, options);

        const parsed = JSON.parse(data.toString());

        expect(parsed[0]).toHaveProperty('id');
        expect(parsed[0]).toHaveProperty('type');
        expect(parsed[0]).toHaveProperty('action');
        expect(parsed[0]).not.toHaveProperty('severity');
        expect(parsed[0]).not.toHaveProperty('actor');
      });

      it('should handle nested fields', async () => {
        const options: ExportOptions = {
          format: 'JSON',
          fields: ['id', 'actor.id', 'actor.name'],
        };
        const { data } = await exporter.export({ tenantId: 'tenant-1' }, options);

        const parsed = JSON.parse(data.toString());

        expect(parsed[0]).toHaveProperty('id');
        expect(parsed[0]).toHaveProperty('actor.id');
        expect(parsed[0]).toHaveProperty('actor.name');
      });
    });

    describe('CSV format', () => {
      it('should export events as CSV', async () => {
        const options: ExportOptions = { format: 'CSV' };
        const { data, result } = await exporter.export({ tenantId: 'tenant-1' }, options);

        const csvStr = data.toString();
        const lines = csvStr.split('\n');

        expect(lines.length).toBe(3); // Header + 2 data rows
        expect(lines[0]).toContain('id');
        expect(lines[0]).toContain('type');
        expect(result.format).toBe('CSV');
      });

      it('should use custom delimiter', async () => {
        const options: ExportOptions = { format: 'CSV', csvDelimiter: ';' };
        const { data } = await exporter.export({ tenantId: 'tenant-1' }, options);

        const csvStr = data.toString();
        const header = csvStr.split('\n')[0];

        expect(header).toContain(';');
        expect(header).not.toContain(',');
      });

      it('should escape values with commas', async () => {
        // Add event with comma in message
        await auditManager.log({
          type: 'AUTH',
          tenantId: 'tenant-1',
          actor: { id: 'user-1', type: 'USER' },
          action: 'Test action',
          message: 'Message with, comma',
        });

        const options: ExportOptions = { format: 'CSV' };
        const { data } = await exporter.export({ tenantId: 'tenant-1' }, options);

        const csvStr = data.toString();

        expect(csvStr).toContain('"Message with, comma"');
      });

      it('should escape values with quotes', async () => {
        await auditManager.log({
          type: 'AUTH',
          tenantId: 'tenant-1',
          actor: { id: 'user-1', type: 'USER' },
          action: 'Test action',
          message: 'Message with "quotes"',
        });

        const options: ExportOptions = { format: 'CSV' };
        const { data } = await exporter.export({ tenantId: 'tenant-1' }, options);

        const csvStr = data.toString();

        expect(csvStr).toContain('""quotes""');
      });

      it('should use ISO date format by default', async () => {
        const options: ExportOptions = { format: 'CSV' };
        const { data } = await exporter.export({ tenantId: 'tenant-1' }, options);

        const csvStr = data.toString();

        // ISO format: 2024-01-16T00:00:00.000Z
        expect(csvStr).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      });

      it('should filter fields in CSV', async () => {
        const options: ExportOptions = {
          format: 'CSV',
          fields: ['id', 'type', 'action'],
        };
        const { data } = await exporter.export({ tenantId: 'tenant-1' }, options);

        const csvStr = data.toString();
        const header = csvStr.split('\n')[0];

        expect(header).toBe('id,type,action');
      });
    });

    describe('NDJSON format', () => {
      it('should export events as NDJSON', async () => {
        const options: ExportOptions = { format: 'NDJSON' };
        const { data, result } = await exporter.export({ tenantId: 'tenant-1' }, options);

        const lines = data.toString().split('\n').filter(Boolean);

        expect(lines.length).toBe(2);
        lines.forEach((line) => {
          expect(() => JSON.parse(line)).not.toThrow();
        });
        expect(result.format).toBe('NDJSON');
      });

      it('should filter fields in NDJSON', async () => {
        const options: ExportOptions = {
          format: 'NDJSON',
          fields: ['id', 'type'],
        };
        const { data } = await exporter.export({ tenantId: 'tenant-1' }, options);

        const lines = data.toString().split('\n').filter(Boolean);
        const parsed = JSON.parse(lines[0]);

        expect(parsed).toHaveProperty('id');
        expect(parsed).toHaveProperty('type');
        expect(parsed).not.toHaveProperty('severity');
      });
    });

    describe('compression', () => {
      it('should compress output', async () => {
        const uncompressed = await exporter.export(
          { tenantId: 'tenant-1' },
          { format: 'JSON' }
        );

        const compressed = await exporter.export(
          { tenantId: 'tenant-1' },
          { format: 'JSON', compress: true }
        );

        expect(compressed.data.length).toBeLessThan(uncompressed.data.length);
      });
    });

    describe('integrity verification', () => {
      it('should include integrity status when requested', async () => {
        const { result } = await exporter.export(
          { tenantId: 'tenant-1' },
          { format: 'JSON', includeIntegrity: true }
        );

        expect(result.integrityVerified).toBeDefined();
        expect(result.integrityVerified).toBe(true);
      });

      it('should skip integrity without tenantId', async () => {
        const { result } = await exporter.export(
          {},
          { format: 'JSON', includeIntegrity: true }
        );

        expect(result.integrityVerified).toBeUndefined();
      });
    });

    describe('result metadata', () => {
      it('should include export ID', async () => {
        const { result } = await exporter.export({ tenantId: 'tenant-1' }, { format: 'JSON' });

        expect(result.id).toBeDefined();
        expect(result.id).toMatch(/^export_/);
      });

      it('should include event count', async () => {
        const { result } = await exporter.export({ tenantId: 'tenant-1' }, { format: 'JSON' });

        expect(result.eventCount).toBe(2);
      });

      it('should include size in bytes', async () => {
        const { data, result } = await exporter.export(
          { tenantId: 'tenant-1' },
          { format: 'JSON' }
        );

        expect(result.sizeBytes).toBe(data.length);
      });

      it('should include duration', async () => {
        const { result } = await exporter.export({ tenantId: 'tenant-1' }, { format: 'JSON' });

        expect(result.durationMs).toBeGreaterThanOrEqual(0);
      });

      it('should include created timestamp', async () => {
        const { result } = await exporter.export({ tenantId: 'tenant-1' }, { format: 'JSON' });

        expect(result.createdAt).toBeInstanceOf(Date);
      });
    });

    describe('error handling', () => {
      it('should throw for empty results', async () => {
        await expect(
          exporter.export({ tenantId: 'non-existent' }, { format: 'JSON' })
        ).rejects.toThrow('No events found matching the filters');
      });

      it('should throw for unsupported format', async () => {
        await expect(
          exporter.export({ tenantId: 'tenant-1' }, { format: 'XML' as any })
        ).rejects.toThrow('Unsupported export format: XML');
      });
    });
  });

  describe('exportStream', () => {
    beforeEach(async () => {
      // Add more events for streaming tests
      for (let i = 0; i < 10; i++) {
        await auditManager.log({
          type: 'AUTH',
          tenantId: 'tenant-1',
          actor: { id: `user-${i}`, type: 'USER' },
          action: `Action ${i}`,
        });
      }
    });

    describe('JSON format', () => {
      it('should stream events as JSON', async () => {
        const chunks: Buffer[] = [];
        const generator = exporter.exportStream(
          { tenantId: 'tenant-1' },
          { format: 'JSON' },
          3
        );

        let result: any;
        for await (const chunk of generator) {
          chunks.push(chunk);
        }
        result = (generator as any).value; // Get the return value

        const combined = Buffer.concat(chunks).toString();
        const parsed = JSON.parse(combined);

        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed.length).toBe(12); // 2 original + 10 new
      });

      it('should stream with pretty print', async () => {
        const chunks: Buffer[] = [];
        const generator = exporter.exportStream(
          { tenantId: 'tenant-1' },
          { format: 'JSON', prettyPrint: true },
          3
        );

        for await (const chunk of generator) {
          chunks.push(chunk);
        }

        const combined = Buffer.concat(chunks).toString();

        expect(combined).toContain('\n');
      });
    });

    describe('CSV format', () => {
      it('should stream events as CSV', async () => {
        const chunks: Buffer[] = [];
        const generator = exporter.exportStream(
          { tenantId: 'tenant-1' },
          { format: 'CSV' },
          3
        );

        for await (const chunk of generator) {
          chunks.push(chunk);
        }

        const combined = Buffer.concat(chunks).toString();
        const lines = combined.split('\n').filter(Boolean);

        expect(lines[0]).toContain('id'); // Header
        expect(lines.length).toBe(13); // Header + 12 data rows
      });
    });

    describe('NDJSON format', () => {
      it('should stream events as NDJSON', async () => {
        const chunks: Buffer[] = [];
        const generator = exporter.exportStream(
          { tenantId: 'tenant-1' },
          { format: 'NDJSON' },
          3
        );

        for await (const chunk of generator) {
          chunks.push(chunk);
        }

        const combined = Buffer.concat(chunks).toString();
        const lines = combined.split('\n').filter(Boolean);

        expect(lines.length).toBe(12);
        lines.forEach((line) => {
          expect(() => JSON.parse(line)).not.toThrow();
        });
      });
    });

    describe('batch processing', () => {
      it('should process in batches', async () => {
        let chunkCount = 0;
        const generator = exporter.exportStream(
          { tenantId: 'tenant-1' },
          { format: 'NDJSON' },
          3
        );

        for await (const chunk of generator) {
          chunkCount++;
        }

        // Each event produces a chunk, plus we have 12 events
        expect(chunkCount).toBeGreaterThan(0);
      });
    });

    describe('return value', () => {
      it('should return export result', async () => {
        const generator = exporter.exportStream(
          { tenantId: 'tenant-1' },
          { format: 'NDJSON' },
          3
        );

        let result;
        let done = false;
        while (!done) {
          const next = await generator.next();
          if (next.done) {
            result = next.value;
            done = true;
          }
        }

        expect(result).toBeDefined();
        expect(result.id).toMatch(/^export_/);
        expect(result.eventCount).toBe(12);
        expect(result.format).toBe('NDJSON');
      });
    });
  });

  describe('createAuditExporter', () => {
    it('should create exporter instance', () => {
      const instance = createAuditExporter(auditManager);

      expect(instance).toBeInstanceOf(AuditExporter);
    });
  });
});
