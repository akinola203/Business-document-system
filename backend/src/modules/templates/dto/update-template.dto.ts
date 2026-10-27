import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsObject } from 'class-validator';

export class UpdateTemplateDto {
  @ApiPropertyOptional({ description: 'Template display name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Mark as default layout for document type' })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: 'Enable or disable template' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  // New version fields (if updating template structure or styling, an immutable new version is generated)
  @ApiPropertyOptional({ description: 'Updated HTML structure (triggers new TemplateVersion)' })
  @IsString()
  @IsOptional()
  htmlStructure?: string;

  @ApiPropertyOptional({ description: 'Updated CSS styles (triggers new TemplateVersion)' })
  @IsString()
  @IsOptional()
  cssStyles?: string;

  @ApiPropertyOptional({ description: 'Updated design configuration schema' })
  @IsObject()
  @IsOptional()
  schemaConfig?: Record<string, any>;
}
