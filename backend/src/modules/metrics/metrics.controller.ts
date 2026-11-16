import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { MetricsService } from './metrics.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Metrics & Observability')
@Controller(['metrics', 'api/v1/metrics'])
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Prometheus metrics scrape endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Prometheus exposition text format containing system, latency, and connection saturation metrics',
  })
  async getMetrics(@Res() res: Response): Promise<void> {
    const metrics = await this.metricsService.getMetrics();
    res.setHeader('Content-Type', this.metricsService.getContentType());
    res.status(HttpStatus.OK).send(metrics);
  }
}

