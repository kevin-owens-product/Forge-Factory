/**
 * @module OrganizationModule
 * @description Organization management feature module
 * @prompt-id forge-v4.1:feature:organization-mgmt:001
 */

import { Module } from '@nestjs/common';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';

@Module({
  controllers: [OrganizationController],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
