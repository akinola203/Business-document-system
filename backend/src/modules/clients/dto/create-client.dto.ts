import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsEmail,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ClientType } from '@prisma/client';
import { CreateAddressDto } from './create-address.dto';

export class CreateClientDto {
  @ApiPropertyOptional({ example: 'CLI-00001', description: 'Unique client code (auto-generated if omitted)' })
  @IsOptional()
  @IsString()
  clientNumber?: string;

  @ApiPropertyOptional({ enum: ClientType, default: ClientType.COMPANY, description: 'Client entity classification' })
  @IsOptional()
  @IsEnum(ClientType)
  type?: ClientType = ClientType.COMPANY;

  @ApiProperty({ example: 'Dangote Cement Distribution Hub', description: 'Trading or primary contact name' })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'Dangote Industries Limited', description: 'Full legal/registered entity name' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ example: 'procurement@dangote-hub.ng', description: 'Billing/accounts email address' })
  @Transform(({ value }: { value: any }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
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

  @ApiPropertyOptional({ example: 'Major industrial client in Ota industrial corridor', description: 'Internal CRM notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 10000000.00, description: 'Credit limit for trade receivables' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  creditLimit?: number;

  @ApiPropertyOptional({ type: [CreateAddressDto], description: 'Optional list of initial billing/shipping addresses' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAddressDto)
  addresses?: CreateAddressDto[];
}
