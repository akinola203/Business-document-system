import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@aoa77.com', description: 'User corporate email' })
  @IsEmail({}, { message: 'A valid email address is required' })
  @IsNotEmpty({ message: 'Email cannot be empty' })
  email!: string;

  @ApiProperty({ example: 'Aoa77@Password2026!', description: 'User password' })
  @IsString()
  @IsNotEmpty({ message: 'Password cannot be empty' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128, { message: 'Password cannot exceed 128 characters' })
  password!: string;

  @ApiPropertyOptional({ example: true, description: 'Whether to remember user session with longer-lived tokens' })
  @IsBoolean()
  @IsOptional()
  rememberMe?: boolean;
}
