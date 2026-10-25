import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString } from 'class-validator';

export class UpdateLetterDto {
  @ApiPropertyOptional({ example: 'Updated Corporate Letter Title', description: 'Internal document title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: '2026-10-25', description: 'Date appearing on letterhead' })
  @IsOptional()
  @IsDateString()
  letterDate?: string;

  @ApiPropertyOptional({ example: 'Dr. Babatunde Raji', description: 'Primary recipient full name' })
  @IsOptional()
  @IsString()
  recipientName?: string;

  @ApiPropertyOptional({ example: 'Director of Procurement', description: 'Recipient designation' })
  @IsOptional()
  @IsString()
  recipientTitle?: string;

  @ApiPropertyOptional({ example: 'Dangote Industries Limited', description: 'Recipient corporate entity' })
  @IsOptional()
  @IsString()
  recipientOrganization?: string;

  @ApiPropertyOptional({ example: 'Plot 12 Commercial Way, Ikeja, Lagos', description: 'Recipient delivery address' })
  @IsOptional()
  @IsString()
  recipientAddress?: string;

  @ApiPropertyOptional({ example: 'Revised Quotation for Bulk Portland Cement Supply', description: 'Official subject line' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: 'Sanitized HTML letter body' })
  @IsOptional()
  @IsString()
  bodyHtml?: string;

  @ApiPropertyOptional({ description: 'Plain text fallback representation' })
  @IsOptional()
  @IsString()
  bodyText?: string;

  @ApiPropertyOptional({ example: 'Alade Adebayo', description: 'Authorized corporate signatory' })
  @IsOptional()
  @IsString()
  signatoryName?: string;

  @ApiPropertyOptional({ example: 'Managing Director', description: 'Signatory corporate title' })
  @IsOptional()
  @IsString()
  signatoryTitle?: string;

  @ApiPropertyOptional({ example: 'Executive Management', description: 'Signatory department' })
  @IsOptional()
  @IsString()
  signatoryDepartment?: string;

  @ApiPropertyOptional({ description: 'Letterhead template ID' })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional({ description: 'Template version ID' })
  @IsOptional()
  @IsString()
  templateVersionId?: string;
}
