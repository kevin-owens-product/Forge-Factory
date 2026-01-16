/**
 * @controller OrganizationController
 * @description REST API endpoints for organization management
 * @prompt-id forge-v4.1:feature:organization-mgmt:003
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { Organization } from '@forge/prisma';
import { TenantId, UserId, OrganizationId } from '@forge/shared-types';

@ApiTags('organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  /**
   * Create a new organization
   */
  @Post()
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiResponse({
    status: 201,
    description: 'Organization created successfully',
    type: Organization,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 409, description: 'Organization slug already exists' })
  async create(
    // TODO: Extract from JWT token via decorator
    // @CurrentUser() user: User,
    @Body() dto: CreateOrganizationDto
  ): Promise<Organization> {
    // Mock tenant and user for now
    const tenantId = 'tenant_mock' as TenantId;
    const userId = 'user_mock' as UserId;

    return this.organizationService.create(tenantId, userId, dto);
  }

  /**
   * Get all organizations
   */
  @Get()
  @ApiOperation({ summary: 'Get all organizations' })
  @ApiResponse({
    status: 200,
    description: 'List of organizations',
    type: [Organization],
  })
  async findAll(): Promise<Organization[]> {
    // TODO: Extract from JWT token
    const tenantId = 'tenant_mock' as TenantId;

    return this.organizationService.findAll(tenantId);
  }

  /**
   * Get organization by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get organization by ID' })
  @ApiResponse({
    status: 200,
    description: 'Organization found',
    type: Organization,
  })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async findOne(@Param('id') id: string): Promise<Organization> {
    // TODO: Extract from JWT token
    const tenantId = 'tenant_mock' as TenantId;

    return this.organizationService.findOne(tenantId, id as OrganizationId);
  }

  /**
   * Update organization
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update organization' })
  @ApiResponse({
    status: 200,
    description: 'Organization updated successfully',
    type: Organization,
  })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  @ApiResponse({ status: 409, description: 'Organization slug already exists' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto
  ): Promise<Organization> {
    // TODO: Extract from JWT token
    const tenantId = 'tenant_mock' as TenantId;
    const userId = 'user_mock' as UserId;

    return this.organizationService.update(tenantId, userId, id as OrganizationId, dto);
  }

  /**
   * Archive organization
   */
  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive organization' })
  @ApiResponse({
    status: 200,
    description: 'Organization archived successfully',
    type: Organization,
  })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async archive(@Param('id') id: string): Promise<Organization> {
    // TODO: Extract from JWT token
    const tenantId = 'tenant_mock' as TenantId;
    const userId = 'user_mock' as UserId;

    return this.organizationService.archive(tenantId, userId, id as OrganizationId);
  }

  /**
   * Delete organization (requires approval)
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete organization (requires approval)' })
  @ApiResponse({ status: 204, description: 'Organization deleted successfully' })
  @ApiResponse({ status: 202, description: 'Approval request created' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async delete(@Param('id') id: string): Promise<void> {
    // TODO: Extract from JWT token
    const tenantId = 'tenant_mock' as TenantId;
    const userId = 'user_mock' as UserId;

    await this.organizationService.delete(tenantId, userId, id as OrganizationId);
  }
}
