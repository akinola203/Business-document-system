import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { z } from 'zod';

export const cancelDocumentSchema = z.object({
  reason: z.string().optional(),
  notes: z.string().optional(),
}).passthrough();

export class CancelDocumentDto {
  @ApiPropertyOptional({
    example: 'Client requested order cancellation prior to dispatch',
    description: 'Reason for document cancellation',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Cancellation notes or reason',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
