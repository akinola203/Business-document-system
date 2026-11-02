import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@ApiTags('User Administration')
@ApiBearerAuth('JWT-auth')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Paginated, searchable list of company users with roles, status, and lastLoginAt' })
  @ApiResponse({ status: 200, description: 'Paginated user list retrieved.' })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryUsersDto,
  ) {
    return this.usersService.findAll(user.companyId, query);
  }

  @Post()
  @RequirePermissions('users:create')
  @ApiOperation({ summary: 'Create or invite a new user into the company with an initial role and department' })
  @ApiResponse({ status: 201, description: 'User account created or assigned successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid user parameters.' })
  @ApiResponse({ status: 409, description: 'User is already assigned to this company.' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUserDto,
  ) {
    return this.usersService.create(user.companyId, dto, user.id);
  }

  @Patch('me/profile')
  @ApiOperation({ summary: "Update the authenticated user's own profile (name, email, phone, password)" })
  @ApiResponse({ status: 200, description: 'Own profile updated successfully.' })
  async updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateUserProfileDto,
  ) {
    return this.usersService.updateProfile(user.companyId, user.id, dto, user);
  }

  @Patch(':id/profile')
  @ApiOperation({
    summary: 'Update user profile and credentials (Admins can edit any user; non-admins can only edit themselves)',
  })
  @ApiResponse({ status: 200, description: 'User profile updated successfully.' })
  @ApiResponse({ status: 403, description: 'Non-admin attempted to edit another user.' })
  async updateUserProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserProfileDto,
  ) {
    return this.usersService.updateProfile(user.companyId, id, dto, user);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update user profile and credentials alias (Admins can edit any user; non-admins can only edit themselves)',
  })
  @ApiResponse({ status: 200, description: 'User profile updated successfully.' })
  @ApiResponse({ status: 403, description: 'Non-admin attempted to edit another user.' })
  async updateUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserProfileDto,
  ) {
    return this.usersService.updateProfile(user.companyId, id, dto, user);
  }

  @Patch(':id/role')
  @RequirePermissions('users:update')
  @ApiOperation({ summary: "Update a company user's assigned role with anti-lockout safety guardrails" })
  @ApiResponse({ status: 200, description: 'User role updated successfully.' })
  @ApiResponse({ status: 400, description: 'Cannot demote the last active Admin of the company.' })
  @ApiResponse({ status: 404, description: 'User or Role not found.' })
  async updateRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.usersService.updateRole(user.companyId, id, dto, user.id);
  }

  @Patch(':id/status')
  @RequirePermissions('users:disable')
  @ApiOperation({ summary: 'Activate or deactivate/suspend a user, invalidating active sessions upon deactivation' })
  @ApiResponse({ status: 200, description: 'User status updated successfully.' })
  @ApiResponse({ status: 400, description: 'Cannot deactivate yourself or the last active Admin.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.usersService.updateStatus(user.companyId, id, dto, user.id);
  }

  @Post(':id/reset-password')
  @RequirePermissions('users:update')
  @ApiOperation({ summary: 'Admin-triggered password reset, revoking all existing user sessions' })
  @ApiResponse({ status: 200, description: 'Password reset and sessions revoked.' })
  @ApiResponse({ status: 404, description: 'User not found in company.' })
  async resetPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ResetUserPasswordDto,
  ) {
    return this.usersService.resetPassword(user.companyId, id, dto, user.id);
  }
}
