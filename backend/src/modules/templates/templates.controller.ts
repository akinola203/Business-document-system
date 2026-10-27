import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Header,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DocumentType } from '@prisma/client';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Templates & Renderers')
@ApiBearerAuth('JWT-auth')
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'List all document layout templates for the tenant company' })
  @ApiQuery({ name: 'documentType', enum: DocumentType, required: false })
  @ApiResponse({ status: 200, description: 'Templates list.' })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('documentType') documentType?: DocumentType,
  ) {
    return this.templatesService.findAll(user.companyId, documentType);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve template details and version history' })
  @ApiResponse({ status: 200, description: 'Template with versions.' })
  @ApiResponse({ status: 404, description: 'Template not found.' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.templatesService.findOne(user.companyId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Register a new document template layout' })
  @ApiResponse({ status: 201, description: 'Template registered.' })
  @ApiResponse({ status: 400, description: 'Duplicate code or invalid schema.' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTemplateDto,
  ) {
    return this.templatesService.create(user.companyId, dto, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update template metadata or publish a new layout version' })
  @ApiResponse({ status: 200, description: 'Template updated.' })
  @ApiResponse({ status: 404, description: 'Template not found.' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templatesService.update(user.companyId, id, dto, user.id);
  }

  @Get('render/:documentId')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({ summary: 'Render sanitized printable HTML preview for a document' })
  @ApiQuery({ name: 'version', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Printable HTML representation.' })
  @ApiResponse({ status: 404, description: 'Document or version not found.' })
  async renderDocumentHtml(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
    @Query('version') version?: string,
  ) {
    const versionNumber = version ? parseInt(version, 10) : undefined;
    return this.templatesService.renderDocumentHtml(user.companyId, documentId, versionNumber);
  }
}
