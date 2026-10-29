import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class IssueDocumentDto {
  @ApiPropertyOptional({ example: 1, description: 'Expected versionCounter for optimistic concurrency control (OCC)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;

  @ApiPropertyOptional({ example: 'Approved for official client dispatch', description: 'Issuance notes or reason' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({ example: 'KJA-892-XA', description: 'Assigned haulage vehicle registration (for waybills)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  vehicleNumber?: string;

  @ApiPropertyOptional({ example: 'Chidi Okafor', description: 'Assigned driver name (for waybills)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  driverName?: string;

  @ApiPropertyOptional({ example: '+234 802 333 4444', description: 'Assigned driver phone (for waybills)' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  driverPhone?: string;

  @ApiPropertyOptional({ example: 'TRK-2026-9042', description: 'Dispatch tracking number (for waybills)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  trackingNumber?: string;
}
