import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class DispatchWaybillDto {
  @ApiPropertyOptional({ example: 'OG-458-APP', description: 'Assigned haulage vehicle registration' })
  @IsOptional()
  @IsString()
  vehicleNumber?: string;

  @ApiPropertyOptional({ example: 'Sunday Babatunde', description: 'Assigned driver name' })
  @IsOptional()
  @IsString()
  driverName?: string;

  @ApiPropertyOptional({ example: '+234 803 555 6677', description: 'Assigned driver contact phone' })
  @IsOptional()
  @IsString()
  driverPhone?: string;

  @ApiPropertyOptional({ example: 'TRK-2026-9042', description: 'Dispatch tracking reference' })
  @IsOptional()
  @IsString()
  trackingNumber?: string;
}
