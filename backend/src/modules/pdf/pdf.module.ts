import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { FilesModule } from '../files/files.module';
import { TemplatesModule } from '../templates/templates.module';
import { PdfService } from './pdf.service';
import { PdfController } from './pdf.controller';

@Module({
  imports: [PrismaModule, AuditModule, FilesModule, TemplatesModule],
  controllers: [PdfController],
  providers: [PdfService],
  exports: [PdfService],
})
export class PdfModule {}
