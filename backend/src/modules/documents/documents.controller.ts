import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  ParseIntPipe,
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
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@ApiTags('Documents')
@ApiBearerAuth('JWT-auth')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'List all documents with full-text search, type, and status filtering' })
  @ApiResponse({ status: 200, description: 'Paginated document catalog retrieved.' })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryDocumentsDto,
  ) {
    return this.documentsService.findAll(user.companyId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full document details, line items, and approval history' })
  @ApiResponse({ status: 200, description: 'Document retrieved.' })
  @ApiResponse({ status: 404, description: 'Document not found.' })
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.documentsService.findOne(user.companyId, id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a document with mandatory justification' })
  @ApiResponse({ status: 200, description: 'Document successfully cancelled.' })
  @ApiResponse({ status: 400, description: 'Document cannot be cancelled.' })
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CancelDocumentDto,
  ) {
    return this.documentsService.cancel(user.companyId, id, dto, user.id);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Clone document into a new DRAFT with newly allocated number' })
  @ApiResponse({ status: 201, description: 'Document cloned into new DRAFT.' })
  async duplicate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
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
    return this.documentsService.submitForApproval(user.companyId, id, dto, user.id);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a pending document (anti-self-approval enforced)' })
  @ApiResponse({ status: 200, description: 'Document approved successfully.' })
  @ApiResponse({ status: 403, description: 'Self-approval prohibited.' })
  async approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ApproveDocumentDto,
  ) {
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
    return this.documentsService.reject(user.companyId, id, dto, user.id);
  }

  @Get(':id/approvals')
  @ApiOperation({ summary: 'Retrieve complete approval workflow audit history' })
  @ApiResponse({ status: 200, description: 'Approval history retrieved.' })
  async getApprovals(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
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
    return this.documentsService.createVersionSnapshot(user.companyId, id, dto, user.id);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'List all historical version snapshots for a document' })
  @ApiResponse({ status: 200, description: 'Version history list retrieved.' })
  async getVersions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
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
    return this.documentsService.setArchived(user.companyId, id, true, user.id);
  }

  @Post(':id/unarchive')
  @ApiOperation({ summary: 'Restore an archived document' })
  @ApiResponse({ status: 200, description: 'Document unarchived.' })
  async unarchive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.documentsService.setArchived(user.companyId, id, false, user.id);
  }
}
