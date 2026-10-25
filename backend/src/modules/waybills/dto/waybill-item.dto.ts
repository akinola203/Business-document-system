import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, Min, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class WaybillItemDto {
  @ApiProperty({ example: 'Portland Composite Cement (50kg Bag)', description: 'Item description' })
  @IsNotEmpty({ message: 'Item description is required' })
  @IsString()
  description!: string;

  @ApiProperty({ example: 100, description: 'Shipped quantity' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001, { message: 'Quantity must be greater than zero' })
  quantity!: number;

  @ApiProperty({ example: 'Bags', description: 'Unit of measurement' })
  @IsNotEmpty()
  @IsString()
  unit!: string;

  @ApiPropertyOptional({ example: 5000.00, description: 'Total gross weight in kilograms' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  weightKg?: number;

  @ApiPropertyOptional({ example: 100, description: 'Number of individual packages or units' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  packageCount?: number;

  @ApiPropertyOptional({ example: 'Shrink-wrapped Pallet', description: 'Package packaging type' })
  @IsOptional()
  @IsString()
  packageType?: string;
}
