import '../../src/tracing';
import { test } from 'node:test';
import * as assert from 'node:assert';
import { trace } from '@opentelemetry/api';
import * as winston from 'winston';
import Transport = require('winston-transport');
import { createWinstonConfig } from '../../src/common/logger/winston.config';
import { MetricsService } from '../../src/modules/metrics/metrics.service';
import { MetricsInterceptor } from '../../src/modules/metrics/metrics.interceptor';
import { MetricsController } from '../../src/modules/metrics/metrics.controller';
import { of, throwError } from 'rxjs';

class TestCaptureTransport extends Transport {
  public capturedInfo: any = null;

  constructor(opts?: Transport.TransportStreamOptions) {
    super(opts);
  }

  log(info: any, callback: () => void) {
    this.capturedInfo = { ...info };
    callback();
  }
}

test('Distributed Tracing & OpenTelemetry Winston Integration Tests', async (t) => {
  await t.test('Winston logger automatically injects trace_id, span_id and service name into log metadata', () => {
    const tracer = trace.getTracer('test-telemetry-tracer');

    // Create an active span
    tracer.startActiveSpan('test-http-operation', (span) => {
      try {
        span.setAttribute('http.request_id', 'req-tracing-uuid-1234');

        const winstonConfig = createWinstonConfig();
        const baseFormat = (winstonConfig.transports as any)[0].format;
        const captureTransport = new TestCaptureTransport({
          format: baseFormat,
        });

        const logger = winston.createLogger({
          transports: [captureTransport],
        });

        logger.info('Test log line emitted inside active trace span', { customMeta: 'value123' });

        const capturedLog = captureTransport.capturedInfo;
        assert.ok(capturedLog, 'A log message was captured');
        assert.strictEqual(capturedLog.service, 'aoa77-backend');
        assert.ok(String(capturedLog.message).includes('Test log line emitted inside active trace span'));
        assert.ok(capturedLog.trace_id, 'trace_id should be present');
        assert.strictEqual(capturedLog.trace_id.length, 32, 'trace_id should be 32 hex chars');
        assert.ok(capturedLog.span_id, 'span_id should be present');
        assert.strictEqual(capturedLog.span_id.length, 16, 'span_id should be 16 hex chars');
        assert.strictEqual(capturedLog.requestId, 'req-tracing-uuid-1234', 'requestId was extracted from span');
      } finally {
        span.end();
      }
    });
  });

  await t.test('Winston logger functions cleanly when outside active trace span', () => {
    const winstonConfig = createWinstonConfig();
    const baseFormat = (winstonConfig.transports as any)[0].format;
    const captureTransport = new TestCaptureTransport({
      format: baseFormat,
    });

    const logger = winston.createLogger({
      transports: [captureTransport],
    });

    logger.warn('Log line outside trace', { requestId: 'explicit-req-id' });

    const capturedLog = captureTransport.capturedInfo;
    assert.ok(capturedLog);
    assert.strictEqual(capturedLog.service, 'aoa77-backend');
    assert.strictEqual(capturedLog.requestId, 'explicit-req-id');
    assert.ok(String(capturedLog.level).includes('warn'));
  });
});

