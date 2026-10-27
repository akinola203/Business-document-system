import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ReversePaymentDto {
  @ApiProperty({ example: 'Duplicate entry - same transfer was recorded twice', description: 'Mandatory justification' })
  @IsString()
  @IsNotEmpty({ message: 'A reversal reason is mandatory.' })
  @MinLength(5, { message: 'Reversal reason must be at least 5 characters.' })
  @MaxLength(500)
  reason!: string;
}
