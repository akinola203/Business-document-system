import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

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
