import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsBoolean,
  IsDateString,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { z } from 'zod';
import { InvoiceItemDto } from './invoice-item.dto';

export class CreateInvoiceDto {
  @ApiProperty({ example: 'Commercial Supply of Portland Cement - Order #4501', description: 'Document header title' })
  @IsNotEmpty()
  @IsString()
  title!: string;

  @ApiProperty({ example: 'c0000000-0000-0000-0000-000000000001', description: 'Recipient Client ID' })
  @IsNotEmpty({ message: 'Client ID is required' })
  @IsString()
  clientId!: string;

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

  @ApiPropertyOptional({ example: 'NGN', default: 'NGN', description: 'Currency code' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string = 'NGN';

  @ApiPropertyOptional({ example: 'Net 30 Days', default: 'Net 30 Days', description: 'Payment terms' })
  @IsOptional()
  @IsString()
  paymentTerms?: string = 'Net 30 Days';

  @ApiPropertyOptional({ example: 'PO-DANGOTE-2026-089', description: 'Client Purchase Order Number' })
  @IsOptional()
  @IsString()
  poNumber?: string;

  @ApiPropertyOptional({ example: 'Payment within 30 days via wire transfer', description: 'Remittance or invoice notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: true, default: true, description: 'Display bank settlement details on invoice' })
  @IsOptional()
  @IsBoolean()
  bankDetailsVisible?: boolean = true;

  @ApiPropertyOptional({ description: 'Template ID for PDF rendering' })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional({ description: 'Template Version ID' })
  @IsOptional()
  @IsString()
  templateVersionId?: string;

  @ApiProperty({ type: [InvoiceItemDto], description: 'List of invoice line items' })
  @IsArray()
  @ArrayMinSize(1, { message: 'An invoice must contain at least one line item' })
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items!: InvoiceItemDto[];
}

export const createInvoiceSchema = z.object({
  title: z.string().min(1),
  clientId: z.string().min(1),
  branchId: z.string().optional(),
  departmentId: z.string().optional(),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  currency: z.string().optional(),
  paymentTerms: z.string().optional(),
  poNumber: z.string().optional(),
  notes: z.string().optional(),
  bankDetailsVisible: z.boolean().optional(),
  templateId: z.string().optional(),
  templateVersionId: z.string().optional(),
  items: z.array(z.any()),
}).passthrough();
