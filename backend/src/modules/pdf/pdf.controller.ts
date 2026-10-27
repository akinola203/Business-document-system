import {
  Controller,
  Get,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { PdfService } from './pdf.service';
import { FilesService } from '../files/files.service';
import { TemplatesService } from '../templates/templates.service';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Document PDF Engine')
@ApiBearerAuth('JWT-auth')
@Controller('documents')
export class PdfController {
  constructor(
    private readonly pdfService: PdfService,
    private readonly filesService: FilesService,
    private readonly templatesService: TemplatesService,
  ) {}

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Stream or generate the authoritative PDF for the document (latest version)' })
  @ApiResponse({ status: 200, description: 'Binary PDF stream.' })
  @ApiResponse({ status: 404, description: 'Document not found.' })
  async getDocumentPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const result = await this.pdfService.getOrGenerateDocumentPdf(
      user.companyId,
      id,
      undefined,
      user.id,
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(result.filename)}"`,
    );

    if (result.buffer) {
      res.setHeader('Content-Length', result.buffer.length.toString());
      return res.send(result.buffer);
    }

    // Stream from storage
    const { stream, file } = await this.filesService.getFileStream(user.companyId, result.fileId);
    res.setHeader('Content-Length', file.sizeBytes.toString());
    stream.pipe(res);
  }

  @Get(':id/versions/:version/pdf')
  @ApiOperation({ summary: 'Stream or generate the authoritative PDF for a specific frozen document version' })
  @ApiResponse({ status: 200, description: 'Binary PDF stream.' })
  @ApiResponse({ status: 404, description: 'Document version not found.' })
  async getDocumentVersionPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('version') version: string,
    @Res() res: Response,
  ) {
    const versionNumber = parseInt(version, 10);
    const result = await this.pdfService.getOrGenerateDocumentPdf(
      user.companyId,
      id,
      versionNumber,
      user.id,
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(result.filename)}"`,
    );

    if (result.buffer) {
      res.setHeader('Content-Length', result.buffer.length.toString());
      return res.send(result.buffer);
    }

    const { stream, file } = await this.filesService.getFileStream(user.companyId, result.fileId);
    res.setHeader('Content-Length', file.sizeBytes.toString());
    stream.pipe(res);
  }

  @Get(':id/preview-pdf')
  @ApiOperation({ summary: 'Generate on-the-fly PDF preview without storing permanently in file registry' })
  @ApiResponse({ status: 200, description: 'Binary preview PDF.' })
  @ApiResponse({ status: 404, description: 'Document not found.' })
  async previewDocumentPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.pdfService.previewDocumentPdf(user.companyId, id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(filename)}"`,
    );
    res.setHeader('Content-Length', buffer.length.toString());
    res.send(buffer);
  }

  @Get(':id/preview')
  @ApiOperation({ summary: 'Render live printable HTML document preview' })
  @ApiQuery({ name: 'version', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'HTML document string.' })
  @ApiResponse({ status: 404, description: 'Document not found.' })
  async previewDocumentHtml(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('version') version?: string,
  ) {
    const versionNumber = version ? parseInt(version, 10) : undefined;
    return this.templatesService.renderDocumentHtml(user.companyId, id, versionNumber);
  }
}
