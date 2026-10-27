import { IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryReportsDto {
  @ApiPropertyOptional({ description: 'Start date filter (ISO string, e.g. 2026-01-01)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date filter (ISO string, e.g. 2026-12-31)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Currency code filter (e.g. NGN, USD)', default: 'NGN' })
  @IsOptional()
  @IsString()
  currency?: string = 'NGN';

  @ApiPropertyOptional({ description: 'Branch ID filter' })
  @IsOptional()
  @IsString()
  branchId?: string;
}
