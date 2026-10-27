import {
  Controller,
  Post,
  Patch,
  Param,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { DocumentsService } from '../documents/documents.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { SubmitDocumentDto } from '../documents/dto/submit-document.dto';
import { ApproveDocumentDto } from '../documents/dto/approve-document.dto';
import { IssueDocumentDto } from '../documents/dto/issue-document.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@ApiTags('Invoices')
@ApiBearerAuth('JWT-auth')
@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly documentsService: DocumentsService,
  ) {}

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
  @ApiOperation({ summary: 'Submit a draft invoice into PENDING_APPROVAL status (delegates to DocumentsService)' })
  @ApiResponse({ status: 200, description: 'Invoice submitted for approval.' })
  @ApiResponse({ status: 400, description: 'Invalid status transition or empty items.' })
  async submitForApproval(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto?: SubmitDocumentDto,
  ) {
    return this.documentsService.submitForApproval(user.companyId, id, dto || {}, user.id);
  }

  @Post(':id/approve')
  @RequirePermissions('invoice:approve')
  @ApiOperation({ summary: 'Approve an invoice (prohibits self-approval by policy, delegates to DocumentsService)' })
  @ApiResponse({ status: 200, description: 'Invoice approved.' })
  @ApiResponse({ status: 403, description: 'Self-approval forbidden.' })
  async approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto?: ApproveDocumentDto,
  ) {
    return this.documentsService.approve(user.companyId, id, dto || {}, user.id);
  }

  @Post(':id/issue')
  @RequirePermissions('invoice:issue')
  @ApiOperation({ summary: 'Issue an approved invoice, freezing legal snapshot and version (delegates to DocumentsService)' })
  @ApiResponse({ status: 200, description: 'Invoice officially issued.' })
  @ApiResponse({ status: 400, description: 'Invoice is not approved.' })
  async issue(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto?: IssueDocumentDto,
  ) {
    return this.documentsService.issue(user.companyId, id, dto || {}, user.id);
  }
}
