import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  IsObject,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCompanySettingsDto {
  @ApiPropertyOptional({ example: 'Globus Bank', description: 'Settlement bank name' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({ example: '1000652112', description: 'Corporate bank account number (e.g. NUBAN)' })
  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @ApiPropertyOptional({ example: 'AOA 77 COMPANY LTD', description: 'Account holder beneficiary name' })
  @IsOptional()
  @IsString()
  bankAccountName?: string;

  @ApiPropertyOptional({ example: '103', description: 'Bank sort code or routing number' })
  @IsOptional()
  @IsString()
  bankSortCode?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether bank payment details appear on invoice payment instructions',
  })
  @IsOptional()
  @IsBoolean()
  showBankDetailsOnInvoice?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether bank details appear on waybill documents (default false)',
  })
  @IsOptional()
  @IsBoolean()
  showBankDetailsOnWaybill?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether bank details appear on official corporate letters (default false)',
  })
  @IsOptional()
  @IsBoolean()
  showBankDetailsOnLetter?: boolean;

  @ApiPropertyOptional({ example: 7.50, description: 'Default percentage VAT rate' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  defaultVatRate?: number;

  @ApiPropertyOptional({ example: 30, description: 'Default invoice payment due window in days' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultPaymentTermsDays?: number;

  @ApiPropertyOptional({
    example: false,
    description: 'Enables or restricts creators approving their own documents',
  })
  @IsOptional()
  @IsBoolean()
  allowSelfApproval?: boolean;

  @ApiPropertyOptional({ description: 'Additional arbitrary company configuration metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
