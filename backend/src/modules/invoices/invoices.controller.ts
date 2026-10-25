import {
  Controller,
  Post,
  Patch,
  Param,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@ApiTags('Invoices')
@ApiBearerAuth('JWT-auth')
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @RequirePermissions('invoice:create')
  @ApiOperation({ summary: 'Create a new invoice draft with calculated line items and sequential number' })
  @ApiResponse({ status: 201, description: 'Invoice draft successfully created.' })
  @ApiResponse({ status: 400, description: 'Validation error in line items or parameters.' })
  async createDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.invoicesService.createDraft(user.companyId, dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('invoice:update')
  @ApiOperation({ summary: 'Update an editable draft invoice and recalculate totals' })
  @ApiResponse({ status: 200, description: 'Draft invoice successfully updated.' })
  @ApiResponse({ status: 400, description: 'Cannot edit non-draft invoices.' })
  @ApiResponse({ status: 404, description: 'Invoice not found.' })
  async updateDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.invoicesService.updateDraft(user.companyId, id, dto, user.id);
  }

  @Post(':id/submit')
  @RequirePermissions('invoice:submit')
  @ApiOperation({ summary: 'Submit a draft invoice into PENDING_APPROVAL status' })
  @ApiResponse({ status: 200, description: 'Invoice submitted for approval.' })
  @ApiResponse({ status: 400, description: 'Invalid status transition or empty items.' })
  async submitForApproval(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.invoicesService.submitForApproval(user.companyId, id, user.id);
  }

  @Post(':id/approve')
  @RequirePermissions('invoice:approve')
  @ApiOperation({ summary: 'Approve an invoice (prohibits self-approval by policy)' })
  @ApiResponse({ status: 200, description: 'Invoice approved.' })
  @ApiResponse({ status: 403, description: 'Self-approval forbidden.' })
  async approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('comment') comment?: string,
  ) {
    return this.invoicesService.approve(user.companyId, id, user.id, comment);
  }

  @Post(':id/issue')
  @RequirePermissions('invoice:issue')
  @ApiOperation({ summary: 'Issue an approved invoice, freezing legal snapshot and version 1' })
  @ApiResponse({ status: 200, description: 'Invoice officially issued.' })
  @ApiResponse({ status: 400, description: 'Invoice is not approved.' })
  async issue(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.invoicesService.issue(user.companyId, id, user.id);
  }
}
