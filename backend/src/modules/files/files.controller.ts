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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { FilesService } from './files.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@ApiTags('File Storage & Attachments')
@ApiBearerAuth('JWT-auth')
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
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
    return this.filesService.deleteFile(user.companyId, id, user.id);
  }
}
