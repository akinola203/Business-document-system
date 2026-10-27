import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NumberingModule } from '../numbering/numbering.module';
import { WaybillsController } from './waybills.controller';
import { WaybillsService } from './waybills.service';

import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [PrismaModule, NumberingModule, DocumentsModule],
  controllers: [WaybillsController],
  providers: [WaybillsService],
  exports: [WaybillsService],
})
export class WaybillsModule {}
