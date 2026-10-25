import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { QueryDocumentsDto } from './dto/query-documents.dto';
import { CancelDocumentDto } from './dto/cancel-document.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

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
}
