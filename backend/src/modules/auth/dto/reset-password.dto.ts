import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Secure password reset token' })
  @IsString()
  @IsNotEmpty({ message: 'Reset token is required' })
  token!: string;

  @ApiProperty({ example: 'NewSecretPass123!', description: 'New password' })
  @IsString()
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password cannot exceed 128 characters' })
  newPassword!: string;
}
