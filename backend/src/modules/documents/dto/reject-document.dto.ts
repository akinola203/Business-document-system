import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectDocumentDto {
  @ApiProperty({ description: 'Mandatory justification for document rejection' })
  @IsNotEmpty({ message: 'Rejection reason is mandatory.' })
  @IsString()
  @MinLength(5, { message: 'Rejection reason must be at least 5 characters.' })
  reason!: string;
}
