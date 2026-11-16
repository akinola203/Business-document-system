import { Injectable, OnModuleInit, Logger, Optional } from '@nestjs/common';
import * as promClient from 'prom-client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger(MetricsService.name);
  public static instance: MetricsService | null = null;

  public readonly registry: promClient.Registry;

  // HTTP Request Duration Histogram for p50, p90, p95, and p99 percentile latency calculations
  public readonly httpRequestDuration: promClient.Histogram<string>;

  // Total HTTP Requests Counter
  public readonly httpRequestsTotal: promClient.Counter<string>;

  // Active Rate-Limit Throttled Requests Counter (HTTP 429)
  public readonly rateLimitThrottledRequests: promClient.Counter<string>;

  // Database Connection Pool Saturation Gauges
  public readonly dbPoolConnectionsActive: promClient.Gauge<string>;
  public readonly dbPoolConnectionsIdle: promClient.Gauge<string>;
  public readonly dbPoolConnectionsMax: promClient.Gauge<string>;
  public readonly dbPoolSaturationRatio: promClient.Gauge<string>;

  constructor(@Optional() private readonly prisma?: PrismaService) {
    this.registry = new promClient.Registry();
    MetricsService.instance = this;

    // Default Node.js system and process metrics (memory, event loop lag, CPU, GC)
    promClient.collectDefaultMetrics({
      register: this.registry,
      prefix: 'aoa77_',
    });

    // 1. HTTP Request Latency Histogram
    this.httpRequestDuration = new promClient.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Latency distribution of incoming HTTP requests in seconds (supports p95 and p99 percentiles)',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    // 2. HTTP Total Requests Counter
    this.httpRequestsTotal = new promClient.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests processed by endpoint and status',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    // 3. Rate-Limit Throttled Requests Counter (HTTP 429)
    this.rateLimitThrottledRequests = new promClient.Counter({
      name: 'rate_limit_throttled_requests_total',
      help: 'Total count of requests blocked by rate limiters (HTTP 429 Too Many Requests)',
      labelNames: ['endpoint', 'client_type'],
      registers: [this.registry],
    });

    // 4. Database Connection Pool Saturation Gauges
    this.dbPoolConnectionsActive = new promClient.Gauge({
      name: 'db_pool_connections_active',
      help: 'Number of active PostgreSQL connections currently executing queries',
      registers: [this.registry],
    });

    this.dbPoolConnectionsIdle = new promClient.Gauge({
      name: 'db_pool_connections_idle',
      help: 'Number of idle PostgreSQL connections in the connection pool',
      registers: [this.registry],
    });

    this.dbPoolConnectionsMax = new promClient.Gauge({
      name: 'db_pool_connections_max',
      help: 'Configured maximum database connection pool capacity',
      registers: [this.registry],
    });

    this.dbPoolSaturationRatio = new promClient.Gauge({
      name: 'db_pool_saturation_ratio',
      help: 'Saturation ratio of database connections (active / max capacity, 0.0 to 1.0)',
      registers: [this.registry],
    });

    // Initialize baseline pool values
    const configuredLimit = this.resolveMaxConnections();
    this.dbPoolConnectionsMax.set(configuredLimit);
    this.dbPoolConnectionsActive.set(0);
    this.dbPoolConnectionsIdle.set(1);
    this.dbPoolSaturationRatio.set(0);
  }

  onModuleInit() {
    this.logger.log('MetricsService initialized with Prometheus registry and telemetry metrics.');
  }

  /**
   * Helper to parse connection_limit from DATABASE_URL or environment variables.
   */
  public resolveMaxConnections(): number {
    const rawLimit = process.env.DB_POOL_MAX || process.env.DATABASE_POOL_MAX;
    if (rawLimit && !isNaN(parseInt(rawLimit, 10))) {
      return parseInt(rawLimit, 10);
    }

    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      try {
        const urlObj = new URL(dbUrl);
        const limitParam = urlObj.searchParams.get('connection_limit');
        if (limitParam && !isNaN(parseInt(limitParam, 10))) {
          return parseInt(limitParam, 10);
        }
      } catch {
        // Ignore URL parsing errors
      }
    }

    return 20; // Standard default PostgreSQL connection limit
  }

  /**
   * Updates database connection pool saturation metrics by sampling PostgreSQL pg_stat_activity.
   */
  async updateDatabasePoolMetrics(): Promise<void> {
    if (!this.prisma) {
      return;
    }

    try {
      const stats = await this.prisma.$queryRaw<Array<{ state: string; count: bigint | number }>>`
        SELECT state, count(*) as count
        FROM pg_stat_activity
        WHERE datname = current_database()
        GROUP BY state
      `;

      let active = 0;
      let idle = 0;

      for (const row of stats) {
        const count = Number(row.count);
        if (row.state === 'active') {
          active += count;
        } else if (row.state === 'idle' || row.state === 'idle in transaction') {
          idle += count;
        }
      }

      const maxLimit = this.resolveMaxConnections();
      this.dbPoolConnectionsActive.set(active);
      this.dbPoolConnectionsIdle.set(idle);
      this.dbPoolConnectionsMax.set(maxLimit);
      this.dbPoolSaturationRatio.set(maxLimit > 0 ? active / maxLimit : 0);
    } catch {
      // In offline environments or mock unit tests, silently retain baseline values
    }
  }

  /**
   * Record HTTP request latency and total count.
   */
  recordHttpRequest(method: string, route: string, statusCode: string, durationSeconds: number): void {
    this.httpRequestDuration.observe({ method, route, status_code: statusCode }, durationSeconds);
    this.httpRequestsTotal.inc({ method, route, status_code: statusCode });
  }

  /**
   * Record rate limit throttling event (HTTP 429).
   */
  static recordRateLimitThrottle(endpoint: string, clientType: string = 'ip'): void {
    if (MetricsService.instance) {
      MetricsService.instance.rateLimitThrottledRequests.inc({
        endpoint,
        client_type: clientType,
      });
    }
  }

  /**
   * Returns current Prometheus metrics exposition text.
   */
  async getMetrics(): Promise<string> {
    await this.updateDatabasePoolMetrics();
    return this.registry.metrics();
  }

  /**
   * Content-Type header required by Prometheus scrapers.
   */
  getContentType(): string {
    return this.registry.contentType;
  }
}

