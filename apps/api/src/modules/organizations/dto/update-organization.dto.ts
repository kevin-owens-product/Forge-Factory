/**
 * @dto UpdateOrganizationDto
 * @description DTO for updating an organization
 */

import { PartialType } from '@nestjs/swagger';
import { CreateOrganizationDto } from './create-organization.dto';

export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {}
