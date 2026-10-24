import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, IsOptional } from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'ACCT', description: 'Unique code for department within company' })
  @IsNotEmpty()
  @IsString()
  @Length(2, 20)
  code!: string;

  @ApiProperty({ example: 'Finance & Accounts', description: 'Department display name' })
  @IsNotEmpty()
  @IsString()
  @Length(2, 100)
  name!: string;

  @ApiPropertyOptional({ example: 'Invoicing, financial ledger, and credit control', description: 'Operational description' })
  @IsOptional()
  @IsString()
  description?: string;
}
