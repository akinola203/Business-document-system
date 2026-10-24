import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { AddressType } from '@prisma/client';

export class CreateAddressDto {
  @ApiProperty({ enum: AddressType, default: AddressType.BILLING, description: 'Address usage category' })
  @IsOptional()
  @IsEnum(AddressType)
  type?: AddressType = AddressType.BILLING;

  @ApiProperty({ example: 'Plot 45 Commercial Avenue', description: 'Primary street address' })
  @IsNotEmpty()
  @IsString()
  addressLine1!: string;

  @ApiPropertyOptional({ example: 'Suite 204, 2nd Floor', description: 'Secondary street or suite details' })
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiProperty({ example: 'Ota', description: 'City or municipality' })
  @IsNotEmpty()
  @IsString()
  city!: string;

  @ApiProperty({ example: 'Ogun State', description: 'State, province, or region' })
  @IsNotEmpty()
  @IsString()
  state!: string;

  @ApiPropertyOptional({ example: 'Nigeria', default: 'Nigeria', description: 'Country name' })
  @IsOptional()
  @IsString()
  country?: string = 'Nigeria';

  @ApiPropertyOptional({ example: '112233', description: 'Postal code' })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({ example: true, default: false, description: 'Mark as primary default for this address type' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean = false;
}
