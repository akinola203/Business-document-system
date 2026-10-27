import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';
import { z } from 'zod';

export const updateRolePermissionsSchema = z.object({
  permissionIds: z.array(z.string()).min(1, 'At least one permission must be assigned to the role'),
});

export type UpdateRolePermissionsSchema = z.infer<typeof updateRolePermissionsSchema>;

export class UpdateRolePermissionsDto {
  @ApiProperty({
    type: [String],
    example: ['perm-id-1', 'perm-id-2'],
    description: 'Updated complete list of Permission IDs for the role',
  })
  @IsArray()
  @IsString({ each: true })
  permissionIds!: string[];
}
