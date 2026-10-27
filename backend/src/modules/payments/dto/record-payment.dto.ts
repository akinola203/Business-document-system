import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class RecordPaymentDto {
  /**
   * Monetary amount as a decimal STRING (e.g. "250000.00") so it never passes through
   * JavaScript floating point. Max 12 integer digits and 2 decimal places (matches NUMERIC(14,2)).
   */
  @ApiProperty({ example: '250000.00', description: 'Amount received, as a decimal string with up to 2 decimal places' })
  @IsString()
  @Matches(/^\d{1,12}(\.\d{1,2})?$/, {
    message: 'amount must be a positive decimal string with at most 12 digits and 2 decimal places (e.g. "250000.00").',
  })
  amount!: string;

  @ApiPropertyOptional({ example: 'NGN', description: 'Must match the invoice currency. Defaults to the invoice currency.' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiProperty({ example: '2026-10-26', description: 'Date the funds were received. Cannot be in the future.' })
  @IsDateString()
  paymentDate!: string;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.BANK_TRANSFER })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiProperty({ example: 'GLB-TRF-20261026-88412', description: 'Bank transfer / teller / cheque reference' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  referenceNumber!: string;

  @ApiPropertyOptional({ example: 'Part payment for first delivery batch' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Must be true to record an amount larger than the outstanding balance (creates an OVERPAID credit).',
  })
  @IsOptional()
  @IsBoolean()
  acknowledgeOverpayment?: boolean;
}
