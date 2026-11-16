import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NumberingModule } from '../numbering/numbering.module';
import { WaybillsController } from './waybills.controller';
import { WaybillsService } from './waybills.service';
import { BatchWaybillService } from './batch-waybill.service';
import { DocumentsModule } from '../documents/documents.module';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';

@Module({
  imports: [PrismaModule, NumberingModule, DocumentsModule],
  controllers: [WaybillsController],
  providers: [WaybillsService, BatchWaybillService, RateLimitGuard],
  exports: [WaybillsService, BatchWaybillService, RateLimitGuard],
})
export class WaybillsModule { }
