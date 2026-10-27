import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { CompanyUserStatus } from '@prisma/client';
import { z } from 'zod';

export const updateUserStatusSchema = z.object({
  status: z.nativeEnum(CompanyUserStatus),
});

export type UpdateUserStatusSchema = z.infer<typeof updateUserStatusSchema>;

export class UpdateUserStatusDto {
  @ApiProperty({
    enum: CompanyUserStatus,
    example: CompanyUserStatus.SUSPENDED,
    description: 'Target membership status for the user within this company',
  })
  @IsNotEmpty()
  @IsEnum(CompanyUserStatus)
  status!: CompanyUserStatus;
}
