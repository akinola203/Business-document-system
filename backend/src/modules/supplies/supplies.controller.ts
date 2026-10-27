import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SuppliesService } from './supplies.service';
import { CreateSupplyItemDto } from './dto/create-supply-item.dto';
import { UpdateSupplyItemDto } from './dto/update-supply-item.dto';
import { QuerySupplyItemsDto } from './dto/query-supply-items.dto';
import { CreateSupplyOrderDto } from './dto/create-supply-order.dto';
import { UpdateSupplyOrderStatusDto } from './dto/update-supply-order-status.dto';
import { QuerySupplyOrdersDto } from './dto/query-supply-orders.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Supplies & Products Catalog')
@ApiBearerAuth('JWT-auth')
@Controller('supplies')
@UseGuards(PermissionsGuard)
export class SuppliesController {
  constructor(private readonly suppliesService: SuppliesService) {}

  // ===========================================================================
  // ITEMS CATALOG
  // ===========================================================================

  @Get('items')
  @RequirePermissions('supplies:view')
  @ApiOperation({ summary: 'List products and supplies catalog with low stock filtering' })
  @ApiResponse({ status: 200, description: 'Catalog items retrieved.' })
  async findAllItems(@CurrentUser() user: AuthenticatedUser, @Query() query: QuerySupplyItemsDto) {
    return this.suppliesService.findAllItems(user.companyId, query);
  }

  @Post('items')
  @RequirePermissions('supplies:manage')
  @ApiOperation({ summary: 'Add a new product/material/service to company catalog' })
  @ApiResponse({ status: 201, description: 'Catalog item created.' })
  async createItem(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSupplyItemDto) {
    return this.suppliesService.createItem(user.companyId, dto, user.id);
  }

  @Patch('items/:id')
  @RequirePermissions('supplies:manage')
  @ApiOperation({ summary: 'Update catalog item pricing, details, or stock levels' })
  @ApiResponse({ status: 200, description: 'Catalog item updated.' })
  async updateItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateSupplyItemDto,
  ) {
    return this.suppliesService.updateItem(user.companyId, id, dto, user.id);
  }

  // ===========================================================================
  // VENDOR SUPPLY ORDERS (PURCHASE RECEIPTS)
  // ===========================================================================

  @Get('orders')
  @RequirePermissions('supplies:view')
  @ApiOperation({ summary: 'List incoming vendor supply delivery receipts and orders' })
  @ApiResponse({ status: 200, description: 'Supply orders retrieved.' })
  async findAllOrders(@CurrentUser() user: AuthenticatedUser, @Query() query: QuerySupplyOrdersDto) {
    return this.suppliesService.findAllOrders(user.companyId, query);
  }

  @Get('orders/:id')
  @RequirePermissions('supplies:view')
  @ApiOperation({ summary: 'Get details of a specific vendor supply order with line items' })
  @ApiResponse({ status: 200, description: 'Supply order retrieved.' })
  async findOneOrder(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.suppliesService.findOneOrder(user.companyId, id);
  }

  @Post('orders')
  @RequirePermissions('supplies:manage')
  @ApiOperation({ summary: 'Record an incoming vendor supply receipt or purchase order' })
  @ApiResponse({ status: 201, description: 'Supply order recorded.' })
  async createOrder(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSupplyOrderDto) {
    return this.suppliesService.createOrder(user.companyId, dto, user.id);
  }

  @Patch('orders/:id/status')
  @RequirePermissions('supplies:manage')
  @ApiOperation({ summary: 'Update order status (e.g. RECEIVED auto-increments stock in transaction)' })
  @ApiResponse({ status: 200, description: 'Supply order status updated.' })
  async updateOrderStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateSupplyOrderStatusDto,
  ) {
    return this.suppliesService.updateOrderStatus(user.companyId, id, dto, user.id);
  }
}
