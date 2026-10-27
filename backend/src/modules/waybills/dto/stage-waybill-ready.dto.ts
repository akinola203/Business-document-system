import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { z } from 'zod';

export const stageWaybillReadySchema = z.object({
  stagedBy: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

export type StageWaybillReadyPayload = z.infer<typeof stageWaybillReadySchema>;

export class StageWaybillReadyDto implements StageWaybillReadyPayload {
  @ApiPropertyOptional({ example: 'Sikiru Alao', description: 'Warehouse / depot personnel who staged the cargo' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  stagedBy?: string;

  @ApiPropertyOptional({ example: 'Palletized and staged at Bay 4 for haulage pickup', description: 'Staging notes' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
