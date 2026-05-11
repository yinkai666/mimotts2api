import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { maskApiKey, generateToken } from '../utils/crypto';
import { synthesisService } from '../services/synthesis.service';

const prisma = new PrismaClient();

const updateSettingsSchema = z.object({
  mimo_api_key: z.string().optional(),
  proxy_auth_token: z.string().optional(),
  default_model: z.string().optional(),
  default_format: z.string().optional(),
  max_upload_mb: z.string().optional(),
});

export async function settingsRoutes(fastify: FastifyInstance) {
  // 获取配置（脱敏）
  fastify.get('/api/settings', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const settings = await prisma.appSetting.findMany();

      // 脱敏处理
      const maskedSettings = settings.map((setting) => {
        if (setting.key === 'mimo_api_key' || setting.key === 'proxy_auth_token') {
          return {
            ...setting,
            value: setting.value ? maskApiKey(setting.value) : '',
            masked: true,
          };
        }
        return { ...setting, masked: false };
      });

      return maskedSettings;
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // 更新配置
  fastify.put('/api/settings', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const data = updateSettingsSchema.parse(request.body);

      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          await prisma.appSetting.upsert({
            where: { key },
            update: { value },
            create: { key, value },
          });

          // 如果更新了 MiMo API Key，更新服务实例
          if (key === 'mimo_api_key') {
            synthesisService.updateMimoApiKey(value);
          }
        }
      }

      return { message: 'Settings updated successfully' };
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request', details: error.errors });
      }
      return reply.status(500).send({ error: error.message });
    }
  });

  // 重新生成代理 Token
  fastify.post('/api/settings/regenerate-token', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const newToken = generateToken(32);

      await prisma.appSetting.upsert({
        where: { key: 'proxy_auth_token' },
        update: { value: newToken },
        create: { key: 'proxy_auth_token', value: newToken },
      });

      return { token: newToken };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
