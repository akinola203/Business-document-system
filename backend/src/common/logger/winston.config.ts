import * as winston from 'winston';
import { WinstonModuleOptions } from 'nest-winston';

export const createWinstonConfig = (): WinstonModuleOptions => {
  const isProduction = process.env.NODE_ENV === 'production';

  // Custom formatter that injects service metadata
  const serviceFormat = winston.format((info) => {
    info.service = 'aoa77-backend';
    return info;
  });

  // Development formatting: Human-readable, colorized with timestamp & request id
  const devFormat = winston.format.combine(
    serviceFormat(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.printf((info) => {
      const { timestamp, level, message, context, requestId, ...meta } = info;
      const ctx = context ? ` [${context}]` : '';
      const reqId = requestId ? ` (${requestId})` : '';
      const metaKeys = Object.keys(meta).filter((k) => k !== 'service');
      const metaStr = metaKeys.length > 0 ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp} ${level}${ctx}${reqId}: ${message}${metaStr}`;
    }),
  );

  // Production formatting: Strict single-line structured JSON with errors & stack traces
  const prodFormat = winston.format.combine(
    serviceFormat(),
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

