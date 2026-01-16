/**
 * @service OrganizationService
 * @description Business logic for organization management
 * @prompt-id forge-v4.1:feature:organization-mgmt:002
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { db, Organization, OrgStatus } from '@forge/prisma';
import { TenantId, OrganizationId, UserId } from '@forge/shared-types';
import { createNotFoundError, createConflictError } from '@forge/errors';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationService {
  /**
   * Create a new organization
   */
  async create(
    tenantId: TenantId,
    userId: UserId,
    dto: CreateOrganizationDto
  ): Promise<Organization> {
    // Check if slug already exists for this tenant
    const existing = await db.organization.findFirst({
      where: {
        tenantId,
        slug: dto.slug,
      },
    });

    if (existing) {
      throw createConflictError(`Organization with slug '${dto.slug}' already exists`);
    }

    // Create organization
    const organization = await db.organization.create({
      data: {
        tenantId,
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        logo: dto.logo,
        website: dto.website,
        status: OrgStatus.ACTIVE,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    // TODO: Audit log
    // await auditLog({
    //   eventType: 'organization.created',
    //   tenantId,
    //   userId,
    //   resourceType: 'organization',
    //   resourceId: organization.id,
    // });

    return organization;
  }

  /**
   * Get all organizations for a tenant
   */
  async findAll(tenantId: TenantId): Promise<Organization[]> {
    return db.organization.findMany({
      where: {
        tenantId,
        status: {
          not: OrgStatus.ARCHIVED,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get a single organization by ID
   */
  async findOne(tenantId: TenantId, id: OrganizationId): Promise<Organization> {
    const organization = await db.organization.findFirst({
      where: {
        id,
        tenantId, // Tenant isolation
      },
    });

    if (!organization) {
      throw createNotFoundError('Organization', id);
    }

    return organization;
  }

  /**
   * Update an organization
   */
  async update(
    tenantId: TenantId,
    userId: UserId,
    id: OrganizationId,
    dto: UpdateOrganizationDto
  ): Promise<Organization> {
    // Verify organization exists and belongs to tenant
    await this.findOne(tenantId, id);

    // If slug is being updated, check for conflicts
    if (dto.slug) {
      const existing = await db.organization.findFirst({
        where: {
          tenantId,
          slug: dto.slug,
          id: { not: id }, // Exclude current organization
        },
      });

      if (existing) {
        throw createConflictError(`Organization with slug '${dto.slug}' already exists`);
      }
    }

    // Update organization
    const organization = await db.organization.updateMany({
      where: {
        id,
        tenantId, // Tenant isolation
      },
      data: {
        ...dto,
        updatedBy: userId,
        updatedAt: new Date(),
      },
    });

    // TODO: Audit log
    // await auditLog({
    //   eventType: 'organization.updated',
    //   tenantId,
    //   userId,
    //   resourceType: 'organization',
    //   resourceId: id,
    //   changes: dto,
    // });

    return this.findOne(tenantId, id);
  }

  /**
   * Archive an organization (soft delete)
   */
  async archive(
    tenantId: TenantId,
    userId: UserId,
    id: OrganizationId
  ): Promise<Organization> {
    // Verify organization exists and belongs to tenant
    await this.findOne(tenantId, id);

    // Archive the organization
    await db.organization.updateMany({
      where: {
        id,
        tenantId, // Tenant isolation
      },
      data: {
        status: OrgStatus.ARCHIVED,
        archivedAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      },
    });

    // TODO: Audit log
    // await auditLog({
    //   eventType: 'organization.archived',
    //   tenantId,
    //   userId,
    //   resourceType: 'organization',
    //   resourceId: id,
    // });

    return this.findOne(tenantId, id);
  }

  /**
   * Delete an organization (requires approval in production)
   */
  async delete(
    tenantId: TenantId,
    userId: UserId,
    id: OrganizationId
  ): Promise<void> {
    // Verify organization exists and belongs to tenant
    await this.findOne(tenantId, id);

    // TODO: Check for approval requirement
    // const requiresApproval = await checkApprovalPolicy('organization.delete');
    // if (requiresApproval) {
    //   await createApprovalRequest({ action: 'organization.delete', resourceId: id });
    //   throw new ApprovalRequiredError();
    // }

    // Hard delete
    await db.organization.deleteMany({
      where: {
        id,
        tenantId, // Tenant isolation
      },
    });

    // TODO: Audit log
    // await auditLog({
    //   eventType: 'organization.deleted',
    //   tenantId,
    //   userId,
    //   resourceType: 'organization',
    //   resourceId: id,
    // });
  }
}
