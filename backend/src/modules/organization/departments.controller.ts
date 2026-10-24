import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseBoolPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@ApiTags('Departments')
@ApiBearerAuth('JWT-auth')
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @RequirePermissions('company:view')
  @ApiOperation({ summary: 'List all company departments' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Department list retrieved.' })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('isActive', new ParseBoolPipe({ optional: true })) isActive?: boolean,
  ) {
    return this.departmentsService.findAll(user.companyId, isActive);
  }

  @Get(':id')
  @RequirePermissions('company:view')
  @ApiOperation({ summary: 'Get department by ID' })
  @ApiResponse({ status: 200, description: 'Department details retrieved.' })
  @ApiResponse({ status: 404, description: 'Department not found.' })
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.departmentsService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions('company:update')
  @ApiOperation({ summary: 'Create a new department' })
  @ApiResponse({ status: 201, description: 'Department created successfully.' })
  @ApiResponse({ status: 409, description: 'Department code already exists.' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDepartmentDto,
  ) {
    return this.departmentsService.create(user.companyId, dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('company:update')
  @ApiOperation({ summary: 'Update an existing department' })
  @ApiResponse({ status: 200, description: 'Department updated successfully.' })
  @ApiResponse({ status: 404, description: 'Department not found.' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(user.companyId, id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermissions('company:update')
  @ApiOperation({ summary: 'Deactivate a department' })
  @ApiResponse({ status: 200, description: 'Department deactivated successfully.' })
  @ApiResponse({ status: 404, description: 'Department not found.' })
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.departmentsService.remove(user.companyId, id, user.id);
  }
}
