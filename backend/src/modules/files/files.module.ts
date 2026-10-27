import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { LocalStorageService } from './storage/local-storage.service';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [FilesController],
  providers: [LocalStorageService, FilesService],
  exports: [FilesService, LocalStorageService],
})
export class FilesModule {}
