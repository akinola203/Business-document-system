import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

export const rejectDocumentSchema = z.object({
  reason: z.string().optional(),
  notes: z.string().optional(),
}).passthrough();

export class RejectDocumentDto {
  @ApiPropertyOptional({ description: 'Justification for document rejection' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: 'Rejection notes or justification' })
  @IsOptional()
  @IsString()
  notes?: string;
}
