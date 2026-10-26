import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Audit Logs')
@ApiBearerAuth('JWT-auth')
@Controller('audit-logs')
@UseGuards(PermissionsGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions('audit:view')
  @ApiOperation({ summary: 'Retrieve paginated system and document audit logs' })
  @ApiResponse({ status: 200, description: 'Audit trail records retrieved successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden. User lacks audit:view permission.' })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryAuditLogsDto,
  ) {
    return this.auditService.findAll(user.companyId, query);
  }

  @Get('entity/:entityType/:entityId')
  @RequirePermissions('audit:view')
  @ApiOperation({ summary: 'Retrieve chronological audit trail for a specific business entity' })
  @ApiResponse({ status: 200, description: 'Entity audit history retrieved.' })
  async getEntityHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.auditService.getEntityHistory(user.companyId, entityType, entityId);
  }
}
