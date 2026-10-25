import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsDateString } from 'class-validator';

export class CompleteWaybillDto {
  @ApiProperty({ example: 'Alhaji Musa Ibrahim', description: 'Name of the recipient who signed for the delivery' })
  @IsNotEmpty({ message: 'Receiver name is required' })
  @IsString()
  receivedByName!: string;

  @ApiPropertyOptional({ example: '2026-10-25T14:30:00.000Z', description: 'Actual receipt timestamp' })
  @IsOptional()
  @IsDateString()
  receivedDate?: string;

  @ApiPropertyOptional({ description: 'File ID of captured receiver signature image' })
  @IsOptional()
  @IsString()
  receiverSignatureFileId?: string;
}
