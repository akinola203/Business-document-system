import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { z } from 'zod';

export const dispatchWaybillSchema = z.object({
  vehicleNumber: z.string().trim().min(1, 'Vehicle number is required for dispatch').max(50),
  driverName: z.string().trim().min(1, 'Driver name is required for dispatch').max(100),
  driverPhone: z.string().trim().min(1, 'Driver contact phone is required for dispatch').max(30),
  trackingNumber: z.string().trim().max(100).optional(),
});

export type DispatchWaybillPayload = z.infer<typeof dispatchWaybillSchema>;

export class DispatchWaybillDto implements DispatchWaybillPayload {
  @ApiProperty({ example: 'OG-458-APP', description: 'Assigned haulage vehicle registration' })
  @IsString()
  @IsNotEmpty({ message: 'Vehicle number is required for dispatch.' })
  @MaxLength(50)
  vehicleNumber!: string;

  @ApiProperty({ example: 'Sunday Babatunde', description: 'Assigned driver name' })
  @IsString()
  @IsNotEmpty({ message: 'Driver name is required for dispatch.' })
  @MaxLength(100)
  driverName!: string;

  @ApiProperty({ example: '+234 803 555 6677', description: 'Assigned driver contact phone' })
  @IsString()
  @IsNotEmpty({ message: 'Driver contact phone is required for dispatch.' })
  @MaxLength(30)
  driverPhone!: string;

  @ApiPropertyOptional({ example: 'TRK-2026-9042', description: 'Dispatch tracking reference' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  trackingNumber?: string;
}
