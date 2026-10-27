import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType } from '@prisma/client';
import { IsEnum, IsString, IsNotEmpty, IsBoolean, IsOptional, IsObject } from 'class-validator';

export class CreateTemplateDto {
  @ApiProperty({ enum: DocumentType, description: 'Target document type for this layout' })
  @IsEnum(DocumentType)
  documentType!: DocumentType;

  @ApiProperty({ example: 'Corporate Classic', description: 'Template display name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'INV-CORP-CLASSIC', description: 'Unique template identifier code' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiPropertyOptional({ default: false, description: 'Whether this is the default layout for the document type' })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @ApiProperty({ description: 'HTML template structure with placeholder tokens or HTML skeleton' })
  @IsString()
  @IsNotEmpty()
  htmlStructure!: string;

  @ApiProperty({ description: 'CSS styles for printing and preview' })
  @IsString()
  @IsNotEmpty()
  cssStyles!: string;

  @ApiPropertyOptional({ description: 'Optional design tokens (brand colors, margins, font family)' })
  @IsObject()
  @IsOptional()
  schemaConfig?: Record<string, any>;
}
