import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { ReversePaymentDto } from './dto/reverse-payment.dto';
import { QueryPaymentsDto } from './dto/query-payments.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@ApiTags('Payments')
@ApiBearerAuth('JWT-auth')
@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('invoices/:id/payments')
  @RequirePermissions('payment:record')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Client-generated unique key (e.g. UUID). Retries with the same key replay the original result.',
  })
  @ApiOperation({ summary: 'Record a payment against an ISSUED invoice' })
  @ApiResponse({ status: 201, description: 'Payment recorded; returns payment and re-derived invoice balance.' })
  @ApiResponse({ status: 400, description: 'Invalid amount/date/currency, non-payable invoice, or unacknowledged overpayment.' })
  @ApiResponse({ status: 409, description: 'Duplicate bank reference, or same Idempotency-Key still in progress.' })
  async recordPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) documentId: string,
    @Body() dto: RecordPaymentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-idempotency-key') legacyIdempotencyKey?: string,
  ) {
    // Payments are the highest-risk retry scenario (network drop after commit). The global
    // IdempotencyInterceptor handles replay; here we make the header mandatory for this route.
    if (!idempotencyKey && !legacyIdempotencyKey) {
      throw new BadRequestException('The Idempotency-Key header is required when recording a payment.');
    }
    return this.paymentsService.recordPayment(user.companyId, documentId, dto, user.id);
  }

  @Get('invoices/:id/payments')
  @RequirePermissions('payment:view')
  @ApiOperation({ summary: 'Get the full payment ledger, derived balance, and overdue state of an invoice' })
  @ApiResponse({ status: 200, description: 'Ledger retrieved (includes reversed entries for traceability).' })
  async getInvoiceLedger(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) documentId: string,
  ) {
    return this.paymentsService.getInvoiceLedger(user.companyId, documentId);
  }

  @Get('payments')
  @RequirePermissions('payment:view')
  @ApiOperation({ summary: 'List payments with filters (invoice, client, method, date range, reference search)' })
  async findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryPaymentsDto) {
    return this.paymentsService.findAll(user.companyId, query);
  }

  @Get('payments/:paymentId')
  @RequirePermissions('payment:view')
  @ApiOperation({ summary: 'Get a single payment record' })
  @ApiResponse({ status: 404, description: 'Payment not found.' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    return this.paymentsService.findOne(user.companyId, paymentId);
  }

  @Post('payments/:paymentId/reverse')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('payment:reverse')
  @ApiOperation({ summary: 'Reverse (void) a payment with a mandatory reason. Records are never deleted.' })
  @ApiResponse({ status: 200, description: 'Payment reversed; invoice balance re-derived.' })
  @ApiResponse({ status: 400, description: 'Payment already reversed.' })
  async reversePayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() dto: ReversePaymentDto,
  ) {
    return this.paymentsService.reversePayment(user.companyId, paymentId, dto, user.id);
  }
}
