import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { CompaniesService, UploadedBrandingFiles } from './companies.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

const BRANDING_FILE_FIELDS = [
  { name: 'logo', maxCount: 1 },
  { name: 'signatureSpecimen', maxCount: 1 },
  { name: 'corporateSeal', maxCount: 1 },
];

@ApiTags('Companies & Settings')
@ApiBearerAuth('JWT-auth')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get('current')
  @RequirePermissions('company:view')
  @ApiOperation({ summary: 'Get current company profile, settings, and organization stats' })
  @ApiResponse({ status: 200, description: 'Current company details and settings retrieved.' })
  async getCurrentCompany(@CurrentUser() user: AuthenticatedUser) {
    return this.companiesService.getCurrentCompany(user.companyId);
  }

  @Patch('current')
  @RequirePermissions('company:update')
  @ApiOperation({ summary: 'Update company legal name, registration number, address, and contact info' })
  @ApiResponse({ status: 200, description: 'Company profile successfully updated.' })
  async updateCurrentCompany(
    @CurrentUser() user: AuthenticatedUser,
    @Body() updateDto: UpdateCompanyDto,
  ) {
    return this.companiesService.updateCompany(user.companyId, updateDto, user.id);
  }

  @Patch('current/settings')
  @RequirePermissions('settings:manage')
  @ApiOperation({ summary: 'Update banking information, VAT rates, payment terms, and branding settings' })
  @ApiResponse({ status: 200, description: 'Company settings successfully updated.' })
  async updateCurrentCompanySettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() settingsDto: UpdateCompanySettingsDto,
  ) {
    return this.companiesService.updateCompanySettings(user.companyId, settingsDto, user.id);
  }

  @Post('current/branding-assets')
  @RequirePermissions('settings:manage')
  @UseInterceptors(
    FileFieldsInterceptor(BRANDING_FILE_FIELDS, {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload official company logo, signatureSpecimen, and corporateSeal branding assets',
  })
  @ApiResponse({ status: 201, description: 'Branding assets persisted to company settings.' })
  async uploadCurrentCompanyBrandingAssets(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFiles() files: UploadedBrandingFiles = {},
    @Body()
    body: {
      logoUrl?: string;
      signatureSpecimenUrl?: string;
      corporateSealUrl?: string;
    } = {},
  ) {
    return this.companiesService.uploadBrandingAssets(user.companyId, files, body, user.id);
  }
}

@ApiTags('Companies & Settings')
@ApiBearerAuth('JWT-auth')
@Controller('settings')
export class SettingsBrandingController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post('branding-assets')
  @RequirePermissions('settings:manage')
  @UseInterceptors(
    FileFieldsInterceptor(BRANDING_FILE_FIELDS, {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload official company logo, signatureSpecimen, and corporateSeal branding assets',
  })
  @ApiResponse({ status: 201, description: 'Branding assets persisted to company settings.' })
  async uploadBrandingAssets(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFiles() files: UploadedBrandingFiles = {},
    @Body()
    body: {
      logoUrl?: string;
      signatureSpecimenUrl?: string;
      corporateSealUrl?: string;
    } = {},
  ) {
    return this.companiesService.uploadBrandingAssets(user.companyId, files, body, user.id);
  }
}
