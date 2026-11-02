import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CancelDocumentDto {
  @ApiPropertyOptional({
    example: 'Client requested order cancellation prior to dispatch',
    description: 'Reason for document cancellation',
  })
  @IsOptional()
  @IsString()
  cancellationReason?: string;

  @ApiPropertyOptional({
    example: 'Client requested order cancellation prior to dispatch',
    description: 'Reason for document cancellation (alias)',
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
