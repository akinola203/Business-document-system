import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SupplyOrderStatus } from '@prisma/client';

export class CreateSupplyOrderItemDto {
  @ApiPropertyOptional({ example: 'uuid-supply-item' })
  @IsOptional()
  @IsString()
  supplyItemId?: string;

  @ApiProperty({ example: 'Portland Limestone Cement 50kg (Batch EWE-01)' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ example: 'Bags' })
  @IsString()
  @IsNotEmpty()
  unit!: string;

  @ApiProperty({ example: 500 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @ApiProperty({ example: 6800.0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitCost!: number;
}

export class CreateSupplyOrderDto {
  @ApiProperty({ example: 'uuid-vendor-id' })
  @IsString()
  @IsNotEmpty()
  vendorId!: string;

  @ApiPropertyOptional({ example: 'SUP-2026-0001' })
  @IsOptional()
  @IsString()
  supplyNumber?: string;

  @ApiPropertyOptional({ example: '2026-06-01T10:00:00Z' })
  @IsOptional()
  @IsDateString()
  supplyDate?: string;

  @ApiPropertyOptional({ example: 'WAPC/DEL/2026/8941' })
  @IsOptional()
  @IsString()
  deliveryRef?: string;

  @ApiPropertyOptional({ enum: SupplyOrderStatus, default: SupplyOrderStatus.ORDERED })
  @IsOptional()
  @IsEnum(SupplyOrderStatus)
  status?: SupplyOrderStatus = SupplyOrderStatus.ORDERED;

  @ApiPropertyOptional({ example: 'NGN', default: 'NGN' })
  @IsOptional()
  @IsString()
  currency?: string = 'NGN';

  @ApiPropertyOptional({ example: 'Initial replenishment batch' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 0.0, default: 0.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amountPaid?: number = 0;

  @ApiProperty({ type: [CreateSupplyOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSupplyOrderItemDto)
  items!: CreateSupplyOrderItemDto[];
}
