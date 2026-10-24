import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, IsBoolean, IsEmail } from 'class-validator';

export class UpdateBranchDto {
  @ApiPropertyOptional({ example: 'Ota Central Hub & HQ', description: 'Branch display name' })
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

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

  @ApiPropertyOptional({ example: true, description: 'Active status indicator' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
