import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  ParseIntPipe,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { QueryDocumentsDto } from './dto/query-documents.dto';
import { CancelDocumentDto } from './dto/cancel-document.dto';
import { SubmitDocumentDto } from './dto/submit-document.dto';
import { ApproveDocumentDto } from './dto/approve-document.dto';
import { RejectDocumentDto } from './dto/reject-document.dto';
import { CreateVersionDto } from './dto/create-version.dto';
import { CompareVersionsDto } from './dto/compare-versions.dto';
import { IssueDocumentDto } from './dto/issue-document.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  DocumentAction,
  assertDocumentPermission,
  viewableDocumentTypes,
} from './utils/document-permissions.util';

/**
 * Generic, cross-type document routes.
 *
 * Authorization: these routes cannot use a static @RequirePermissions decorator because the required
 * permission depends on the document's type (e.g. approving an invoice needs invoice:approve, a letter
 * needs letter:approve). Every handler therefore resolves the type and calls `authorize()` first.
 * See DOCUMENT_PERMISSION_MATRIX in utils/document-permissions.util.ts.
 */
@ApiTags('Documents')
@ApiBearerAuth('JWT-auth')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  private async authorize(user: AuthenticatedUser, id: string, action: DocumentAction) {
    const documentType = await this.documentsService.getDocumentType(user.companyId, id);
    assertDocumentPermission(user, documentType, action);
  }

  @Get()
  @ApiOperation({ summary: 'List documents the caller may view, with search, type, and status filtering' })
  @ApiResponse({ status: 200, description: 'Paginated document catalog retrieved.' })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryDocumentsDto,
  ) {
    const allowedTypes = viewableDocumentTypes(user);
    if (allowedTypes.length === 0) {
      throw new ForbiddenException('Access denied. You lack permission to view any document type.');
    }
    if (query.documentType && !allowedTypes.includes(query.documentType)) {
      assertDocumentPermission(user, query.documentType, 'view');
    }
    return this.documentsService.findAll(user.companyId, query, allowedTypes);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full document details, line items, and approval history' })
  @ApiResponse({ status: 200, description: 'Document retrieved.' })
  @ApiResponse({ status: 404, description: 'Document not found.' })
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.authorize(user, id, 'view');
    return this.documentsService.findOne(user.companyId, id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a document with mandatory justification' })
  @ApiResponse({ status: 200, description: 'Document successfully cancelled.' })
  @ApiResponse({ status: 400, description: 'Document cannot be cancelled (e.g. invoice has active payments).' })
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CancelDocumentDto,
  ) {
    await this.authorize(user, id, 'cancel');
    return this.documentsService.cancel(user.companyId, id, dto, user.id);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Clone document into a new DRAFT with newly allocated number' })
  @ApiResponse({ status: 201, description: 'Document cloned into new DRAFT.' })
  async duplicate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.authorize(user, id, 'duplicate');
    return this.documentsService.duplicate(user.companyId, id, user.id);
  }

  // ---------------------------------------------------------------------------
  // APPROVALS WORKFLOW
  // ---------------------------------------------------------------------------

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit a DRAFT or REJECTED document for approval' })
  @ApiResponse({ status: 200, description: 'Document submitted for approval.' })
  async submitForApproval(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SubmitDocumentDto,
  ) {
    await this.authorize(user, id, 'submit');
    return this.documentsService.submitForApproval(user.companyId, id, dto, user.id);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a pending document (anti-self-approval enforced)' })
  @ApiResponse({ status: 200, description: 'Document approved successfully.' })
  @ApiResponse({ status: 403, description: 'Missing permission or self-approval prohibited.' })
  async approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ApproveDocumentDto,
  ) {
    await this.authorize(user, id, 'approve');
    return this.documentsService.approve(user.companyId, id, dto, user.id);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a pending document with mandatory reason' })
  @ApiResponse({ status: 200, description: 'Document rejected.' })
  async reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RejectDocumentDto,
  ) {
    await this.authorize(user, id, 'reject');
    return this.documentsService.reject(user.companyId, id, dto, user.id);
  }

  @Post(':id/issue')
  @ApiOperation({ summary: 'Issue an approved document and freeze official legal version' })
  @ApiResponse({ status: 200, description: 'Document issued; version snapshot locked.' })
  @ApiResponse({ status: 400, description: 'Document not approved or missing items.' })
  @ApiResponse({ status: 409, description: 'Concurrent edit conflict (OCC).' })
  async issue(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: IssueDocumentDto,
  ) {
    await this.authorize(user, id, 'issue');
    return this.documentsService.issue(user.companyId, id, dto, user.id);
  }

  @Get(':id/approvals')
  @ApiOperation({ summary: 'Retrieve complete approval workflow audit history' })
  @ApiResponse({ status: 200, description: 'Approval history retrieved.' })
  async getApprovals(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.authorize(user, id, 'view');
    return this.documentsService.getApprovals(user.companyId, id);
  }

  // ---------------------------------------------------------------------------
  // IMMUTABLE VERSION HISTORY & COMPARISON
  // ---------------------------------------------------------------------------

  @Post(':id/versions')
  @ApiOperation({ summary: 'Create an explicit immutable version snapshot' })
  @ApiResponse({ status: 201, description: 'Document version snapshot created.' })
  async createVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateVersionDto,
  ) {
    await this.authorize(user, id, 'version');
    return this.documentsService.createVersionSnapshot(user.companyId, id, dto, user.id);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'List all historical version snapshots for a document' })
  @ApiResponse({ status: 200, description: 'Version history list retrieved.' })
  async getVersions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.authorize(user, id, 'view');
    return this.documentsService.getVersions(user.companyId, id);
  }

  @Get(':id/versions-compare')
  @ApiOperation({ summary: 'Compare two version snapshots and generate difference report' })
  @ApiResponse({ status: 200, description: 'Version difference report generated.' })
  async compareVersions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: CompareVersionsDto,
  ) {
    await this.authorize(user, id, 'view');
    return this.documentsService.compareVersions(user.companyId, id, query.from, query.to);
  }

  @Get(':id/versions/:versionNumber')
  @ApiOperation({ summary: 'Retrieve complete frozen JSON snapshot for a specific version' })
  @ApiResponse({ status: 200, description: 'Version snapshot retrieved.' })
  @ApiResponse({ status: 404, description: 'Version not found.' })
  async getVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('versionNumber', ParseIntPipe) versionNumber: number,
  ) {
    await this.authorize(user, id, 'view');
    return this.documentsService.getVersion(user.companyId, id, versionNumber);
  }

  // ---------------------------------------------------------------------------
  // ARCHIVAL
  // ---------------------------------------------------------------------------

  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive a document' })
  @ApiResponse({ status: 200, description: 'Document archived.' })
  async archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.authorize(user, id, 'archive');
    return this.documentsService.setArchived(user.companyId, id, true, user.id);
  }

  @Post(':id/unarchive')
  @ApiOperation({ summary: 'Restore an archived document' })
  @ApiResponse({ status: 200, description: 'Document unarchived.' })
  async unarchive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.authorize(user, id, 'archive');
    return this.documentsService.setArchived(user.companyId, id, false, user.id);
  }
}
