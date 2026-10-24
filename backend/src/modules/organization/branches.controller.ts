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
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@ApiTags('Branches')
@ApiBearerAuth('JWT-auth')
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @RequirePermissions('company:view')
  @ApiOperation({ summary: 'List all company branch offices and depots' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Branch list retrieved.' })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('isActive', new ParseBoolPipe({ optional: true })) isActive?: boolean,
  ) {
    return this.branchesService.findAll(user.companyId, isActive);
  }

  @Get(':id')
  @RequirePermissions('company:view')
  @ApiOperation({ summary: 'Get branch by ID' })
  @ApiResponse({ status: 200, description: 'Branch details retrieved.' })
  @ApiResponse({ status: 404, description: 'Branch not found.' })
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.branchesService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions('company:update')
  @ApiOperation({ summary: 'Create a new branch office or depot' })
  @ApiResponse({ status: 201, description: 'Branch created successfully.' })
  @ApiResponse({ status: 409, description: 'Branch code already exists.' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBranchDto,
  ) {
    return this.branchesService.create(user.companyId, dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('company:update')
  @ApiOperation({ summary: 'Update an existing branch' })
  @ApiResponse({ status: 200, description: 'Branch updated successfully.' })
  @ApiResponse({ status: 404, description: 'Branch not found.' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.branchesService.update(user.companyId, id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermissions('company:update')
  @ApiOperation({ summary: 'Deactivate a branch' })
  @ApiResponse({ status: 200, description: 'Branch deactivated successfully.' })
  @ApiResponse({ status: 404, description: 'Branch not found.' })
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.branchesService.remove(user.companyId, id, user.id);
  }
}
