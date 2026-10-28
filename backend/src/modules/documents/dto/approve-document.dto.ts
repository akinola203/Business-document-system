import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

export const approveDocumentSchema = z.object({
  comment: z.string().optional(),
  notes: z.string().optional(),
}).passthrough();

export class ApproveDocumentDto {
  @ApiPropertyOptional({ description: 'Approval remarks or authorization notes' })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({ description: 'Approval remarks or authorization notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
