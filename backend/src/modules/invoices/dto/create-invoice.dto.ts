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
  IsIn,
  Length,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Type, Transform, Expose } from 'class-transformer';
import { InvoiceItemDto } from './invoice-item.dto';
import { SUPPORTED_CURRENCIES } from '../../currency/currency.service';

@ValidatorConstraint({ name: 'isDueDateAfterOrEqualIssueDate', async: false })
export class IsDueDateAfterOrEqualIssueDateConstraint implements ValidatorConstraintInterface {
  validate(dueDate: any, args: ValidationArguments) {
    const obj = args.object as any;
    if (!dueDate || !obj.issueDate) return true;
    return new Date(dueDate).getTime() >= new Date(obj.issueDate).getTime();
  }

  defaultMessage() {
    return 'dueDate cannot be earlier than issueDate';
  }
}

export class CreateInvoiceDto {
  @ApiProperty({ example: 'Commercial Supply of Portland Cement - Order #4501', description: 'Document header title' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @IsString()
  title!: string;

  @ApiProperty({ example: 'c0000000-0000-0000-0000-000000000001', description: 'Recipient Client / Customer ID' })
  @Expose()
  @Transform(({ value, obj }) => value ?? obj?.customerId)
  @IsNotEmpty({ message: 'Client / Customer ID is required' })
  @IsString()
  clientId!: string;

  @ApiPropertyOptional({ example: 'c0000000-0000-0000-0000-000000000001', description: 'Alias for Recipient Client / Customer ID (clientId)' })
  @Transform(({ value, obj }) => {
    if (value && !obj.clientId) {
      obj.clientId = value;
    }
    return value;
  })
  @IsOptional()
  @IsString()
  customerId?: string;

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
  @Validate(IsDueDateAfterOrEqualIssueDateConstraint)
  dueDate?: string;

  @ApiPropertyOptional({
    example: 'NGN',
    default: 'NGN',
    enum: SUPPORTED_CURRENCIES,
    description: 'Currency code (NGN, USD, JPY, GBP, EUR)',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Length(3, 3)
  @IsIn(SUPPORTED_CURRENCIES)
  currency?: string = 'NGN';

  @ApiPropertyOptional({ example: 'Net 30 Days', default: 'Net 30 Days', description: 'Payment terms' })
  @IsOptional()
  @IsString()
  paymentTerms?: string = 'Net 30 Days';

  @ApiPropertyOptional({ example: 'PO-DANGOTE-2026-089', description: 'Client / Customer Purchase Order Number' })
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

  @ApiPropertyOptional({ description: 'Selected Client / Customer Address ID for billing override' })
  @IsOptional()
  @IsString()
  selectedAddressId?: string;

  @ApiProperty({ type: [InvoiceItemDto], description: 'List of invoice line items' })
  @IsArray()
  @ArrayMinSize(1, { message: 'An invoice must contain at least one line item' })
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items!: InvoiceItemDto[];
}
