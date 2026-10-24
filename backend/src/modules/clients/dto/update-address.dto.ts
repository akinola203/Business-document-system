import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { AddressType } from '@prisma/client';

export class UpdateAddressDto {
  @ApiPropertyOptional({ enum: AddressType, description: 'Address usage category' })
  @IsOptional()
  @IsEnum(AddressType)
  type?: AddressType;

  @ApiPropertyOptional({ example: 'Plot 45 Commercial Avenue', description: 'Primary street address' })
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @ApiPropertyOptional({ example: 'Suite 204, 2nd Floor', description: 'Secondary street or suite details' })
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiPropertyOptional({ example: 'Ota', description: 'City or municipality' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Ogun State', description: 'State, province, or region' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: 'Nigeria', description: 'Country name' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: '112233', description: 'Postal code' })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({ example: true, description: 'Mark as primary default for this address type' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
