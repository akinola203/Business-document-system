import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CompareVersionsDto {
  @ApiProperty({ description: 'Source version number (e.g. 1)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  from!: number;

  @ApiProperty({ description: 'Target version number to compare against (e.g. 2)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  to!: number;
}
