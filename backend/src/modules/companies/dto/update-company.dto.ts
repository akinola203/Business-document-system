import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEmail, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateCompanyDto {
  @ApiPropertyOptional({ example: 'AOA 77 COMPANY LTD', description: 'Trading or brand name' })
  @IsOptional()
  @IsString()
  @Length(2, 255)
  name?: string;

  @ApiPropertyOptional({ example: 'AOA 77 COMPANY LTD', description: 'Officially registered corporate legal name' })
  @IsOptional()
  @IsString()
  @Length(2, 255)
  legalName?: string;

  @ApiPropertyOptional({ example: '9905345...', description: 'Corporate Affairs Commission registration number (RC)' })
  @IsOptional()
  @IsString()
  rcNumber?: string;

  @ApiPropertyOptional({ example: '2622739227683', description: 'Tax Identification Number (TIN)' })
  @IsOptional()
  @IsString()
  tin?: string;

  @ApiPropertyOptional({
    example: '1 Alade Ibukun Close, Ayo Irewolede CDA, Ewupe, Ota, Ogun State, Nigeria',
    description: 'Corporate headquarters or registered business address',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'contact@aoa77.com', description: 'Official corporate inquiry email' })
  @Transform(({ value }: { value: any }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+234 803 000 0000', description: 'Primary corporate telephone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'https://aoa77.com', description: 'Corporate website URL' })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({ example: 'NGN', description: 'Default transaction and invoicing currency code' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  defaultCurrency?: string;
}
