import * as winston from 'winston';
import { WinstonModuleOptions } from 'nest-winston';
import { trace, context } from '@opentelemetry/api';

export const createWinstonConfig = (): WinstonModuleOptions => {
  const isProduction = process.env.NODE_ENV === 'production';

  // Custom formatter that injects service metadata
  const serviceFormat = winston.format((info) => {
    info.service = 'aoa77-backend';
    return info;
  });

  // OpenTelemetry Trace Context Formatter:
  // Extracts trace_id and span_id from the active OpenTelemetry span and injects them
  // into Winston log metadata for Jaeger/Zipkin distributed trace correlation.
  const openTelemetryTraceFormat = winston.format((info) => {
    try {
      const activeSpan = trace.getSpan(context.active());
      if (activeSpan) {
        const spanContext = activeSpan.spanContext();
        if (spanContext && trace.isSpanContextValid(spanContext)) {
          info.trace_id = spanContext.traceId;
          info.span_id = spanContext.spanId;
          info.traceId = spanContext.traceId;
          info.spanId = spanContext.spanId;
        }

        // Pull requestId from span attributes if not already directly attached
        if (!info.requestId) {
          const spanAttributes = (activeSpan as any).attributes;
          if (spanAttributes?.['http.request_id']) {
            info.requestId = spanAttributes['http.request_id'];
          }
        }
      }
    } catch {
      // Ignore tracing lookup issues during log formatting
    }
    return info;
  });

  // Development formatting: Human-readable, colorized with timestamp, request ID & trace ID
  const devFormat = winston.format.combine(
    serviceFormat(),
    openTelemetryTraceFormat(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.printf((info) => {
      const { timestamp, level, message, context: logContext, requestId, trace_id, span_id, ...meta } = info;
      const ctx = logContext ? ` [${logContext}]` : '';
      const reqId = requestId ? ` (${requestId})` : '';
      const traceInfo = trace_id
        ? ` [trace: ${String(trace_id).slice(0, 8)} span: ${span_id ? String(span_id).slice(0, 8) : ''}]`
        : '';
      const metaKeys = Object.keys(meta).filter(
        (k) => k !== 'service' && k !== 'traceId' && k !== 'spanId',
      );
      const metaStr = metaKeys.length > 0 ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp} ${level}${ctx}${reqId}${traceInfo}: ${message}${metaStr}`;
    }),
  );

  // Production formatting: Strict single-line structured JSON with errors, stack traces, and trace IDs
  const prodFormat = winston.format.combine(
    serviceFormat(),
    openTelemetryTraceFormat(),
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  );

  return {
    transports: [
      new winston.transports.Console({
        format: isProduction ? prodFormat : devFormat,
        level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
      }),
    ],
  };
};
