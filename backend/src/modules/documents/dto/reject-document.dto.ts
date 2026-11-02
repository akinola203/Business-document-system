import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RejectDocumentDto {
  @ApiPropertyOptional({ description: 'Justification for document rejection' })
  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @ApiPropertyOptional({ description: 'Justification for document rejection (alias)' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: 'Rejection notes or justification' })
  @IsOptional()
  @IsString()
  notes?: string;
}
