import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { QueryClientsDto } from './dto/query-clients.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { ClientStatus } from '@prisma/client';

@ApiTags('Clients & Addresses')
@ApiBearerAuth('JWT-auth')
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @RequirePermissions('clients:view')
  @ApiOperation({ summary: 'List clients with pagination, full-text search, and status filters' })
  @ApiResponse({ status: 200, description: 'Paginated client list retrieved.' })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryClientsDto,
  ) {
    return this.clientsService.findAll(user.companyId, query);
  }

  @Get(':id')
  @RequirePermissions('clients:view')
  @ApiOperation({ summary: 'Get full client profile by ID including all billing/shipping addresses' })
  @ApiResponse({ status: 200, description: 'Client profile retrieved.' })
  @ApiResponse({ status: 404, description: 'Client not found.' })
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.clientsService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions('clients:create')
  @ApiOperation({ summary: 'Create a new client with auto-generated or custom client code' })
  @ApiResponse({ status: 201, description: 'Client created successfully.' })
  @ApiResponse({ status: 409, description: 'Client number already exists in company.' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateClientDto,
  ) {
    return this.clientsService.create(user.companyId, dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('clients:update')
  @ApiOperation({ summary: 'Update client details and credit terms' })
  @ApiResponse({ status: 200, description: 'Client successfully updated.' })
  @ApiResponse({ status: 404, description: 'Client not found.' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clientsService.update(user.companyId, id, dto, user.id);
  }

  @Patch(':id/status')
  @RequirePermissions('clients:disable')
  @ApiOperation({ summary: 'Activate or deactivate a client' })
  @ApiResponse({ status: 200, description: 'Client status updated.' })
  @ApiResponse({ status: 404, description: 'Client not found.' })
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('status') status: ClientStatus,
  ) {
    return this.clientsService.updateStatus(user.companyId, id, status, user.id);
  }

  @Post(':id/addresses')
  @RequirePermissions('clients:update')
  @ApiOperation({ summary: 'Add a new billing, shipping, or office address to a client' })
  @ApiResponse({ status: 201, description: 'Address created successfully.' })
  @ApiResponse({ status: 404, description: 'Client not found.' })
  async addAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateAddressDto,
  ) {
    return this.clientsService.addAddress(user.companyId, id, dto, user.id);
  }

  @Patch(':id/addresses/:addressId')
  @RequirePermissions('clients:update')
  @ApiOperation({ summary: 'Update a specific client address' })
  @ApiResponse({ status: 200, description: 'Address updated successfully.' })
  @ApiResponse({ status: 404, description: 'Address not found.' })
  async updateAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('addressId') addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.clientsService.updateAddress(user.companyId, id, addressId, dto, user.id);
  }

  @Delete(':id/addresses/:addressId')
  @RequirePermissions('clients:update')
  @ApiOperation({ summary: 'Delete a client address' })
  @ApiResponse({ status: 200, description: 'Address deleted successfully.' })
  @ApiResponse({ status: 404, description: 'Address not found.' })
  async deleteAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('addressId') addressId: string,
  ) {
    return this.clientsService.deleteAddress(user.companyId, id, addressId, user.id);
  }
}
