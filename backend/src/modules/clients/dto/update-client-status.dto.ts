import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { ClientStatus } from '@prisma/client';

export class UpdateClientStatusDto {
  @ApiProperty({ enum: ClientStatus, example: ClientStatus.ACTIVE, description: 'Client lifecycle status' })
  @IsNotEmpty()
  @IsEnum(ClientStatus)
  status!: ClientStatus;
}

