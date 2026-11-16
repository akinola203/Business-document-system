import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

// Optional OpenTelemetry diagnostic logging
if (process.env.OTEL_LOG_LEVEL === 'debug') {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
}

const serviceName = process.env.OTEL_SERVICE_NAME || 'aoa77-backend';
const exporterUrl = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces';

// Check if tracing is explicitly disabled (e.g. during specific offline tests)
const isDisabled = process.env.OTEL_SDK_DISABLED === 'true' || process.env.DISABLE_OTEL === 'true';

let otelSdk: NodeSDK | null = null;

if (!isDisabled) {
  try {
    const traceExporter = new OTLPTraceExporter({
      url: exporterUrl,
    });

    otelSdk = new NodeSDK({
      resource: resourceFromAttributes({
        'service.name': serviceName,
        'service.version': '1.0.0',
        'deployment.environment': process.env.NODE_ENV || 'development',
      }),
      traceExporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable high-volume filesystem instrumentation
          '@opentelemetry/instrumentation-fs': {
            enabled: false,
          },
          '@opentelemetry/instrumentation-http': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-express': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-ioredis': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-nestjs-core': {
            enabled: true,
          },
        }),
      ],
    });

    otelSdk.start();

    if (process.env.NODE_ENV !== 'test') {
      console.log(`[OpenTelemetry] Distributed tracing initialized for "${serviceName}" [Target: ${exporterUrl}]`);
    }

    const gracefulShutdown = async (signal: string) => {
      try {
        if (otelSdk) {
          await otelSdk.shutdown();
          if (process.env.NODE_ENV !== 'test') {
            console.log(`[OpenTelemetry] Tracing terminated gracefully on ${signal}.`);
          }
        }
      } catch {
        // Suppress unhandled export rejections if OTLP collector is offline
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (err: any) {
    console.warn(`[OpenTelemetry] Initialization failed: ${err?.message}`);
  }
}

export { otelSdk };
export default otelSdk;

