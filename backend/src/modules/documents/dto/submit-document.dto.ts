import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

export const submitDocumentSchema = z.object({
  approverId: z.string().uuid().optional(),
  comment: z.string().optional(),
  notes: z.string().optional(),
}).passthrough();

export class SubmitDocumentDto {
  @ApiPropertyOptional({ description: 'Optional specific approver user ID' })
  @IsOptional()
  @IsUUID()
  approverId?: string;

  @ApiPropertyOptional({ description: 'Submission notes or comment' })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({ description: 'Submission notes or remarks' })
  @IsOptional()
  @IsString()
  notes?: string;
}
