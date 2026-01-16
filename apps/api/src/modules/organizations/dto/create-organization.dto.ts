/**
 * @dto CreateOrganizationDto
 * @description DTO for creating a new organization
 */

import { IsString, IsOptional, IsUrl, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrganizationDto {
  @ApiProperty({
    description: 'Organization name',
    example: 'Acme Corporation',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    description: 'URL-friendly slug',
    example: 'acme-corp',
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  slug!: string;

  @ApiPropertyOptional({
    description: 'Organization description',
    example: 'A leading provider of enterprise solutions',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Organization logo URL',
    example: 'https://example.com/logo.png',
  })
  @IsUrl()
  @IsOptional()
  logo?: string;

  @ApiPropertyOptional({
    description: 'Organization website',
    example: 'https://acme.com',
  })
  @IsUrl()
  @IsOptional()
  website?: string;
}
