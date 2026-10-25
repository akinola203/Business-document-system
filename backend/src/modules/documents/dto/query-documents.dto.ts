import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsNumber, IsBoolean, Min, Max, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { DocumentType, DocumentStatus } from '@prisma/client';

export class QueryDocumentsDto {
  @ApiPropertyOptional({ example: 1, default: 1, description: 'Page index' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20, description: 'Page size' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ example: 'INV-2026', description: 'Search term for document number or title' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: DocumentType, description: 'Filter by document type (INVOICE, WAYBILL, LETTER)' })
  @IsOptional()
  @IsEnum(DocumentType)
  documentType?: DocumentType;

  @ApiPropertyOptional({ enum: DocumentStatus, description: 'Filter by lifecycle status' })
  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @ApiPropertyOptional({ description: 'Filter by recipient client ID' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Filter by issuing branch ID' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Filter by department ID' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ example: '2026-01-01', description: 'Start issue date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'End issue date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ default: false, description: 'Include or filter archived documents' })
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean = false;

  @ApiPropertyOptional({
    example: 'createdAt',
    enum: ['createdAt', 'issueDate', 'documentNumber', 'totalAmount', 'title'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ example: 'desc', enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
