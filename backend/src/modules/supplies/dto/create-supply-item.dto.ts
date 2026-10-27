import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSupplyItemDto {
  @ApiProperty({ example: 'SUP-CEM-001' })
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @ApiProperty({ example: 'Portland Limestone Cement 50kg' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'RAW_MATERIALS' })
  @IsString()
  @IsNotEmpty()
  category!: string;

  @ApiPropertyOptional({ example: 'Grade 42.5N building cement for heavy engineering construction.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'Bags' })
  @IsString()
  @IsNotEmpty()
  unit!: string;

  @ApiProperty({ example: 6800.0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitCost!: number;

  @ApiProperty({ example: 8500.0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sellingPrice!: number;

  @ApiPropertyOptional({ example: 7.5, default: 7.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  taxRate?: number = 7.5;

  @ApiPropertyOptional({ example: 1250.0, default: 0.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  currentStock?: number = 0;

  @ApiPropertyOptional({ example: 200.0, default: 0.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  reorderLevel?: number = 0;

  @ApiPropertyOptional({ example: 'uuid-preferred-vendor' })
  @IsOptional()
  @IsString()
  preferredVendorId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}
