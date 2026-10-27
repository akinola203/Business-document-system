import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { CompanyUserStatus } from '@prisma/client';

export class QueryUsersDto {
  @ApiPropertyOptional({ example: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, description: 'Items per page' })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ example: 'adeyemi', description: 'Search query across name and email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'role-uuid-1', description: 'Filter by Role ID' })
  @IsOptional()
  @IsString()
  roleId?: string;

  @ApiPropertyOptional({ enum: CompanyUserStatus, example: CompanyUserStatus.ACTIVE, description: 'Filter by status' })
  @IsOptional()
  @IsEnum(CompanyUserStatus)
  status?: CompanyUserStatus;
}
