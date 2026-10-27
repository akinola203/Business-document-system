import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NumberingModule } from '../numbering/numbering.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [PrismaModule, NumberingModule, DocumentsModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
