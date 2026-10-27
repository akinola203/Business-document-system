import { PartialType } from '@nestjs/swagger';
import { CreateVendorDto } from './create-vendor.dto';
import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { VendorStatus } from '@prisma/client';

export class UpdateVendorDto extends PartialType(CreateVendorDto) {
  @ApiPropertyOptional({ enum: VendorStatus })
  @IsOptional()
  @IsEnum(VendorStatus)
  status?: VendorStatus;
}
