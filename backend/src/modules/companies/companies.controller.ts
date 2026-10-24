import { Controller, Get, Patch, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@ApiTags('Companies & Settings')
@ApiBearerAuth('JWT-auth')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get('current')
  @RequirePermissions('company:view')
  @ApiOperation({ summary: 'Get current company profile, settings, and organization stats' })
  @ApiResponse({ status: 200, description: 'Current company details and settings retrieved.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Insufficient permissions.' })
  async getCurrentCompany(@CurrentUser() user: AuthenticatedUser) {
    return this.companiesService.getCurrentCompany(user.companyId);
  }

  @Patch('current')
  @RequirePermissions('company:update')
  @ApiOperation({ summary: 'Update company legal name, registration number, address, and contact info' })
  @ApiResponse({ status: 200, description: 'Company profile successfully updated.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Missing "company:update" permission.' })
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
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Missing "settings:manage" permission.' })
  async updateCurrentCompanySettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() settingsDto: UpdateCompanySettingsDto,
  ) {
    return this.companiesService.updateCompanySettings(user.companyId, settingsDto, user.id);
  }
}
