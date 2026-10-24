import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, IsOptional, IsEmail } from 'class-validator';

export class CreateBranchDto {
  @ApiProperty({ example: 'OTA-HQ', description: 'Unique code for branch within company' })
  @IsNotEmpty()
  @IsString()
  @Length(2, 20)
  code!: string;

  @ApiProperty({ example: 'Ota Headquarters', description: 'Branch display name' })
  @IsNotEmpty()
  @IsString()
  @Length(2, 100)
  name!: string;

  @ApiPropertyOptional({ example: '1 Alade Ibukun Close, Ayo Irewolede CDA, Ewupe, Ota, Ogun State', description: 'Physical branch address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '+234 803 000 0001', description: 'Branch contact telephone' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'ota-hq@aoa77.com', description: 'Branch official email' })
  @IsOptional()
  @IsEmail()
  email?: string;
}
