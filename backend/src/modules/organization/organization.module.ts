import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';

@Module({
  imports: [PrismaModule],
  controllers: [DepartmentsController, BranchesController],
  providers: [DepartmentsService, BranchesService],
  exports: [DepartmentsService, BranchesService],
})
export class OrganizationModule {}
