import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { FileCategory } from '@prisma/client';

export class UploadFileDto {
  @ApiPropertyOptional({
    enum: FileCategory,
    default: FileCategory.ATTACHMENT,
    description: 'Category for the uploaded asset (e.g. LOGO, SIGNATURE, STAMP, ATTACHMENT)',
  })
  @IsOptional()
  @IsEnum(FileCategory)
  fileCategory?: FileCategory = FileCategory.ATTACHMENT;

  @ApiPropertyOptional({ description: 'Optional Document ID to link this attachment to' })
  @IsOptional()
  @IsString()
  documentId?: string;
}