test('Prometheus Metrics Collection Tests', async (t) => {
  const mockPrisma: any = {
    $queryRaw: async () => [
      { state: 'active', count: 3 },
      { state: 'idle', count: 7 },
    ],
  };

  const metricsService = new MetricsService(mockPrisma);

  await t.test('Initializes Prometheus registry with default and custom metrics', async () => {
    const metricsOutput = await metricsService.getMetrics();
    assert.ok(metricsOutput.includes('http_request_duration_seconds'));
    assert.ok(metricsOutput.includes('http_requests_total'));
    assert.ok(metricsOutput.includes('rate_limit_throttled_requests_total'));
    assert.ok(metricsOutput.includes('db_pool_connections_active'));
    assert.ok(metricsOutput.includes('db_pool_connections_idle'));
    assert.ok(metricsOutput.includes('db_pool_connections_max'));
    assert.ok(metricsOutput.includes('db_pool_saturation_ratio'));
    assert.ok(metricsService.getContentType().includes('text/plain'));
  });

  await t.test('Records HTTP request duration histogram and requests total counter', async () => {
    metricsService.recordHttpRequest('GET', '/api/v1/invoices', '200', 0.045);
    metricsService.recordHttpRequest('POST', '/api/v1/invoices', '201', 0.12);
    metricsService.recordHttpRequest('GET', '/api/v1/invoices', '500', 0.55);

    const metricsOutput = await metricsService.getMetrics();

    // Verify counter increment
    assert.ok(metricsOutput.includes('http_requests_total{method="GET",route="/api/v1/invoices",status_code="200"} 1'));
    assert.ok(metricsOutput.includes('http_requests_total{method="POST",route="/api/v1/invoices",status_code="201"} 1'));
    assert.ok(metricsOutput.includes('http_requests_total{method="GET",route="/api/v1/invoices",status_code="500"} 1'));

    // Verify histogram buckets
    assert.ok(metricsOutput.includes('http_request_duration_seconds_bucket{le="0.05",method="GET",route="/api/v1/invoices",status_code="200"}'));
    assert.ok(metricsOutput.includes('http_request_duration_seconds_count{method="GET",route="/api/v1/invoices",status_code="200"} 1'));
  });

  await t.test('Records rate-limit throttles (HTTP 429)', async () => {
    MetricsService.recordRateLimitThrottle('/api/v1/auth/login', 'ip');
    MetricsService.recordRateLimitThrottle('/api/v1/auth/login', 'ip');
    MetricsService.recordRateLimitThrottle('/api/v1/documents', 'user');

    const metricsOutput = await metricsService.getMetrics();
    assert.ok(metricsOutput.includes('rate_limit_throttled_requests_total{endpoint="/api/v1/auth/login",client_type="ip"} 2'));
    assert.ok(metricsOutput.includes('rate_limit_throttled_requests_total{endpoint="/api/v1/documents",client_type="user"} 1'));
  });

  await t.test('Computes database connection pool saturation ratio correctly', async () => {
    await metricsService.updateDatabasePoolMetrics();
    const metricsOutput = await metricsService.getMetrics();
    const maxLimit = metricsService.resolveMaxConnections();
    const expectedRatio = maxLimit > 0 ? (3 / maxLimit).toString() : '0';

    assert.ok(metricsOutput.includes('db_pool_connections_active 3'));
    assert.ok(metricsOutput.includes('db_pool_connections_idle 7'));
    assert.ok(metricsOutput.includes(`db_pool_connections_max ${maxLimit}`));
    assert.ok(metricsOutput.includes(`db_pool_saturation_ratio ${expectedRatio}`));
  });

  await t.test('MetricsController serves metrics with correct HTTP headers', async () => {
    const controller = new MetricsController(metricsService);
    let sentStatus: number | null = null;
    let sentBody: string | null = null;
    const responseHeaders: Record<string, string> = {};

    const mockResponse: any = {
      setHeader: (k: string, v: string) => {
        responseHeaders[k] = v;
      },
      status: (code: number) => {
        sentStatus = code;
        return {
          send: (body: string) => {
            sentBody = body;
          },
        };
      },
    };

    await controller.getMetrics(mockResponse);

    assert.strictEqual(sentStatus, 200);
    assert.ok(String(responseHeaders['Content-Type']).includes('text/plain'));
    assert.ok(sentBody !== null && (sentBody as string).includes('http_requests_total'));
  });

  await t.test('MetricsInterceptor records request metrics and excludes /metrics route', async () => {
    const interceptor = new MetricsInterceptor(metricsService);

    // Test normal route
    const normalContext: any = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          route: { path: '/payments' },
          baseUrl: '/api/v1',
        }),
        getResponse: () => ({
          statusCode: 200,
        }),
      }),
    };

    const callHandler: any = {
      handle: () => of({ success: true }),
    };

    interceptor.intercept(normalContext, callHandler).subscribe();

    // Test error route
    const errorContext: any = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          route: { path: '/clients' },
          baseUrl: '/api/v1',
        }),
        getResponse: () => ({
          statusCode: 400,
        }),
      }),
    };

    const failingCallHandler: any = {
      handle: () => throwError(() => ({ status: 400, message: 'Bad request' })),
    };

    interceptor.intercept(errorContext, failingCallHandler).subscribe({
      error: () => {},
    });

    const metricsOutput = await metricsService.getMetrics();
    assert.ok(metricsOutput.includes('http_requests_total{method="GET",route="/api/v1/payments",status_code="200"} 1'));
    assert.ok(metricsOutput.includes('http_requests_total{method="POST",route="/api/v1/clients",status_code="400"} 1'));

    // Test scrape route exclusion
    const metricsContext: any = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          route: { path: '/metrics' },
          baseUrl: '',
        }),
        getResponse: () => ({
          statusCode: 200,
        }),
      }),
    };

    interceptor.intercept(metricsContext, callHandler).subscribe();
    const finalOutput = await metricsService.getMetrics();
    assert.ok(!finalOutput.includes('route="/metrics"'));
  });
});
