import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WaybillItemDto } from './waybill-item.dto';

export class CreateWaybillDto {
  @ApiProperty({ example: 'Consignment Dispatch - Dangote Hub Ota', description: 'Waybill document title' })
  @IsNotEmpty()
  @IsString()
  title!: string;

  @ApiPropertyOptional({ description: 'Optional linked Invoice ID to copy client and item details from' })
  @IsOptional()
  @IsString()
  invoiceId?: string;

  @ApiPropertyOptional({ description: 'Recipient Client ID (required if invoiceId is not provided)' })
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

  @ApiPropertyOptional({ description: 'Template ID' })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional({ description: 'Template Version ID' })
  @IsOptional()
  @IsString()
  templateVersionId?: string;

  @ApiPropertyOptional({ example: '2026-10-24', description: 'Scheduled shipment dispatch date' })
  @IsOptional()
  @IsDateString()
  shipmentDate?: string;

  @ApiProperty({ example: '1 Alade Ibukun Close, Ayo Irewolede CDA, Ewupe, Ota', description: 'Origin loading address' })
  @IsNotEmpty()
  @IsString()
  originAddress!: string;

  @ApiProperty({ example: 'Plot 45 Industrial Estate, Ota, Ogun State', description: 'Destination delivery address' })
  @IsNotEmpty()
  @IsString()
  destinationAddress!: string;

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

  @ApiPropertyOptional({ example: 'TRK-2026-9042', description: 'Waybill tracking or consignment note reference' })
  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @ApiProperty({ type: [WaybillItemDto], description: 'List of cargo consignment items' })
  @IsArray()
  @ArrayMinSize(1, { message: 'A waybill must contain at least one item' })
  @ValidateNested({ each: true })
  @Type(() => WaybillItemDto)
  items!: WaybillItemDto[];
}
