import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { QueryReportsDto } from './dto/query-reports.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Reports & Analytics')
@ApiBearerAuth('JWT-auth')
@Controller('reports')
@UseGuards(PermissionsGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Retrieve high-level financial and operational aggregation metrics' })
  @ApiResponse({ status: 200, description: 'Reports summary retrieved successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden. User lacks reports:view permission.' })
  async getSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryReportsDto,
  ) {
    return this.reportsService.getSummary(user.companyId, query);
  }
}
