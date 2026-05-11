import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import { config } from './config/env';
import { authenticate } from './middleware/auth';

// 路由
import { authRoutes } from './routes/auth';
import { voiceRoutes } from './routes/voices';
import { synthesizeRoutes } from './routes/synthesize';
import { settingsRoutes } from './routes/settings';
import { logsRoutes } from './routes/logs';
import { audioRoutes } from './routes/v1/audio';

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: config.isDevelopment
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : true,
    bodyLimit: config.upload.maxSizeMB * 1024 * 1024,
  });

  // 注册插件
  await fastify.register(cors, {
    origin: config.isDevelopment ? '*' : false,
    credentials: true,
  });

  await fastify.register(jwt, {
    secret: config.jwt.secret,
  });

  await fastify.register(multipart, {
    limits: {
      fileSize: config.upload.maxSizeMB * 1024 * 1024,
    },
  });

  // 添加认证装饰器
  fastify.decorate('authenticate', authenticate);

  // 健康检查
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // 注册路由
  await fastify.register(authRoutes);
  await fastify.register(voiceRoutes);
  await fastify.register(synthesizeRoutes);
  await fastify.register(settingsRoutes);
  await fastify.register(logsRoutes);
  await fastify.register(audioRoutes);

  // 404 处理
  fastify.setNotFoundHandler((request, reply) => {
    reply.status(404).send({ error: 'Not found' });
  });

  // 错误处理
  fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error(error);
    reply.status(500).send({ error: 'Internal server error' });
  });

  return fastify;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: typeof authenticate;
  }
}