import { buildApp } from './app';
import { config } from './config/env';
import { synthesisService } from './services/synthesis.service';
import { logger } from './utils/logger';

async function start() {
  try {
    const app = await buildApp();

    await app.listen({
      port: config.port,
      host: '0.0.0.0',
    });

    logger.info(`Server listening on port ${config.port}`);
    logger.info(`Environment: ${config.nodeEnv}`);
    synthesisService.startLogRetentionCleanup();
  } catch (error) {
    logger.error(error);
    process.exit(1);
  }
}

start();
