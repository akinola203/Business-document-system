import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVersionDto {
  @ApiPropertyOptional({ description: 'Summary of modifications or reason for creating snapshot' })
  @IsOptional()
  @IsString()
  changeReason?: string;
}
