import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { UsersService } from './users.service';
import { RolesService } from './roles.service';
import { UsersController } from './users.controller';
import { RolesController } from './roles.controller';
import { PermissionsController } from './permissions.controller';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [UsersController, RolesController, PermissionsController],
  providers: [UsersService, RolesService],
  exports: [UsersService, RolesService],
})
export class IamModule {}
