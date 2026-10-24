import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsEmail,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ClientType } from '@prisma/client';

export class UpdateClientDto {
  @ApiPropertyOptional({ enum: ClientType, description: 'Client entity classification' })
  @IsOptional()
  @IsEnum(ClientType)
  type?: ClientType;

  @ApiPropertyOptional({ example: 'Dangote Cement Distribution Hub', description: 'Trading or primary contact name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Dangote Industries Limited', description: 'Full legal/registered entity name' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ example: 'procurement@dangote-hub.ng', description: 'Billing/accounts email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+234 802 000 1111', description: 'Contact telephone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: '10998877-0001', description: 'Tax Identification Number (TIN)' })
  @IsOptional()
  @IsString()
  tin?: string;

  @ApiPropertyOptional({ example: 'Updated notes', description: 'Internal CRM notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 15000000.00, description: 'Credit limit for trade receivables' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  creditLimit?: number;
}
