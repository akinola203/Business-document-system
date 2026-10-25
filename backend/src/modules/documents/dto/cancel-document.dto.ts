import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CancelDocumentDto {
  @ApiProperty({
    example: 'Client requested order cancellation prior to dispatch',
    description: 'Mandatory reason for document cancellation',
  })
  @IsNotEmpty({ message: 'Cancellation reason is required' })
  @IsString()
  @Length(5, 500)
  reason!: string;
}
