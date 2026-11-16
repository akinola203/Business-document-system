import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsNotEmpty, IsString } from 'class-validator';

export class CreateBatchWaybillDto {
  @ApiProperty({
    description: 'Array of invoice IDs (or invoice document IDs) to consolidate into a master waybill manifest',
    example: ['inv-uuid-1', 'inv-uuid-2'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one invoice ID is required for batch waybill generation.' })
  @IsString({ each: true })
  invoiceIds!: string[];

  @ApiProperty({
    description: 'Target delivery zone / route identifier',
    example: 'LAGOS-EPE-ZONE-A',
  })
  @IsString()
  @IsNotEmpty({ message: 'Delivery zone is required.' })
  deliveryZone!: string;
}

