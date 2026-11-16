import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NumberingModule } from '../numbering/numbering.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentConversionService } from './document-conversion.service';

@Module({
  imports: [PrismaModule, NumberingModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentConversionService],
  exports: [DocumentsService, DocumentConversionService],
})
export class DocumentsModule {}
