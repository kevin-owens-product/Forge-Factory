/**
 * @package @forge/compliance
 * @description Tests for public API exports
 */

import { describe, it, expect } from 'vitest';
import * as compliance from '../index';

describe('@forge/compliance exports', () => {
  describe('main service', () => {
    it('should export ComplianceService', () => {
      expect(compliance.ComplianceService).toBeDefined();
      expect(typeof compliance.ComplianceService).toBe('function');
    });

    it('should export getComplianceService', () => {
      expect(compliance.getComplianceService).toBeDefined();
      expect(typeof compliance.getComplianceService).toBe('function');
    });

    it('should export resetComplianceService', () => {
      expect(compliance.resetComplianceService).toBeDefined();
      expect(typeof compliance.resetComplianceService).toBe('function');
    });
  });

  describe('audit logging', () => {
    it('should export AuditLogManager', () => {
      expect(compliance.AuditLogManager).toBeDefined();
      expect(typeof compliance.AuditLogManager).toBe('function');
    });

    it('should export getAuditLogManager', () => {
      expect(compliance.getAuditLogManager).toBeDefined();
      expect(typeof compliance.getAuditLogManager).toBe('function');
    });

    it('should export resetAuditLogManager', () => {
      expect(compliance.resetAuditLogManager).toBeDefined();
      expect(typeof compliance.resetAuditLogManager).toBe('function');
    });
  });

  describe('retention policies', () => {
    it('should export RetentionPolicyManager', () => {
      expect(compliance.RetentionPolicyManager).toBeDefined();
      expect(typeof compliance.RetentionPolicyManager).toBe('function');
    });

    it('should export getRetentionPolicyManager', () => {
      expect(compliance.getRetentionPolicyManager).toBeDefined();
      expect(typeof compliance.getRetentionPolicyManager).toBe('function');
    });

    it('should export resetRetentionPolicyManager', () => {
      expect(compliance.resetRetentionPolicyManager).toBeDefined();
      expect(typeof compliance.resetRetentionPolicyManager).toBe('function');
    });
  });

  describe('export functionality', () => {
    it('should export AuditExporter', () => {
      expect(compliance.AuditExporter).toBeDefined();
      expect(typeof compliance.AuditExporter).toBe('function');
    });

    it('should export createAuditExporter', () => {
      expect(compliance.createAuditExporter).toBeDefined();
      expect(typeof compliance.createAuditExporter).toBe('function');
    });
  });

  describe('constants', () => {
    it('should export DEFAULT_RETENTION_DAYS', () => {
      expect(compliance.DEFAULT_RETENTION_DAYS).toBe(90);
    });

    it('should export DEFAULT_QUERY_LIMIT', () => {
      expect(compliance.DEFAULT_QUERY_LIMIT).toBe(100);
    });

    it('should export DEFAULT_CLEANUP_BATCH_SIZE', () => {
      expect(compliance.DEFAULT_CLEANUP_BATCH_SIZE).toBe(1000);
    });

    it('should export DEFAULT_HASH_ALGORITHM', () => {
      expect(compliance.DEFAULT_HASH_ALGORITHM).toBe('sha256');
    });

    it('should export MAX_QUERY_LIMIT', () => {
      expect(compliance.MAX_QUERY_LIMIT).toBe(10000);
    });
  });

  describe('instantiation', () => {
    it('should create ComplianceService instance', () => {
      const service = new compliance.ComplianceService();
      expect(service).toBeInstanceOf(compliance.ComplianceService);
      service.shutdown();
    });

    it('should create AuditLogManager instance', () => {
      const manager = new compliance.AuditLogManager();
      expect(manager).toBeInstanceOf(compliance.AuditLogManager);
    });

    it('should create RetentionPolicyManager instance', () => {
      const manager = new compliance.RetentionPolicyManager();
      expect(manager).toBeInstanceOf(compliance.RetentionPolicyManager);
    });

    it('should create AuditExporter instance', () => {
      const auditManager = new compliance.AuditLogManager();
      const exporter = new compliance.AuditExporter(auditManager);
      expect(exporter).toBeInstanceOf(compliance.AuditExporter);
    });

    it('should create exporter using factory function', () => {
      const auditManager = new compliance.AuditLogManager();
      const exporter = compliance.createAuditExporter(auditManager);
      expect(exporter).toBeInstanceOf(compliance.AuditExporter);
    });
  });
});
