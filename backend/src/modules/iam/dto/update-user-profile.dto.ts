import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateUserProfileDto {
  @ApiPropertyOptional({ example: 'Akinola Akinlade', description: 'User full display name / username' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: 'Akinola', description: 'User first name' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Akinlade', description: 'User last name' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: 'admin@aoa77.com', description: 'User corporate email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+234 803 000 0001', description: 'User contact phone' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'NewSecurePass123!', description: 'New account password (min 8 chars)' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;

  @ApiPropertyOptional({ example: 'NewSecurePass123!', description: 'New account password alias (min 8 chars)' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword?: string;

  @ApiPropertyOptional({ description: 'Current password when user changes their own password' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  currentPassword?: string;
}
