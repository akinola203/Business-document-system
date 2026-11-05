import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NumberingModule } from '../numbering/numbering.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { DocumentsModule } from '../documents/documents.module';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';

@Module({
  imports: [PrismaModule, NumberingModule, DocumentsModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, RateLimitGuard],
  exports: [InvoicesService, RateLimitGuard],
})
export class InvoicesModule {}
