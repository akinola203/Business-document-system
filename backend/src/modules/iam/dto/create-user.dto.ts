import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password cannot exceed 128 characters')
    .optional(),
  phone: z.string().optional(),
  roleId: z.string().min(1, 'Role ID is required'),
  departmentId: z.string().optional(),
  branchId: z.string().optional(),
});

export type CreateUserSchema = z.infer<typeof createUserSchema>;

export class CreateUserDto {
  @ApiProperty({ example: 'bolaji.adeyemi@aoa77.com', description: 'User corporate email address' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiPropertyOptional({ example: 'Bolaji Adeyemi', description: 'User full name' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: 'Bolaji', description: 'User first name' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Adeyemi', description: 'User last name' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: 'Password123!', description: 'Initial account password (auto-generated if omitted)' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;

  @ApiPropertyOptional({ example: '+234 802 333 4455', description: 'Contact telephone' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'role-uuid-1', description: 'Assigned company Role ID' })
  @IsNotEmpty()
  @IsString()
  roleId!: string;

  @ApiPropertyOptional({ example: 'dept-uuid-1', description: 'Assigned Department ID' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ example: 'branch-uuid-1', description: 'Assigned Branch ID' })
  @IsOptional()
  @IsString()
  branchId?: string;
}
