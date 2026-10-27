import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { z } from 'zod';

export const failWaybillSchema = z.object({
  failureReason: z.string().trim().min(5, 'Failure reason must be at least 5 characters').max(500),
  notes: z.string().trim().max(500).optional(),
});

export type FailWaybillPayload = z.infer<typeof failWaybillSchema>;

export class FailWaybillDto implements FailWaybillPayload {
  @ApiProperty({
    example: 'Consignee warehouse closed upon arrival; security refused delivery',
    description: 'Mandatory reason for delivery failure',
  })
  @IsString()
  @IsNotEmpty({ message: 'A failure reason is mandatory.' })
  @MinLength(5, { message: 'Failure reason must be at least 5 characters.' })
  @MaxLength(500)
  failureReason!: string;

  @ApiPropertyOptional({ example: 'Returned consignment to Lagos Central Depot Bay 2', description: 'Additional return notes' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
