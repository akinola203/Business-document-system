import {
  Controller,
  Post,
  Patch,
  Param,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { LettersService } from './letters.service';
import { DocumentsService } from '../documents/documents.service';
import { CreateLetterDto } from './dto/create-letter.dto';
import { UpdateLetterDto } from './dto/update-letter.dto';
import { IssueDocumentDto } from '../documents/dto/issue-document.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@ApiTags('Letters & Letterheads')
@ApiBearerAuth('JWT-auth')
@Controller('letters')
export class LettersController {
  constructor(
    private readonly lettersService: LettersService,
    private readonly documentsService: DocumentsService,
  ) {}

  @Post()
  @RequirePermissions('letter:create')
  @ApiOperation({ summary: 'Create a new business letterhead draft with sequential reference' })
  @ApiResponse({ status: 201, description: 'Letter draft created.' })
  @ApiResponse({ status: 400, description: 'Missing required recipient or body.' })
  async createDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLetterDto,
  ) {
    return this.lettersService.createDraft(user.companyId, dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('letter:update')
  @ApiOperation({ summary: 'Update an editable draft letter' })
  @ApiResponse({ status: 200, description: 'Letter updated.' })
  @ApiResponse({ status: 400, description: 'Cannot edit issued letters.' })
  @ApiResponse({ status: 404, description: 'Letter not found.' })
  async updateDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateLetterDto,
  ) {
    return this.lettersService.updateDraft(user.companyId, id, dto, user.id);
  }

  @Post(':id/issue')
  @RequirePermissions('letter:issue')
  @ApiOperation({ summary: 'Issue official letter and freeze locked version snapshot (delegates to DocumentsService)' })
  @ApiResponse({ status: 200, description: 'Letter officially issued.' })
  async issue(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto?: IssueDocumentDto,
  ) {
    return this.documentsService.issue(user.companyId, id, dto || {}, user.id);
  }
}
