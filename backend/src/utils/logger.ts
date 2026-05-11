import pino from 'pino';
import { config } from '../config/env';

export const logger = pino({
  level: config.isDevelopment ? 'debug' : 'info',
  transport: config.isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  redact: {
    paths: ['*.apiKey', '*.password', '*.token', '*.authorization'],
    censor: '***REDACTED***',
  },
});
