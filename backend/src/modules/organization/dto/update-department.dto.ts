import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, IsBoolean } from 'class-validator';

export class UpdateDepartmentDto {
  @ApiPropertyOptional({ example: 'Finance, Accounts & Treasury', description: 'Department display name' })
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  @ApiPropertyOptional({ example: 'Updated department remit', description: 'Operational description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: true, description: 'Active status indicator' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
