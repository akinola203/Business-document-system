import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsDateString,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceItemDto } from './invoice-item.dto';

export class UpdateInvoiceDto {
  @ApiPropertyOptional({ example: 'Commercial Supply of Portland Cement - Order #4501', description: 'Document header title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Recipient Client ID' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Branch issuing the invoice' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Department handling the invoice' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ example: '2026-10-24', description: 'Invoice issuance date' })
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @ApiPropertyOptional({ example: '2026-11-23', description: 'Invoice payment due date' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ example: 'NGN', description: 'Currency code' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ example: 'Net 30 Days', description: 'Payment terms' })
  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @ApiPropertyOptional({ example: 'PO-DANGOTE-2026-089', description: 'Client Purchase Order Number' })
  @IsOptional()
  @IsString()
  poNumber?: string;

  @ApiPropertyOptional({ example: true, description: 'Display bank settlement details on invoice' })
  @IsOptional()
  @IsBoolean()
  bankDetailsVisible?: boolean;

  @ApiPropertyOptional({ description: 'Template ID for PDF rendering' })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional({ description: 'Template Version ID' })
  @IsOptional()
  @IsString()
  templateVersionId?: string;

  @ApiPropertyOptional({ type: [InvoiceItemDto], description: 'Updated list of invoice line items' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items?: InvoiceItemDto[];

  @ApiPropertyOptional({ example: 1, description: 'Expected current version counter for optimistic concurrency control (OCC)' })
  @IsOptional()
  @Type(() => Number)
  expectedVersion?: number;
}
