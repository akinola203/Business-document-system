import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import {
  CURRENCY_METADATA,
  CurrencyService,
  SUPPORTED_CURRENCIES,
} from './currency.service';

@ApiTags('Currency')
@ApiBearerAuth()
@UseGuards(RateLimitGuard)
@RateLimit({ limit: 30, ttl: 60 })
@Throttle({ default: { limit: 30, ttl: 60000 } })
@Controller('currency')
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Get('rates')
  @ApiOperation({
    summary: 'Get cached exchange rates relative to NGN (with 4-24h Redis TTL)',
  })
  async getExchangeRates() {
    const snapshot = await this.currencyService.getRatesSnapshot();
    return {
      ...snapshot,
      supportedCurrencies: SUPPORTED_CURRENCIES.map((code) => ({
        ...CURRENCY_METADATA[code],
        rateToNgn: snapshot.ratesToNgn[code],
      })),
    };
  }

  @Get('convert')
  @ApiOperation({
    summary: 'Convert an amount between two supported currencies (NGN, USD, JPY, GBP, EUR)',
  })
  @ApiQuery({ name: 'amount', type: Number, required: true })
  @ApiQuery({ name: 'from', type: String, required: true, example: 'USD' })
  @ApiQuery({ name: 'to', type: String, required: false, example: 'NGN' })
  async convertAmount(
    @Query('amount') amountRaw: string,
    @Query('from') from: string,
    @Query('to') to: string = 'NGN',
  ) {
    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException('Query parameter "amount" must be a non-negative number.');
    }

    const fromCode = this.currencyService.normalizeCurrency(from);
    const toCode = this.currencyService.normalizeCurrency(to);
    const exchangeRate = await this.currencyService.getExchangeRate(fromCode, toCode);
    const convertedAmount = await this.currencyService.convertAmount(
      amount,
      fromCode,
      toCode,
    );

    return {
      amount,
      from: fromCode,
      to: toCode,
      exchangeRate,
      convertedAmount,
      formattedOriginal: this.currencyService.formatCurrency(amount, fromCode),
      formattedConverted: this.currencyService.formatCurrency(convertedAmount, toCode),
    };
  }
}

