import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@ApiTags('Roles & Permissions')
@ApiBearerAuth('JWT-auth')
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions('users:view')
  @ApiOperation({ summary: 'Master catalog of all available system permissions grouped by domain' })
  @ApiResponse({ status: 200, description: 'Catalog of system permissions.' })
  async findAll() {
    return this.rolesService.findAllPermissions();
  }
}
