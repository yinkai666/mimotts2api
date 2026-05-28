import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001'),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(32),
  MIMO_API_BASE_URL: z.string().url().default('https://api.xiaomimimo.com/v1'),
  MIMO_API_KEY: z.string().optional(),
  PROXY_AUTH_TOKEN: z.string().optional(),
  STORAGE_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_MB: z.string().default('10'),
  SYNTHESIS_LOG_RETENTION_DAYS: z.string().regex(/^\d+$/).default('30'),
  RATE_LIMIT_WINDOW_MS: z.string().default('60000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('60'),
});

const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Environment validation failed:');
      error.errors.forEach((err) => {
        console.error(`  ${err.path.join('.')}: ${err.message}`);
      });
    }
    process.exit(1);
  }
};

export const env = parseEnv();

export const config = {
  port: parseInt(env.PORT, 10),
  nodeEnv: env.NODE_ENV,
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  database: {
    url: env.DATABASE_URL,
  },
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: '7d',
  },
  mimo: {
    apiBaseUrl: env.MIMO_API_BASE_URL,
    apiKey: env.MIMO_API_KEY || '',
  },
  proxy: {
    authToken: env.PROXY_AUTH_TOKEN || '',
  },
  upload: {
    storageDir: env.STORAGE_DIR,
    maxSizeMB: parseInt(env.MAX_UPLOAD_MB, 10),
    allowedMimeTypes: ['audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/mp4'],
  },
  synthesisLog: {
    retentionDays: parseInt(env.SYNTHESIS_LOG_RETENTION_DAYS, 10),
  },
  rateLimit: {
    windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS, 10),
    maxRequests: parseInt(env.RATE_LIMIT_MAX_REQUESTS, 10),
  },
};
