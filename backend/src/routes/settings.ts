import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { maskApiKey, generateToken } from '../utils/crypto';
import { synthesisService } from '../services/synthesis.service';
import { authService } from '../services/auth.service';

const prisma = new PrismaClient();

const updateSettingsSchema = z.object({
  mimo_api_base_url: z.string().optional(),
  mimo_api_key: z.string().optional(),
  proxy_auth_token: z.string().optional(),
  default_model: z.string().optional(),
  default_format: z.string().optional(),
  max_upload_mb: z.string().optional(),
});

export async function settingsRoutes(fastify: FastifyInstance) {
  // 获取配置
  fastify.get('/api/settings', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const settings = await prisma.appSetting.findMany();

      // 返回设置，敏感字段脱敏
      return settings.map((setting) => {
        if (setting.key === 'mimo_api_key') {
          // API Key 脱敏，但标记是否有值
          return {
            ...setting,
            value: setting.value ? maskApiKey(setting.value) : '',
            hasValue: !!setting.value,
            masked: true,
          };
        }
        if (setting.key === 'proxy_auth_token') {
          return {
            ...setting,
            value: setting.value ? maskApiKey(setting.value) : '',
            hasValue: !!setting.value,
            masked: true,
          };
        }
        return { ...setting, masked: false };
      });
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
        }
      }

      // 如果更新了 MiMo 相关配置，同步更新 Provider
      if (data.mimo_api_key || data.mimo_api_base_url) {
        const [urlSetting, keySetting] = await Promise.all([
          prisma.appSetting.findUnique({ where: { key: 'mimo_api_base_url' } }),
          prisma.appSetting.findUnique({ where: { key: 'mimo_api_key' } }),
        ]);
        const url = urlSetting?.value || '';
        const apiKey = keySetting?.value || '';
        if (url && apiKey) {
          synthesisService.updateMimoConfig(apiKey, url);
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

  // 清除代理 Token（设为空，表示不启用鉴权）
  fastify.post('/api/settings/clear-token', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      await prisma.appSetting.upsert({
        where: { key: 'proxy_auth_token' },
        update: { value: '' },
        create: { key: 'proxy_auth_token', value: '' },
      });

      return { message: 'Proxy token cleared. API access no longer requires authentication.' };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // 获取当前代理 Token 明文（仅后台管理员会话）
  fastify.get('/api/settings/proxy-token', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const token = await authService.getProxyToken();
      return {
        token,
        configured: !!token,
      };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
