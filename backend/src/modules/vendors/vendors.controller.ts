import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { VendorsService } from './vendors.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { QueryVendorsDto } from './dto/query-vendors.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Vendors & Suppliers')
@ApiBearerAuth('JWT-auth')
@Controller('vendors')
@UseGuards(PermissionsGuard)
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get()
  @RequirePermissions('vendors:view')
  @ApiOperation({ summary: 'List all company vendors with search, category, and status filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of vendors retrieved.' })
  async findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryVendorsDto) {
    return this.vendorsService.findAll(user.companyId, query);
  }

  @Post()
  @RequirePermissions('vendors:manage')
  @ApiOperation({ summary: 'Register a new vendor/supplier profile with payout details' })
  @ApiResponse({ status: 201, description: 'Vendor created successfully.' })
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateVendorDto) {
    return this.vendorsService.create(user.companyId, dto, user.id);
  }

  @Get(':id')
  @RequirePermissions('vendors:view')
  @ApiOperation({ summary: 'Get 360° vendor profile with supplied catalog items and order history' })
  @ApiResponse({ status: 200, description: 'Vendor details retrieved.' })
  @ApiResponse({ status: 404, description: 'Vendor not found.' })
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.vendorsService.findOne(user.companyId, id);
  }

  @Patch(':id')
  @RequirePermissions('vendors:manage')
  @ApiOperation({ summary: 'Update vendor profile information, payout bank, or status' })
  @ApiResponse({ status: 200, description: 'Vendor updated successfully.' })
  @ApiResponse({ status: 404, description: 'Vendor not found.' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateVendorDto,
  ) {
    return this.vendorsService.update(user.companyId, id, dto, user.id);
  }
}
