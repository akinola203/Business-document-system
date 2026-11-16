import { Module } from '@nestjs/common';
import { CompaniesController, SettingsBrandingController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CompaniesController, SettingsBrandingController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
