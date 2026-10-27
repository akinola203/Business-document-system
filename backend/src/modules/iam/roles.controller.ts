import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@ApiTags('Roles & Permissions')
@ApiBearerAuth('JWT-auth')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions('users:view')
  @ApiOperation({ summary: 'List all company roles with attached permissions and user counts' })
  @ApiResponse({ status: 200, description: 'List of company and system roles.' })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.rolesService.findAllRoles(user.companyId);
  }

  @Post()
  @RequirePermissions('roles:manage')
  @ApiOperation({ summary: 'Create a custom role scoped to the calling company' })
  @ApiResponse({ status: 201, description: 'Custom role created successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid role parameters or permission IDs.' })
  @ApiResponse({ status: 409, description: 'Role name already exists in this company.' })
  async createRole(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRoleDto,
  ) {
    return this.rolesService.createRole(user.companyId, dto, user.id);
  }

  @Patch(':id/permissions')
  @RequirePermissions('roles:manage')
  @ApiOperation({ summary: 'Update permissions on a role with Admin lockout prevention' })
  @ApiResponse({ status: 200, description: 'Role permissions updated successfully.' })
  @ApiResponse({ status: 400, description: 'Cannot strip core administrative permissions from the Admin role.' })
  @ApiResponse({ status: 404, description: 'Role not found.' })
  async updateRolePermissions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    return this.rolesService.updateRolePermissions(user.companyId, id, dto, user.id);
  }
}
