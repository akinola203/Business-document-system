import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { z } from 'zod';

export const resetUserPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters').optional(),
});

export type ResetUserPasswordSchema = z.infer<typeof resetUserPasswordSchema>;

export class ResetUserPasswordDto {
  @ApiPropertyOptional({
    example: 'NewSecurePass@2026',
    description: 'Optional new password. If omitted, a temporary random password will be auto-generated.',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  newPassword?: string;
}
