import {
  Controller,
  Post,
  Patch,
  Param,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WaybillsService } from './waybills.service';
import { CreateWaybillDto } from './dto/create-waybill.dto';
import { UpdateWaybillDto } from './dto/update-waybill.dto';
import { StageWaybillReadyDto } from './dto/stage-waybill-ready.dto';
import { DispatchWaybillDto } from './dto/dispatch-waybill.dto';
import { FailWaybillDto } from './dto/fail-waybill.dto';
import { CompleteWaybillDto } from './dto/complete-waybill.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@ApiTags('Waybills & Delivery Notes')
@ApiBearerAuth('JWT-auth')
@Controller('waybills')
export class WaybillsController {
  constructor(private readonly waybillsService: WaybillsService) {}

  @Post()
  @RequirePermissions('waybill:create')
  @ApiOperation({ summary: 'Create a new waybill / delivery note draft' })
  @ApiResponse({ status: 201, description: 'Waybill draft created.' })
  @ApiResponse({ status: 400, description: 'Missing client or items.' })
  async createDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWaybillDto,
  ) {
    return this.waybillsService.createDraft(user.companyId, dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('waybill:update')
  @ApiOperation({ summary: 'Update an editable draft waybill' })
  @ApiResponse({ status: 200, description: 'Waybill updated.' })
  @ApiResponse({ status: 400, description: 'Cannot edit non-draft waybills.' })
  @ApiResponse({ status: 404, description: 'Waybill not found.' })
  async updateDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateWaybillDto,
  ) {
    return this.waybillsService.updateDraft(user.companyId, id, dto, user.id);
  }

  @Post(':id/ready')
  @RequirePermissions('waybill:dispatch')
  @ApiOperation({ summary: 'Stage cargo as READY for haulage / carrier pickup (allowed from PREPARING or FAILED)' })
  @ApiResponse({ status: 200, description: 'Consignment staged as READY.' })
  @ApiResponse({ status: 400, description: 'Parent document is not APPROVED/ISSUED or current status invalid.' })
  async stageReady(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: StageWaybillReadyDto,
  ) {
    return this.waybillsService.stageReady(user.companyId, id, dto, user.id);
  }

  @Post(':id/dispatch')
  @RequirePermissions('waybill:dispatch')
  @ApiOperation({ summary: 'Dispatch consignment into IN_TRANSIT status (freezes official snapshot if approved)' })
  @ApiResponse({ status: 200, description: 'Consignment dispatched.' })
  @ApiResponse({ status: 400, description: 'Cannot dispatch cancelled or completed document, or missing driver info.' })
  async dispatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: DispatchWaybillDto,
  ) {
    return this.waybillsService.dispatch(user.companyId, id, dto, user.id);
  }

  @Post(':id/fail')
  @RequirePermissions('waybill:dispatch')
  @ApiOperation({ summary: 'Record a failed delivery attempt (transitions IN_TRANSIT -> FAILED with mandatory reason)' })
  @ApiResponse({ status: 200, description: 'Delivery marked as FAILED; document remains ISSUED for re-staging.' })
  @ApiResponse({ status: 400, description: 'Waybill is not IN_TRANSIT.' })
  async fail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: FailWaybillDto,
  ) {
    return this.waybillsService.fail(user.companyId, id, dto, user.id);
  }

  @Post(':id/complete')
  @RequirePermissions('waybill:complete')
  @ApiOperation({ summary: 'Confirm delivery receipt and mark DELIVERED / COMPLETED' })
  @ApiResponse({ status: 200, description: 'Delivery confirmed.' })
  @ApiResponse({ status: 400, description: 'Already confirmed or not IN_TRANSIT.' })
  async complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CompleteWaybillDto,
  ) {
    return this.waybillsService.complete(user.companyId, id, dto, user.id);
  }
}
