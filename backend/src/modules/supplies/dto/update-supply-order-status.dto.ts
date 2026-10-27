import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SupplyOrderStatus } from '@prisma/client';

export class UpdateSupplyOrderStatusDto {
  @ApiProperty({ enum: SupplyOrderStatus })
  @IsEnum(SupplyOrderStatus)
  status!: SupplyOrderStatus;

  @ApiPropertyOptional({ example: 'Verified and stocked into warehouse' })
  @IsOptional()
  @IsString()
  notes?: string;
}
