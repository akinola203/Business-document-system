import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

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
