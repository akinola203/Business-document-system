import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, Min, Max, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class InvoiceItemDto {
  @ApiProperty({ example: 'Industrial Grade Portland Cement (50kg Bag)', description: 'Item description' })
  @IsNotEmpty({ message: 'Item description cannot be empty' })
  @IsString()
  description!: string;

  @ApiProperty({ example: 100, description: 'Billed quantity' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001, { message: 'Quantity must be greater than zero' })
  @Max(1000000000, { message: 'Quantity cannot exceed 1,000,000,000' })
  quantity!: number;

  @ApiProperty({ example: 'Bags', description: 'Unit of measure (e.g. Bags, Hours, Pcs, Drums, Kg)' })
  @IsNotEmpty()
  @IsString()
  unit!: string;

  @ApiProperty({ example: 8500.00, description: 'Unit price' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Unit price cannot be negative' })
  @Max(1000000000000, { message: 'Unit price cannot exceed 1,000,000,000,000' })
  unitPrice!: number;

  @ApiPropertyOptional({ example: 0.00, default: 0.00, description: 'Percentage line discount (0 - 100)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  discountPercent?: number = 0;

  @ApiPropertyOptional({ example: 7.50, default: 7.50, description: 'Applicable percentage VAT rate' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  taxRate?: number = 7.50;
}
