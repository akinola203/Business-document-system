import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { z } from 'zod';

export const createRoleSchema = z.object({
  name: z.string().min(1, 'Role name is required'),
  description: z.string().optional(),
  permissionIds: z.array(z.string()).min(1, 'At least one permission must be assigned'),
});

export type CreateRoleSchema = z.infer<typeof createRoleSchema>;

export class CreateRoleDto {
  @ApiProperty({ example: 'Warehouse Officer', description: 'Unique role name' })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'Handles stock loading and waybill dispatch', description: 'Role description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    type: [String],
    example: ['perm-id-1', 'perm-id-2'],
    description: 'Array of Permission IDs to attach to the new role',
  })
  @IsArray()
  @IsString({ each: true })
  permissionIds!: string[];
}
