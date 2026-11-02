import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  Res,
  BadRequestException,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { FilesService, MAX_FILE_SIZE_BYTES } from './files.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CompanyScopeGuard } from '../../common/guards/company-scope.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import {
  assertDocumentPermission,
  viewableDocumentTypes,
} from '../documents/utils/document-permissions.util';

@ApiTags('File Storage & Attachments')
@ApiBearerAuth('JWT-auth')
@UseGuards(CompanyScopeGuard, PermissionsGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  private hasCompanyAssetWritePermission(user: AuthenticatedUser): boolean {
    if (user.role === 'Admin') return true;
    const perms = user.permissions || [];
    return (
      perms.includes('*') ||
      perms.includes('*:*') ||
      perms.includes('company:update') ||
      perms.includes('settings:manage') ||
      perms.some((p) => p.endsWith(':create') || p.endsWith(':update') || p.endsWith(':manage'))
    );
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Securely upload a file asset or document attachment' })
  @ApiResponse({ status: 201, description: 'File uploaded and registered successfully.' })
  @ApiResponse({ status: 400, description: 'File missing or invalid MIME/size.' })
  async uploadFile(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
  ) {
    if (!file) {
      throw new BadRequestException('Multipart form field "file" is required.');
    }

    if (dto?.documentId) {
      const documentType = await this.filesService.getDocumentType(user.companyId, dto.documentId);
      assertDocumentPermission(user, documentType, 'version');
    } else if (!this.hasCompanyAssetWritePermission(user)) {
      throw new ForbiddenException('Access denied. Insufficient permissions to upload company files.');
    }

    return this.filesService.uploadFile(user.companyId, file, dto, user.id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Stream an authorized file asset or attachment to the client' })
  @ApiResponse({ status: 200, description: 'File stream.' })
  @ApiResponse({ status: 404, description: 'File not found.' })
  async downloadFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const meta = await this.filesService.getFileAuthorizationMeta(user.companyId, id);
    if (meta.documentType) {
      assertDocumentPermission(user, meta.documentType, 'view');
    } else if (
      user.role !== 'Admin' &&
      !user.permissions?.includes('*') &&
      !user.permissions?.includes('*:*') &&
      !user.permissions?.includes('company:view') &&
      !user.permissions?.includes('settings:manage') &&
      viewableDocumentTypes(user).length === 0
    ) {
      throw new ForbiddenException('Access denied. Insufficient permissions to download this file.');
    }

    const { file, stream } = await this.filesService.getFileStream(user.companyId, id);

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(file.originalFilename)}"`,
    );
    res.setHeader('Content-Length', file.sizeBytes.toString());

    stream.pipe(res);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a file asset or attachment' })
  @ApiResponse({ status: 200, description: 'File deleted.' })
  @ApiResponse({ status: 404, description: 'File not found.' })
  async deleteFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const meta = await this.filesService.getFileAuthorizationMeta(user.companyId, id);
    if (meta.documentType) {
      assertDocumentPermission(user, meta.documentType, 'archive');
    } else if (
      user.role !== 'Admin' &&
      !user.permissions?.includes('*') &&
      !user.permissions?.includes('*:*') &&
      !user.permissions?.includes('company:update') &&
      !user.permissions?.includes('settings:manage')
    ) {
      throw new ForbiddenException('Access denied. Insufficient permissions to delete this file.');
    }

    return this.filesService.deleteFile(user.companyId, id, user.id);
  }
}
