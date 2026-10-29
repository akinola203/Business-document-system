import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'staff@aoa77.com', description: 'User corporate email' })
  @IsEmail({}, { message: 'A valid email address is required' })
  @IsNotEmpty({ message: 'Email cannot be empty' })
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email!: string;
}
