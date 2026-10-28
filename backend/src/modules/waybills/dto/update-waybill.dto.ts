import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WaybillItemDto } from './waybill-item.dto';

export class UpdateWaybillDto {
  @ApiPropertyOptional({ example: 'Updated Waybill Title', description: 'Waybill document title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Recipient Client ID' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Dispatching branch or depot ID' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Dispatching department ID' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ example: '2026-10-25', description: 'Scheduled shipment dispatch date' })
  @IsOptional()
  @IsDateString()
  shipmentDate?: string;

  @ApiPropertyOptional({ example: '1 Alade Ibukun Close, Ayo Irewolede CDA, Ewupe, Ota', description: 'Origin loading address' })
  @IsOptional()
  @IsString()
  originAddress?: string;

  @ApiPropertyOptional({ example: 'Plot 45 Industrial Estate, Ota, Ogun State', description: 'Destination delivery address' })
  @IsOptional()
  @IsString()
  destinationAddress?: string;

  @ApiPropertyOptional({ example: 'OG-458-APP', description: 'Haulage vehicle registration number' })
  @IsOptional()
  @IsString()
  vehicleNumber?: string;

  @ApiPropertyOptional({ example: 'Sunday Babatunde', description: 'Haulage driver full name' })
  @IsOptional()
  @IsString()
  driverName?: string;

  @ApiPropertyOptional({ example: '+234 803 555 6677', description: 'Haulage driver telephone' })
  @IsOptional()
  @IsString()
  driverPhone?: string;

  @ApiPropertyOptional({ example: 'TRK-2026-9042', description: 'Waybill tracking reference' })
  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @ApiPropertyOptional({ type: [WaybillItemDto], description: 'Updated list of cargo items' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WaybillItemDto)
  items?: WaybillItemDto[];

  @ApiPropertyOptional({ example: 'Special handling instructions', description: 'Logistics or waybill notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 1, description: 'Expected current version counter for optimistic concurrency control (OCC)' })
  @IsOptional()
  @Type(() => Number)
  expectedVersion?: number;
}
