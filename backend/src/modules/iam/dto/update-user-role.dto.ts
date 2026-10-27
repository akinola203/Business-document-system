import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { z } from 'zod';

export const updateUserRoleSchema = z.object({
  roleId: z.string().min(1, 'Role ID is required'),
});

export type UpdateUserRoleSchema = z.infer<typeof updateUserRoleSchema>;

export class UpdateUserRoleDto {
  @ApiProperty({ example: 'role-uuid-2', description: 'Target Role ID to assign to the user' })
  @IsNotEmpty()
  @IsString()
  roleId!: string;
}
