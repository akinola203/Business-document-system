import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateLetterDto {
  @ApiProperty({ example: 'Corporate Introduction & Service Proposal', description: 'Internal document title' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @IsString()
  title!: string;

  @ApiPropertyOptional({ description: 'Optional linked Client ID' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Issuing branch ID' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Issuing department ID' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ example: '2026-10-24', description: 'Date appearing on letterhead' })
  @IsOptional()
  @IsDateString()
  letterDate?: string;

  @ApiProperty({ example: 'Dr. Babatunde Raji', description: 'Primary recipient full name' })
  @IsNotEmpty({ message: 'Recipient name is required' })
  @IsString()
  recipientName!: string;

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

  @ApiProperty({ example: 'Formal Quotation for Bulk Portland Cement Supply', description: 'Official subject line' })
  @IsNotEmpty({ message: 'Subject is required' })
  @IsString()
  subject!: string;

  @ApiPropertyOptional({
    example: '<p>Dear Dr. Raji,</p><p>We have the pleasure of submitting our corporate supply proposal...</p>',
    description: 'Sanitized HTML letter body',
  })
  @IsOptional()
  @IsString()
  bodyHtml?: string;

  @ApiPropertyOptional({
    example: 'Dear Dr. Raji, We have the pleasure of submitting our corporate supply proposal...',
    description: 'Plain text fallback representation',
  })
  @IsOptional()
  @IsString()
  bodyText?: string;

  @ApiProperty({ example: 'Alade Adebayo', description: 'Authorized corporate signatory' })
  @IsNotEmpty({ message: 'Signatory name is required' })
  @IsString()
  signatoryName!: string;

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

  @ApiPropertyOptional({ example: 'Dispatched via courier', description: 'Internal correspondence notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
